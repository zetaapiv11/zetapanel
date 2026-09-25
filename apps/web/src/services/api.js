import { useAuthStore } from '../stores/authStore.js';

const BASE = (import.meta.env.VITE_API_URL || '') + '/api';

async function request(path, { method = 'GET', body, query, retry = true } = {}) {
  const url = new URL(BASE + path, window.location.origin);
  if (query) Object.entries(query).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, v));

  const token = useAuthStore.getState().accessToken;

  const res = await fetch(url.toString().replace(window.location.origin, ''), {
    method,
    credentials: 'include',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry && path !== '/auth/refresh') {
    const refreshed = await useAuthStore.getState().refresh();
    if (refreshed) return request(path, { method, body, query, retry: false });
  }

  const data = await res.json().catch(() => ({}));
    if (!res.ok) {
    let msg = data?.error?.message || `Request failed (${res.status})`;
    if (data?.error?.details?.length) {
      msg += ': ' + data.error.details.map((d) => `${d.path}: ${d.message}`).join(', ');
    }
    const err = new Error(msg);
    err.status = res.status;
    err.details = data?.error;
    throw err;
  }

export const api = {
  get: (path, query) => request(path, { query }),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path, body) => request(path, { method: 'DELETE', body }),
};
