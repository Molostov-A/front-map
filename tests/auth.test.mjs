import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './module-harness.mjs';

function setup() {
  const nodes = new Map(); let user = { username: 'previous', role: 'admin' }, token = null, reloads = 0;
  const classes = new Set();
  const node = (id) => {
    if (!nodes.has(id)) nodes.set(id, {
      value: '', style: {}, textContent: '', listeners: {},
      classList: { add: (c) => classes.add(id + c), remove: (c) => classes.delete(id + c) },
      addEventListener(event, fn) { this.listeners[event] = fn; }
    });
    return nodes.get(id);
  };
  const bindings = {
    $: node, currentUser: user, canEdit: () => user && user.role !== 'viewer',
    getToken: () => token, setToken: (t) => { token = t; },
    setCurrentUser: (u) => { user = u; bindings.currentUser = u; },
    document: { body: { classList: { toggle: (c, on) => on ? classes.add(c) : classes.delete(c) } } },
    window: { location: { reload: () => reloads++ } },
    api: { send: async () => ({ token: 'new-session', user: { username: 'viewer', role: 'viewer' } }) }
  };
  const mod = loadModule('../src/ui/auth.js', bindings);
  mod.initLoginForm();
  return { ...mod, node, classes, reloads: () => reloads, user: () => user, token: () => token,
    submit: () => node('#login-card').listeners.submit({ preventDefault() {} }) };
}

test('первый вход завершает ensureAuth без повторной загрузки страницы', async () => {
  const x = setup(); const ready = x.ensureAuth();
  assert.equal(x.user(), null); assert.equal(x.classes.has('readonly'), true);
  await x.submit(); assert.equal((await ready).username, 'viewer');
  assert.equal(x.reloads(), 0); assert.equal(x.token(), 'new-session');
  assert.equal(x.classes.has('#login-backshow'), false);
});

test('повторный вход очищает старую роль и перезапускает приложение с новой сессией', async () => {
  const x = setup(); x.showLogin();
  assert.equal(x.node('#ub-name').textContent, '—');
  assert.equal(x.node('#btn-users').style.display, 'none');
  await x.submit();
  assert.equal(x.reloads(), 1); assert.equal(x.user().role, 'viewer');
  assert.equal(x.token(), 'new-session');
});
