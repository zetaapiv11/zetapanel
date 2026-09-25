import { create } from 'zustand';

export const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  initialized: false,

  async login(email, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || 'Login failed');
    set({ user: data.user, accessToken: data.accessToken, initialized: true });
    return data.user;
  },

  async register(email, password) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || 'Registration failed');
    set({ user: data.user, accessToken: data.accessToken, initialized: true });
    return data.user;
  },

  async refresh() {
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error('refresh failed');
      const data = await res.json();
      set({ user: data.user, accessToken: data.accessToken, initialized: true });
      return true;
    } catch {
      set({ user: null, accessToken: null, initialized: true });
      return false;
    }
  },

  async logout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    set({ user: null, accessToken: null });
  },
}));
