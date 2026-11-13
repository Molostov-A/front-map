import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadModule, deferred } from './module-harness.mjs';

const tick = () => new Promise((r) => setImmediate(r));
function setup() {
  let day = '2026-11-13';
  const f = { id: 1, properties: { color: 'initial', label: { size: 12 } }, geometry: { type: 'Point', coordinates: [1, 2] } };
  const state = { features: [f], selectedId: 1 };
  const calls = [], timers = new Map(), errors = [];
  let timer = 0;
  const mod = loadModule('../src/edit/sync.js', {
    state, currentDay: () => day, canEdit: () => true, structuredClone,
    api: { send: (method, url, body) => { const d = deferred(); calls.push({ method, url, body, ...d }); return d.promise; } },
    setTimeout: (fn) => { timers.set(++timer, fn); return timer; },
    clearTimeout: (id) => timers.delete(id), toast: (s) => errors.push(s),
    refreshSources() {}, refreshDates() {}, updateDatesPanel() {},
    hooks: { reload: async () => {} }, askDelete: async () => null
  });
  return { ...mod, f, state, calls, timers, errors, setDay: (d) => { day = d; } };
}

test('PUT одного объекта последовательны; старый ответ не откатывает новую правку', async () => {
  const x = setup();
  x.scheduleArrowPut(x.f);
  const first = x.sendPendingPut(1);
  await tick();
  x.f.properties.color = 'new';
  x.scheduleArrowPut(x.f);
  const second = x.sendPendingPut(1);
  await tick();
  assert.equal(x.calls.length, 1);
  x.calls[0].resolve({ id: 1, properties: { color: 'old' } });
  await first; await tick();
  assert.equal(x.state.features[0].properties.color, 'new');
  assert.equal(x.calls.length, 2);
  x.calls[1].resolve({ id: 1, properties: { color: 'new-normalized' } });
  await second;
  assert.equal(x.state.features[0].properties.color, 'new-normalized');
});

test('геометрия и стиль используют одну очередь и независимые снимки', async () => {
  const x = setup();
  const first = x.putArrowGeometry(x.f); await tick();
  x.f.geometry.coordinates[0] = 5;
  x.f.properties.label.size = 20;
  const second = x.putArrowGeometry(x.f); await tick();
  assert.equal(x.calls[0].body.geometry.coordinates[0], 1);
  assert.equal(x.calls[0].body.properties.label.size, 12);
  x.calls[0].resolve({ id: 1 }); await first; await tick();
  assert.equal(x.calls[1].body.geometry.coordinates[0], 5);
  x.calls[1].resolve({ id: 1 }); await second;
});

test('разные дни не отменяют ожидающие правки; ответ другого дня не применяется', async () => {
  const x = setup(); x.scheduleArrowPut(x.f);
  x.setDay('2026-11-14'); x.scheduleArrowPut(x.f);
  assert.equal(x.pendingPuts.size, 2);
  const p = x.sendPendingPut(1, '2026-11-13'); await tick();
  x.calls[0].resolve({ id: 1, properties: { color: 'wrong-day' } }); await p;
  assert.equal(x.state.features[0].properties.color, 'initial');
  assert.equal(x.pendingPuts.size, 1);
});

test('reload и активное перетаскивание защищены от ответа PUT', async () => {
  for (const kind of ['reload', 'drag']) {
    const x = setup(); const p = x.putArrowGeometry(x.f); await tick();
    if (kind === 'reload') x.state.features = [structuredClone(x.f)];
    else x.state.drag = { featureId: 1 };
    x.calls[0].resolve({ id: 1, properties: { color: 'stale' } }); await p;
    assert.equal(x.state.features[0].properties.color, 'initial');
  }
});

test('ошибка PUT не блокирует очередь; другие объекты сохраняются независимо', async () => {
  const x = setup(); const a = x.putArrowGeometry(x.f); await tick();
  const b = x.putArrowGeometry(x.f);
  const c = x.putArrowGeometry({ ...x.f, id: 2 }); await tick();
  assert.equal(x.calls.length, 2);
  x.calls[0].reject(new Error('network')); x.calls[1].resolve({ id: 2 });
  await a; await c; await tick();
  assert.equal(x.calls.length, 3);
  x.calls[2].resolve({ id: 1 }); await b;
  assert.equal(x.errors.length, 1);
});
