/**
 * Centralized API client for the Jef ERP backend.
 * Automatically attaches JWT tokens and handles 401 logouts.
 */

const WORKER_URL = 'https://jef-erp-backend.dicksonpetroj1.workers.dev';
const BASE_URL = import.meta.env.VITE_API_BASE_URL || WORKER_URL;

function getToken(): string | null {
  try {
    const raw = localStorage.getItem('jef-auth-storage');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    // Clear auth and redirect to login
    localStorage.removeItem('jef-auth-storage');
    window.location.href = '/login';
    throw new Error('Session expired. Please log in again.');
  }

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json?.message || `Request failed: ${res.status}`);
  }

  return json;
}

export const api = {
  get:    <T>(path: string) => request<T>('GET', path),
  post:   <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put:    <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

export default api;
