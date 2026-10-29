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

function cors(request: Request, env: Env): Headers {
  const origin = request.headers.get('Origin');
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
  });
  if (origin === env.EXPECTED_ORIGIN) headers.set('Access-Control-Allow-Origin', origin);
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

async function serviceAccount(env: Env) {
  const account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON) as {
    client_email: string; private_key: string; project_id: string;
  };
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

async function saveChallenge(env: Env, challenge: string, purpose: string, userId: string | null) {
  const id = randomId();
  await env.PASSKEYS_DB.prepare(
    'INSERT INTO challenges (challenge_id, challenge, user_id, purpose, created_at) VALUES (?, ?, ?, ?, ?)',
  ).bind(id, challenge, userId, purpose, now()).run();
  return id;
}
async function takeChallenge(env: Env, id: string, purpose: string, userId: string | null) {
  const row = await env.PASSKEYS_DB.prepare(
    'SELECT challenge, user_id FROM challenges WHERE challenge_id = ? AND purpose = ? AND created_at >= ?',
  ).bind(id, purpose, now() - 300).first<{ challenge: string; user_id: string | null }>();
  await env.PASSKEYS_DB.prepare('DELETE FROM challenges WHERE challenge_id = ?').bind(id).run();
  if (!row || row.user_id !== userId) throw new Error('Challenge expired or invalid. Please try again.');
  return row.challenge;
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
    if (request.method === 'OPTIONS') {
      if (origin !== env.EXPECTED_ORIGIN) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: cors(request, env) });
    }
    if (origin && origin !== env.EXPECTED_ORIGIN) return response(request, env, { error: 'Origin not allowed.' }, 403);
    const url = new URL(request.url);
    try {
      if (url.pathname === '/health' && request.method === 'GET') {
        return response(request, env, { ok: true, service: 'msikaflo-passkeys' });
      }

      if (url.pathname === '/v1/register/options' && request.method === 'POST') {
        const identity = await verifyFirebaseIdToken(request, env);
        const user = await readFirebaseUser(env, identity.uid);
        if (!accountIsUsable(user)) return response(request, env, { error: 'This account is inactive or suspended.' }, 403);
        const existing = await getUserPasskeys(env, identity.uid);
        const options = await generateRegistrationOptions({
          rpName: env.RP_NAME,
          rpID: env.RP_ID,
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
        const challengeId = await saveChallenge(env, options.challenge, 'registration', identity.uid);
        return response(request, env, { options, challengeId });
      }

      if (url.pathname === '/v1/register/verify' && request.method === 'POST') {
        const identity = await verifyFirebaseIdToken(request, env);
        const user = await readFirebaseUser(env, identity.uid);
        if (!accountIsUsable(user)) return response(request, env, { error: 'This account is inactive or suspended.' }, 403);
        const input = await body(request);
        const challengeId = String(input.challengeId || '');
        const expectedChallenge = await takeChallenge(env, challengeId, 'registration', identity.uid);
        const verification = await verifyRegistrationResponse({
          response: input.credential as any,
          expectedChallenge,
          expectedOrigin: env.EXPECTED_ORIGIN,
          expectedRPID: env.RP_ID,
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
          credential.id, identity.uid, identity.email, optionsUserId(identity.uid),
          credential.publicKey, credential.counter, JSON.stringify(transports),
          info.credentialDeviceType, info.credentialBackedUp ? 1 : 0, deviceName, now(),
        ).run();
        return response(request, env, { verified: true });
      }

      if (url.pathname === '/v1/auth/options' && request.method === 'POST') {
        const input = await body(request);
        const email = String(input.email || '').trim().toLowerCase();
        if (!email) return response(request, env, { error: 'Enter your email address first.' }, 400);
        const rows = await env.PASSKEYS_DB.prepare(
          'SELECT credential_id, transports FROM passkeys WHERE user_email = ?',
        ).bind(email).all<{ credential_id: string; transports: string }>();
        if (!rows.results.length) return response(request, env, { error: 'No passkey is registered for this email address.' }, 404);
        const options = await generateAuthenticationOptions({
          rpID: env.RP_ID,
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
        const input = await body(request);
        const challengeId = String(input.challengeId || '');
        const credentialInput = input.credential as any;
        const credentialId = String(credentialInput?.id || '');
        if (!credentialId) return response(request, env, { error: 'Invalid passkey response.' }, 400);
        const row = await env.PASSKEYS_DB.prepare(
          'SELECT * FROM passkeys WHERE credential_id = ?',
        ).bind(credentialId).first<any>();
        if (!row) return response(request, env, { error: 'Passkey not recognized.' }, 401);
        const expectedChallenge = await takeChallenge(env, challengeId, 'authentication', null);
        const verification = await verifyAuthenticationResponse({
          response: credentialInput,
          expectedChallenge,
          expectedOrigin: env.EXPECTED_ORIGIN,
          expectedRPID: env.RP_ID,
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

function optionsUserId(uid: string): string {
  return uid;
}
