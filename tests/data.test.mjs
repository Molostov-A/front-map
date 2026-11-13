import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadModule, deferred } from './module-harness.mjs';

const tick = () => new Promise((r) => setImmediate(r));
function setup(editor = true) {
  let day = '2026-11-13', renders = 0;
  const gets = [], posts = [];
  const state = { layers: [], features: [], selectedId: null };
  const mod = loadModule('../src/data.js', {
    hooks: { mapChanged() {} }, state, currentDay: () => day, canEdit: () => editor, viewerVisibility: new Map([[1, false]]),
    api: {
      get: () => { const d = deferred(); gets.push(d); return d.promise; },
      send: () => { const d = deferred(); posts.push(d); return d.promise; }
    },
    resetPolygonOperations() {}, rebuildStyle: () => renders++, updateDatesPanel() {}, renderLayerList() {}, updateStylePanels() {}
  });
  return { ...mod, state, gets, posts, renders: () => renders, day: (d) => { day = d; } };
}
const map = (day) => ({ layers: [{ id: 1, visible: true }], features: [{ id: 1, day }] });

test('reload игнорирует старый ответ и старую ошибку при обратном порядке завершения', async () => {
  for (const fail of [false, true]) {
    const x = setup(); const a = x.reload(); x.day('2026-11-14'); const b = x.reload();
    x.gets[1].resolve(map('new')); await b;
    if (fail) x.gets[0].reject(new Error('stale error')); else x.gets[0].resolve(map('old'));
    await a;
    assert.equal(x.state.features[0].day, 'new'); assert.equal(x.renders(), 1);
  }
});

test('смена дня без нового reload запрещает применение ответа и создание слоя', async () => {
  const x = setup(); const p = x.reload(); x.day('2026-11-14');
  x.gets[0].resolve({ layers: [], features: [] }); await p;
  assert.equal(x.posts.length, 0); assert.equal(x.renders(), 0);
});

test('параллельные загрузки пустой карты создают один слой и применяют только последний снимок', async () => {
  const x = setup(); const a = x.reload(); x.gets[0].resolve({ layers: [], features: [] }); await tick();
  const b = x.reload(); x.gets[1].resolve({ layers: [], features: [] }); await tick();
  assert.equal(x.posts.length, 1);
  x.posts[0].resolve({ id: 1 }); await tick();
  assert.equal(x.gets.length, 3);
  x.gets[2].resolve(map('current')); await a; await b;
  assert.equal(x.renders(), 1);
});

test('смена даты во время повторного GET не применяет его результат', async () => {
  const x = setup(); const p = x.reload(); x.gets[0].resolve({ layers: [], features: [] }); await tick();
  x.posts[0].resolve({ id: 1 }); await tick(); x.day('2026-11-14');
  x.gets[1].resolve(map('old')); await p; assert.equal(x.renders(), 0);
});

test('viewer не создаёт слой, сохраняет локальную видимость; актуальная ошибка пробрасывается', async () => {
  const x = setup(false); const a = x.reload(); x.gets[0].resolve({ layers: [], features: [] }); await a;
  assert.equal(x.posts.length, 0);
  const b = x.reload(); x.gets[1].resolve(map('current')); await b;
  assert.equal(x.state.layers[0].visible, false);
  const c = x.reload(); x.gets[2].reject(new Error('network')); await assert.rejects(c, /network/);
});
