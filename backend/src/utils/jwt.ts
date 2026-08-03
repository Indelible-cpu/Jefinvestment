/**
 * Edge-compatible JWT utility using the Web Crypto API.
 * This replaces the Node-only `jsonwebtoken` package for Cloudflare Workers.
 */

function base64url(str: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(str)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64urlDecode(str: string) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

async function getCryptoKey(secret: string, usage: KeyUsage[]) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usage
  );
}

export async function sign(payload: object, secret: string, expiresIn = '1d'): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);

  // Parse expiresIn (supports '1d', '7d', '24h', '3600')
  let exp = now + 86400; // default 1d
  if (typeof expiresIn === 'string') {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (match) {
      const num = parseInt(match[1]);
      const unit = match[2];
      const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
      exp = now + num * multipliers[unit];
    }
  }

  const enc = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify({ ...payload, iat: now, exp })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const data = `${headerB64}.${payloadB64}`;
  const key = await getCryptoKey(secret, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));

  return `${data}.${base64url(sig)}`;
}

export async function verify(token: string, secret: string): Promise<any> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');

  const [headerB64, payloadB64, sigB64] = parts;
  const enc = new TextEncoder();

  const key = await getCryptoKey(secret, ['verify']);
  const sigBuf = Uint8Array.from(base64urlDecode(sigB64), (c) => c.charCodeAt(0));
  const valid = await crypto.subtle.verify('HMAC', key, sigBuf, enc.encode(`${headerB64}.${payloadB64}`));

  if (!valid) throw new Error('Invalid signature');

  const payload = JSON.parse(base64urlDecode(payloadB64));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');

  return payload;
}
