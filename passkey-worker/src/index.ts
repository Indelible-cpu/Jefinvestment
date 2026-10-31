import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from 'jose';

interface Env {
  PASSKEYS_DB: D1Database;
  RP_ID: string;
  RP_NAME: string;
  EXPECTED_ORIGIN: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_SERVICE_ACCOUNT_JSON: string;
}
type Json = Record<string, unknown>;

const json = (body: Json, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
const now = () => Math.floor(Date.now() / 1000);
const randomId = () => crypto.randomUUID();

// ── Rate Limiting (in-memory token bucket to protect D1 and Worker compute) ──
interface RateLimitBucket {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitBucket>();

function checkRateLimit(key: string, maxRequests: number, windowSeconds = 60): boolean {
  const currentTime = now();
  const existing = rateLimitMap.get(key);
  if (!existing || currentTime >= existing.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: currentTime + windowSeconds });
    if (rateLimitMap.size > 2000) {
      for (const [k, v] of rateLimitMap.entries()) {
        if (currentTime >= v.resetAt) rateLimitMap.delete(k);
      }
    }
    return true;
  }
  if (existing.count >= maxRequests) return false;
  existing.count += 1;
  return true;
}

// ── Origin & Staging Detection ──
function isAllowedOrigin(origin: string | null, env: Env): boolean {
  if (!origin) return false;
  if (origin === env.EXPECTED_ORIGIN) return true;
  // Local development / staging origins
  if (
    origin === 'http://localhost:5173' ||
    origin === 'http://127.0.0.1:5173' ||
    origin === 'http://localhost:4173' ||
    origin === 'http://localhost:3000' ||
    origin === 'http://127.0.0.1:3000'
  ) {
    return true;
  }
  // Firebase Hosting preview channels for this project
  if (origin.startsWith(`https://${env.FIREBASE_PROJECT_ID}--`) && origin.endsWith('.web.app')) {
    return true;
  }
  return false;
}

function getWebAuthnConfig(request: Request, env: Env) {
  const origin = request.headers.get('Origin') || '';
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    return {
      expectedOrigin: origin,
      rpID: 'localhost',
    };
  }
  if (origin.startsWith(`https://${env.FIREBASE_PROJECT_ID}--`) && origin.endsWith('.web.app')) {
    return {
      expectedOrigin: origin,
      rpID: env.RP_ID,
    };
  }
  return {
    expectedOrigin: env.EXPECTED_ORIGIN,
    rpID: env.RP_ID,
  };
}

function cors(request: Request, env: Env): Headers {
  const origin = request.headers.get('Origin');
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
  });
  if (origin && isAllowedOrigin(origin, env)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }
  return headers;
}

function response(request: Request, env: Env, body: Json, status = 200): Response {
  const res = json(body, status);
  const headers = cors(request, env);
  headers.forEach((value, key) => res.headers.set(key, value));
  return res;
}

async function body(request: Request): Promise<Json> {
  const value = await request.json();
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid request body');
  return value as Json;
}

function accountIsUsable(data: Json): boolean {
  return data.isSuspended !== true && data.isActive !== false;
}

const firebaseKeys = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

async function verifyFirebaseIdToken(request: Request, env: Env) {
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) throw new Error('Sign in to your MsikaFlo account first.');
  const token = header.slice(7);
  const { payload } = await jwtVerify(token, firebaseKeys, {
    audience: env.FIREBASE_PROJECT_ID,
    issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
  });
  if (typeof payload.sub !== 'string' || !payload.sub || typeof payload.email !== 'string') {
    throw new Error('Invalid Firebase account token.');
  }
  return { uid: payload.sub, email: payload.email };
}

function parseServiceAccount(raw: string): { client_email: string; private_key: string; project_id: string } {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    try {
      const sanitized = raw.replace(/\\([^"\\/bfnrtu])/g, '$1');
      parsed = JSON.parse(sanitized);
    } catch {
      const emailMatch = raw.match(/"client_email"\s*:\s*"([^"]+)"/);
      const projectMatch = raw.match(/"project_id"\s*:\s*"([^"]+)"/);
      const keyMatch = raw.match(/"private_key"\s*:\s*"([^"]+)"/);
      if (emailMatch && projectMatch && keyMatch) {
        parsed = {
          client_email: emailMatch[1],
          project_id: projectMatch[1],
          private_key: keyMatch[1],
        };
      } else {
        throw new Error('Invalid Firebase service account format.');
      }
    }
  }
  let pk = String(parsed.private_key || '');
  if (pk.includes('\\n')) {
    pk = pk.replace(/\\n/g, '\n');
  }
  parsed.private_key = pk;
  return parsed;
}

async function serviceAccount(env: Env) {
  const account = parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (account.project_id !== env.FIREBASE_PROJECT_ID) throw new Error('Firebase service account project mismatch.');
  const key = await importPKCS8(account.private_key, 'RS256');
  const assertion = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/datastore',
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(account.client_email)
    .setSubject(account.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!tokenResponse.ok) throw new Error('Could not authorize Firebase service account.');
  const tokenBody = await tokenResponse.json() as { access_token?: string };
  if (!tokenBody.access_token) throw new Error('Firebase access token missing.');
  return { accessToken: tokenBody.access_token, account };
}

async function readFirebaseUser(env: Env, uid: string): Promise<Json> {
  const { accessToken } = await serviceAccount(env);
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${encodeURIComponent(uid)}`;
  const result = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (result.status === 404) throw new Error('MsikaFlo account not found.');
  if (!result.ok) throw new Error('Unable to verify MsikaFlo account status.');
  const document = await result.json() as { fields?: Record<string, any> };
  const fields = document.fields || {};
  const decode = (field: any): unknown => field?.booleanValue ?? field?.stringValue ?? field?.integerValue;
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decode(value)]));
}

async function createFirebaseCustomToken(env: Env, uid: string): Promise<string> {
  const { account } = await serviceAccount(env);
  const key = await importPKCS8(account.private_key, 'RS256');
  return new SignJWT({ uid })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(account.client_email)
    .setSubject(account.client_email)
    .setAudience('https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);
}

async function saveChallenge(env: Env, challenge: string, purpose: string, userId: string | null, webauthnUserId: string | null = null) {
  const id = randomId();
  // Automatically purge stale challenges older than 10 minutes to protect D1 storage
  try {
    await env.PASSKEYS_DB.prepare(
      'DELETE FROM challenges WHERE created_at < ?',
    ).bind(now() - 600).run();
  } catch {
    // Non-critical, ignore
  }

  await env.PASSKEYS_DB.prepare(
    'INSERT INTO challenges (challenge_id, challenge, user_id, webauthn_user_id, purpose, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(id, challenge, userId, webauthnUserId, purpose, now()).run();
  return id;
}

async function takeChallenge(env: Env, id: string, purpose: string, userId: string | null) {
  // A single DELETE ... RETURNING statement makes each challenge single-use even
  // when two verification requests arrive concurrently.
  const row = await env.PASSKEYS_DB.prepare(
    'DELETE FROM challenges WHERE challenge_id = ? AND purpose = ? AND user_id IS ? AND created_at >= ? RETURNING challenge, user_id, webauthn_user_id',
  ).bind(id, purpose, userId, now() - 300).first<{
    challenge: string; user_id: string | null; webauthn_user_id: string | null;
  }>();
  if (!row) throw new Error('Challenge expired or invalid. Please try again.');
  return row;
}

async function getUserPasskeys(env: Env, uid: string) {
  return env.PASSKEYS_DB.prepare(
    'SELECT credential_id, public_key, counter, transports, device_type, backed_up FROM passkeys WHERE user_id = ?',
  ).bind(uid).all<{
    credential_id: string; public_key: ArrayBuffer; counter: number;
    transports: string; device_type: string; backed_up: number;
  }>();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';

    if (request.method === 'OPTIONS') {
      if (origin && !isAllowedOrigin(origin, env)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: cors(request, env) });
    }
    if (origin && !isAllowedOrigin(origin, env)) {
      return response(request, env, { error: 'Origin not allowed.' }, 403);
    }

    const url = new URL(request.url);
    const webAuthnCfg = getWebAuthnConfig(request, env);

    try {
      if (url.pathname === '/health' && request.method === 'GET') {
        return response(request, env, { ok: true, service: 'msikaflo-passkeys' });
      }

      if (url.pathname === '/v1/register/options' && request.method === 'POST') {
        const identity = await verifyFirebaseIdToken(request, env);
        if (!checkRateLimit(`uid:reg_opt:${identity.uid}`, 10, 60)) {
          return response(request, env, { error: 'Too many registration requests. Please wait a minute.' }, 429);
        }
        const user = await readFirebaseUser(env, identity.uid);
        if (!accountIsUsable(user)) return response(request, env, { error: 'This account is inactive or suspended.' }, 403);
        const existing = await getUserPasskeys(env, identity.uid);
        const options = await generateRegistrationOptions({
          rpName: env.RP_NAME,
          rpID: webAuthnCfg.rpID,
          userID: new TextEncoder().encode(identity.uid),
          userName: identity.email,
          userDisplayName: identity.email,
          attestationType: 'none',
          excludeCredentials: existing.results.map((item) => ({
            id: item.credential_id,
            transports: JSON.parse(item.transports),
          })),
          authenticatorSelection: {
            residentKey: 'preferred',
            userVerification: 'required',
          },
          supportedAlgorithmIDs: [-7, -257],
        });
        const challengeId = await saveChallenge(env, options.challenge, 'registration', identity.uid, options.user.id);
        return response(request, env, { options, challengeId });
      }

      if (url.pathname === '/v1/register/verify' && request.method === 'POST') {
        const identity = await verifyFirebaseIdToken(request, env);
        if (!checkRateLimit(`uid:reg_ver:${identity.uid}`, 10, 60)) {
          return response(request, env, { error: 'Too many registration verification attempts. Please wait a minute.' }, 429);
        }
        const user = await readFirebaseUser(env, identity.uid);
        if (!accountIsUsable(user)) return response(request, env, { error: 'This account is inactive or suspended.' }, 403);
        const input = await body(request);
        const challengeId = String(input.challengeId || '');
        const pending = await takeChallenge(env, challengeId, 'registration', identity.uid);
        const verification = await verifyRegistrationResponse({
          response: input.credential as any,
          expectedChallenge: pending.challenge,
          expectedOrigin: webAuthnCfg.expectedOrigin,
          expectedRPID: webAuthnCfg.rpID,
        });
        if (!verification.verified || !verification.registrationInfo) {
          return response(request, env, { error: 'Passkey registration could not be verified.' }, 400);
        }
        const info = verification.registrationInfo;
        const credential = info.credential;
        const transports = (input.credential as any)?.response?.transports || [];
        const deviceName = String(input.deviceName || 'This device').slice(0, 80);
        await env.PASSKEYS_DB.prepare(
          `INSERT INTO passkeys
          (credential_id, user_id, user_email, webauthn_user_id, public_key, counter, transports, device_type, backed_up, device_name, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          credential.id, identity.uid, identity.email.trim().toLowerCase(), pending.webauthn_user_id,
          credential.publicKey, credential.counter, JSON.stringify(transports),
          info.credentialDeviceType, info.credentialBackedUp ? 1 : 0, deviceName, now(),
        ).run();
        return response(request, env, { verified: true });
      }

      if (url.pathname === '/v1/auth/options' && request.method === 'POST') {
        if (!checkRateLimit(`ip:auth_opt:${clientIp}`, 20, 60)) {
          return response(request, env, { error: 'Too many requests. Please wait a minute and try again.' }, 429);
        }
        const input = await body(request);
        const email = String(input.email || '').trim().toLowerCase();
        if (!email) return response(request, env, { error: 'Enter your email address first.' }, 400);
        if (!checkRateLimit(`email:auth_opt:${email}`, 5, 60)) {
          return response(request, env, { error: 'Too many sign-in attempts for this email. Please wait a minute.' }, 429);
        }

        const rows = await env.PASSKEYS_DB.prepare(
          'SELECT credential_id, transports FROM passkeys WHERE user_email = ?',
        ).bind(email).all<{ credential_id: string; transports: string }>();
        if (!rows.results.length) return response(request, env, { error: 'No passkey is registered for this email address.' }, 404);
        const options = await generateAuthenticationOptions({
          rpID: webAuthnCfg.rpID,
          allowCredentials: rows.results.map((item) => ({
            id: item.credential_id,
            transports: JSON.parse(item.transports),
          })),
          userVerification: 'required',
        });
        const challengeId = await saveChallenge(env, options.challenge, 'authentication', null);
        return response(request, env, { options, challengeId });
      }

      if (url.pathname === '/v1/auth/verify' && request.method === 'POST') {
        if (!checkRateLimit(`ip:auth_ver:${clientIp}`, 15, 60)) {
          return response(request, env, { error: 'Too many verification attempts. Please wait a minute.' }, 429);
        }
        const input = await body(request);
        const challengeId = String(input.challengeId || '');
        const credentialInput = input.credential as any;
        const credentialId = String(credentialInput?.id || '');
        if (!credentialId) return response(request, env, { error: 'Invalid passkey response.' }, 400);
        const row = await env.PASSKEYS_DB.prepare(
          'SELECT * FROM passkeys WHERE credential_id = ?',
        ).bind(credentialId).first<any>();
        if (!row) return response(request, env, { error: 'Passkey not recognized.' }, 401);
        const pending = await takeChallenge(env, challengeId, 'authentication', null);
        const verification = await verifyAuthenticationResponse({
          response: credentialInput,
          expectedChallenge: pending.challenge,
          expectedOrigin: webAuthnCfg.expectedOrigin,
          expectedRPID: webAuthnCfg.rpID,
          credential: {
            id: row.credential_id,
            publicKey: new Uint8Array(row.public_key),
            counter: Number(row.counter),
            transports: JSON.parse(row.transports),
          },
        });
        if (!verification.verified) return response(request, env, { error: 'Passkey verification failed.' }, 401);
        const user = await readFirebaseUser(env, row.user_id);
        if (!accountIsUsable(user)) return response(request, env, { error: 'This account is inactive or suspended.' }, 403);
        const customToken = await createFirebaseCustomToken(env, row.user_id);
        await env.PASSKEYS_DB.prepare(
          'UPDATE passkeys SET counter = ?, last_used_at = ? WHERE credential_id = ?',
        ).bind(verification.authenticationInfo.newCounter, now(), credentialId).run();
        return response(request, env, { verified: true, customToken });
      }

      if (url.pathname === '/v1/credentials' && request.method === 'GET') {
        const identity = await verifyFirebaseIdToken(request, env);
        const rows = await env.PASSKEYS_DB.prepare(
          'SELECT credential_id, device_name, device_type, backed_up, created_at, last_used_at FROM passkeys WHERE user_id = ? ORDER BY created_at DESC',
        ).bind(identity.uid).all();
        return response(request, env, { credentials: rows.results });
      }

      if (url.pathname.startsWith('/v1/credentials/') && request.method === 'DELETE') {
        const identity = await verifyFirebaseIdToken(request, env);
        const credentialId = decodeURIComponent(url.pathname.split('/').pop() || '');
        const result = await env.PASSKEYS_DB.prepare(
          'DELETE FROM passkeys WHERE credential_id = ? AND user_id = ?',
        ).bind(credentialId, identity.uid).run();
        if (!result.meta.changes) return response(request, env, { error: 'Passkey not found.' }, 404);
        return response(request, env, { removed: true });
      }

      return response(request, env, { error: 'Not found.' }, 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error.';
      return response(request, env, { error: message }, 400);
    }
  },
};
