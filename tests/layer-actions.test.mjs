import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadModule, deferred } from './module-harness.mjs';

test('быстрые сохранения прозрачности идут последовательно; запрос старой сессии отменяется', async () => {
  const sent = [], first = deferred(); let token = 'session';
  const { saveLayerOpacity } = loadModule('../src/ui/layer-actions.js', {
    getToken: () => token, canEdit: () => true, toast() {}, api: { send: async (...args) => {
      sent.push(args); if (sent.length === 1) await first.promise;
    } }
  });
  const layer = { id: 1, opacity: 0.7 };
  const a = saveLayerOpacity(layer); await new Promise((r) => setImmediate(r));
  layer.opacity = 0.2; const b = saveLayerOpacity(layer);
  assert.equal(sent.length, 1); first.resolve(); await Promise.all([a, b]);
  assert.equal(sent[0][2].opacity, 0.7); assert.equal(sent[1][2].opacity, 0.2);
  const c = saveLayerOpacity(layer); token = 'new-session'; await c; assert.equal(sent.length, 2);
});

test('порядок слоёв отправляется одним запросом; границы ничего не меняют', async () => {
  const sent = []; let reloads = 0;
  const layers = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const { moveLayer } = loadModule('../src/ui/layer-actions.js', {
    state: { layers }, canEdit: () => true, toast() {}, hooks: { reload: async () => reloads++ },
    api: { send: async (...args) => sent.push(args) }
  });
  await moveLayer(layers[0], -1); assert.equal(sent.length, 0);
  await moveLayer(layers[1], -1); assert.equal(sent.length, 1); assert.equal(reloads, 1);
  assert.equal(sent[0][1], '/api/layers/reorder'); assert.equal(JSON.stringify(sent[0][2].ids), '[2,1,3]');
  assert.deepEqual(layers.map((l) => l.id), [1, 2, 3]);
});
