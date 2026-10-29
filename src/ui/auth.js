// Вход, блок пользователя (выход, роль), модалка управления пользователями (admin).
import { api, getToken, setToken } from '../core/api.js';
import { canEdit, currentUser, setCurrentUser } from '../core/session.js';
import { $ } from '../core/util.js';

export let loginResolve = null;

export function showLogin() {
  const back = $('#login-back');
  if (back) back.classList.add('show');
}

export function hideLogin() {
  const back = $('#login-back');
  if (back) back.classList.remove('show');
}

export function initLoginForm() {
  const form = $('#login-card');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = $('#login-error');
    const btn = $('#login-submit');
    if (errEl) errEl.textContent = '';
    if (btn) btn.disabled = true;
    try {
      const r = await api.send('POST', '/api/auth/login', {
        username: $('#login-user').value,
        password: $('#login-pass').value
      });
      setToken(r.token);
      setCurrentUser(r.user);
      $('#login-pass').value = '';
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
  const el = $('#users-error');
  if (el) el.textContent = msg || '';
}

export function updateUserBox() {
  const nameEl = $('#ub-name');
  const roleEl = $('#ub-role');
  const usersBtn = $('#btn-users');
  document.body.classList.toggle('readonly', !canEdit());
  if (nameEl) nameEl.textContent = currentUser ? currentUser.username : '—';
  if (roleEl) roleEl.textContent = currentUser ? '(' + currentUser.role + ')' : '';
  if (usersBtn) usersBtn.style.display = currentUser && currentUser.role === 'admin' ? '' : 'none';
  const logout = $('#btn-logout');
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
      $('#users-back').classList.add('show');
      renderUsers();
    });
  }
}

export async function renderUsers() {
  const list = $('#users-list');
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
  const close = $('#users-close');
  if (close) close.addEventListener('click', () => $('#users-back').classList.remove('show'));
  const back = $('#users-back');
  if (back) back.addEventListener('click', (e) => { if (/** @type {HTMLElement} */ (e.target).id === 'users-back') back.classList.remove('show'); });
  const form = $('#users-add');
  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setUsersError('');
    try {
      await api.send('POST', '/api/users', {
        username: $('#users-new-name').value,
        password: $('#users-new-pass').value,
        role: $('#users-new-role').value
      });
      $('#users-new-name').value = '';
      $('#users-new-pass').value = '';
      await renderUsers();
    } catch (err) { setUsersError(err.message); }
  });
}

// Стили объектов: значения по умолчанию и нормализация — в shared/feature-schema.mjs.
