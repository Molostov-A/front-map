// Вход, блок пользователя (выход, роль), модалка управления пользователями (admin).
import { api, getToken, setToken } from '../core/api.js';
import { canEdit, currentUser, setCurrentUser } from '../core/session.js';

export let loginResolve = null;

export function showLogin() {
  const back = document.getElementById('login-back');
  if (back) back.classList.add('show');
}

export function hideLogin() {
  const back = document.getElementById('login-back');
  if (back) back.classList.remove('show');
}

export function initLoginForm() {
  const form = document.getElementById('login-card');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('login-error');
    const btn = document.getElementById('login-submit');
    if (errEl) errEl.textContent = '';
    if (btn) btn.disabled = true;
    try {
      const r = await api.send('POST', '/api/auth/login', {
        username: document.getElementById('login-user').value,
        password: document.getElementById('login-pass').value
      });
      setToken(r.token);
      setCurrentUser(r.user);
      document.getElementById('login-pass').value = '';
      hideLogin();
      if (loginResolve) { const f = loginResolve; loginResolve = null; f(r.user); }
    } catch (err) {
      if (errEl) errEl.textContent = 'Неверный логин или пароль';
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

// Гарантирует авторизацию: возвращает пользователя, показав форму входа при необходимости.
// Гарантирует авторизацию: возвращает пользователя, показав форму входа при необходимости.
export async function ensureAuth() {
  if (getToken()) {
    try {
      const r = await api.get('/api/auth/me');
      if (r && r.user) { setCurrentUser(r.user); return r.user; }
    } catch (e) { /* не авторизован */ }
    setToken(null);
  }
  showLogin();
  return new Promise((resolve) => { loginResolve = resolve; });
}

export function setUsersError(msg) {
  const el = document.getElementById('users-error');
  if (el) el.textContent = msg || '';
}

export function updateUserBox() {
  const nameEl = document.getElementById('ub-name');
  const roleEl = document.getElementById('ub-role');
  const usersBtn = document.getElementById('btn-users');
  document.body.classList.toggle('readonly', !canEdit());
  if (nameEl) nameEl.textContent = currentUser ? currentUser.username : '—';
  if (roleEl) roleEl.textContent = currentUser ? '(' + currentUser.role + ')' : '';
  if (usersBtn) usersBtn.style.display = currentUser && currentUser.role === 'admin' ? '' : 'none';
  const logout = document.getElementById('btn-logout');
  if (logout && !logout.__wired) {
    logout.__wired = true;
    logout.addEventListener('click', async () => {
      try { await api.send('POST', '/api/auth/logout'); } catch (e) { /* ignore */ }
      setToken(null);
      window.location.reload();
    });
  }
  if (usersBtn && !usersBtn.__wired) {
    usersBtn.__wired = true;
    usersBtn.addEventListener('click', () => {
      document.getElementById('users-back').classList.add('show');
      renderUsers();
    });
  }
}

export async function renderUsers() {
  const list = document.getElementById('users-list');
  if (!list) return;
  list.innerHTML = '';
  let users = [];
  try { users = await api.get('/api/users'); } catch (e) { setUsersError(e.message); return; }
  for (const u of users) {
    const row = document.createElement('div');
    row.className = 'users-row';
    const nm = document.createElement('span');
    nm.className = 'u-nm'; nm.textContent = u.username;
    const rl = document.createElement('span');
    rl.className = 'u-rl'; rl.textContent = u.role;
    const del = document.createElement('button');
    del.className = 'icon-btn'; del.textContent = '🗑'; del.title = 'Удалить';
    if (currentUser && u.id === currentUser.id) del.disabled = true;
    del.onclick = async () => {
      try { await api.send('DELETE', '/api/users/' + u.id); await renderUsers(); }
      catch (e) { setUsersError(e.message); }
    };
    row.append(nm, rl, del);
    list.append(row);
  }
}

export function initUsersModal() {
  const close = document.getElementById('users-close');
  if (close) close.addEventListener('click', () => document.getElementById('users-back').classList.remove('show'));
  const back = document.getElementById('users-back');
  if (back) back.addEventListener('click', (e) => { if (e.target.id === 'users-back') back.classList.remove('show'); });
  const form = document.getElementById('users-add');
  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setUsersError('');
    try {
      await api.send('POST', '/api/users', {
        username: document.getElementById('users-new-name').value,
        password: document.getElementById('users-new-pass').value,
        role: document.getElementById('users-new-role').value
      });
      document.getElementById('users-new-name').value = '';
      document.getElementById('users-new-pass').value = '';
      await renderUsers();
    } catch (err) { setUsersError(err.message); }
  });
}

// Стили объектов: значения по умолчанию и нормализация — в shared/feature-schema.mjs.
