const API_URL = (import.meta.env.VITE_PASSKEY_API_URL || '').replace(/\/$/, '');

export function passkeysAvailable() {
  return !!API_URL && typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials;
}

export interface DeviceBiometricInfo {
  type: 'android' | 'ios' | 'windows' | 'mac' | 'generic';
  label: string;
  shortLabel: string;
  defaultDeviceName: string;
}

export function getDeviceBiometricInfo(): DeviceBiometricInfo {
  if (typeof navigator === 'undefined') {
    return {
      type: 'generic',
      label: 'Sign in with biometric / passkey',
      shortLabel: 'Biometric / PIN',
      defaultDeviceName: 'This device',
    };
  }
  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isWindows = /Windows/i.test(ua);
  const isMac = /Macintosh|Mac OS X/i.test(ua) && !isIOS;

  if (isAndroid) {
    return {
      type: 'android',
      label: 'Sign in with Face / Fingerprint',
      shortLabel: 'Face / Fingerprint',
      defaultDeviceName: 'Android (Face / Fingerprint)',
    };
  }
  if (isIOS) {
    return {
      type: 'ios',
      label: 'Sign in with Face ID / Touch ID',
      shortLabel: 'Face ID / Touch ID',
      defaultDeviceName: 'iPhone / iPad (Face ID / Touch ID)',
    };
  }
  if (isWindows) {
    return {
      type: 'windows',
      label: 'Sign in with Windows Hello (Face / PIN)',
      shortLabel: 'Windows Hello (Face / PIN)',
      defaultDeviceName: 'Windows PC (Hello Face / PIN)',
    };
  }
  if (isMac) {
    return {
      type: 'mac',
      label: 'Sign in with Touch ID / Passkey',
      shortLabel: 'Touch ID / Passkey',
      defaultDeviceName: 'Mac (Touch ID / Passkey)',
    };
  }
  return {
    type: 'generic',
    label: 'Sign in with Biometrics (Face / Fingerprint)',
    shortLabel: 'Face / Fingerprint',
    defaultDeviceName: 'This device',
  };
}

const decode = (value: string): ArrayBuffer => {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '='));
  return Uint8Array.from(binary, c => c.charCodeAt(0)).buffer;
};
const encode = (value: ArrayBuffer): string => {
  let binary = '';
  new Uint8Array(value).forEach(b => binary += String.fromCharCode(b));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

async function api<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  if (!API_URL) throw new Error('Passkey service is not configured.');
  const response = await fetch(API_URL + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...init.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Passkey request failed.');
  return data as T;
}

export async function authenticateWithPasskey(email: string): Promise<string> {
  const { options, challengeId } = await api<{options:any; challengeId:string}>('/v1/auth/options', {
    method: 'POST', body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
  const credential = await navigator.credentials.get({ publicKey: {
    ...options, challenge: decode(options.challenge),
    allowCredentials: options.allowCredentials?.map((item:any) => ({...item, id:decode(item.id)})),
  }}) as PublicKeyCredential | null;
  if (!credential) throw new Error('Passkey sign-in was cancelled.');
  const r = credential.response as AuthenticatorAssertionResponse;
  const serialized = {
    id: credential.id, rawId: encode(credential.rawId), type: credential.type,
    response: {
      clientDataJSON: encode(r.clientDataJSON), authenticatorData: encode(r.authenticatorData),
      signature: encode(r.signature), userHandle: r.userHandle ? encode(r.userHandle) : null,
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  };
  const result = await api<{customToken:string}>('/v1/auth/verify', {
    method: 'POST', body: JSON.stringify({ challengeId, credential: serialized }),
  });
  return result.customToken;
}

export async function registerPasskey(token: string, deviceName: string): Promise<void> {
  const { options, challengeId } = await api<{options:any; challengeId:string}>('/v1/register/options', {method:'POST'}, token);
  const credential = await navigator.credentials.create({ publicKey: {
    ...options, challenge: decode(options.challenge),
    user: {...options.user, id: decode(options.user.id)},
    excludeCredentials: options.excludeCredentials?.map((item:any) => ({...item,id:decode(item.id)})),
  }}) as PublicKeyCredential | null;
  if (!credential) throw new Error('Passkey registration was cancelled.');
  const r = credential.response as AuthenticatorAttestationResponse;
  const serialized = {
    id: credential.id, rawId: encode(credential.rawId), type: credential.type,
    response: { clientDataJSON: encode(r.clientDataJSON), attestationObject: encode(r.attestationObject), transports: r.getTransports?.() || [] },
    clientExtensionResults: credential.getClientExtensionResults(),
  };
  await api('/v1/register/verify', {
    method:'POST', body:JSON.stringify({challengeId,credential:serialized,deviceName:deviceName.trim().slice(0,80)||'This device'}),
  }, token);
}

export async function listPasskeys(token: string): Promise<any[]> {
  const result = await api<{credentials:any[]}>('/v1/credentials', {}, token);
  return result.credentials || [];
}
export async function removePasskey(token: string, id: string): Promise<void> {
  await api('/v1/credentials/' + encodeURIComponent(id), {method:'DELETE'}, token);
}
