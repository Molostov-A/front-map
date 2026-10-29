// HTTP-клиент API: базовый адрес (config.js), Bearer-токен в localStorage, 401 → hooks.unauthorized.
import { hooks } from './hooks.js';

export const API_BASE = String(window.__FM_API_BASE || '').replace(/\/$/, '');

export const TOKEN_KEY = 'fm_token';

export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } };

export const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ } };

export const authHeaders = (base) => {
  const h = Object.assign({}, base);
  const t = getToken();
  if (t) h.Authorization = 'Bearer ' + t;
  return h;
};

export const api = {
  async get(u) {
    const r = await fetch(API_BASE + u, { headers: authHeaders() });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 401) { setToken(null); hooks.unauthorized(); }
      throw new Error(j.error || r.status);
    }
    return j;
  },
  async send(m, u, b) {
    const r = await fetch(API_BASE + u, {
      method: m,
      headers: authHeaders(b ? { 'Content-Type': 'application/json' } : {}),
      body: b ? JSON.stringify(b) : undefined
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 401) { setToken(null); hooks.unauthorized(); }
      const err = new Error(j.error || r.status);
      err.status = r.status;
      throw err;
    }
    return j;
  }
};
