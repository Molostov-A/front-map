import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geometryHash } from '../geometry-hash.mjs';
import { loadModule, deferred } from './module-harness.mjs';

const geometry = { type: 'Polygon', coordinates: [[[30, 48], [32, 48], [32, 50], [30, 50], [30, 48]]] };
function setup() {
  const nodes = new Map();
  const $ = (id) => {
    if (!nodes.has(id)) nodes.set(id, { value: '', checked: false, hidden: false, disabled: false, textContent: '',
      replaceChildren() { this.value = ''; }, appendChild(o) { if (!this.value) this.value = o.value; } });
    return nodes.get(id);
  };
  $('#ds-mode').value = 'new';
  const state = { tool: 'select', activeLayerId: null, layers: [{ id: 1, visible: true }],
    features: [{ id: 2, layer_id: 1, type: 'polygon', geometry }, { id: 3, layer_id: 9, type: 'polygon', geometry }] };
  const sent = [], selected = [];
  let day = '2026-11-13', token = 'token', mod, fail = false;
  const hooks = { flushSaves: async () => {}, reload: async () => mod.resetDeepStateImport(),
    importMode: (on) => { state.tool = on ? 'deepstate-import' : 'select'; }, select: (id) => selected.push(id) };
  mod = loadModule('../src/ui/deepstate-import.js', {
    $, state, hooks, geometryHash, canEdit: () => true, getToken: () => token, currentDay: () => day,
    formatArea: () => 'area', polygonAreaKm2: () => 1, bindDialogDrag() {},
    clearDeepStatePreview() {}, setDeepStatePreview() {}, map: {}, structuredClone,
    crypto: { randomUUID: () => 'request-id-0000001' }, document: { createElement: () => ({}) },
    api: { get: async () => ({ imports: [] }), send: async (method, url, body) => {
      sent.push({ url, body });
      if (url.endsWith('/layer')) return { id: 1 };
      if (url.endsWith('/preview')) return { candidates: [{ geometry, sourceId: 'test', name: 'Synthetic', sourceDay: '2026-11-12' }], skipped: 0 };
      if (fail) throw new Error('network');
      return { feature: { id: 2 } };
    } }
  });
  mod.bindDeepStateImport();
  return { mod, $, sent, state, selected, setDay: (v) => day = v, setToken: (v) => token = v, setFail: (v) => fail = v };
}
const file = { name: 'test.geojson', size: 10, text: async () => JSON.stringify(geometry) };
test('импорт: только предпросмотр до явного сохранения; повтор при сетевой ошибке сохраняет request_id', async () => {
  const h = setup(); await h.$('#btn-deepstate').onclick(); await h.mod.loadDeepStateFile(file);
  assert.equal(h.sent.filter((r) => r.url.endsWith('/apply')).length, 0);
  assert.equal(h.$('#ds-create').disabled, false);
  h.setFail(true); await h.mod.applyDeepStateTarget(); h.setFail(false); await h.mod.applyDeepStateTarget();
  const requests = h.sent.filter((r) => r.url.endsWith('/apply'));
  assert.equal(requests.length, 2); assert.equal(requests[0].body.request_id, requests[1].body.request_id);
  assert.equal(requests[0].body.date, '2026-11-13'); assert.equal(requests[0].body.source_day, '2026-11-12');
  assert.deepEqual(h.selected, [2]); assert.equal(h.$('#ds-create').disabled, true);
});
test('обновление: отдельное включение клика, запрет другого слоя и отключение после успеха', async () => {
  const h = setup(); await h.$('#btn-deepstate').onclick(); await h.mod.loadDeepStateFile(file);
  h.$('#ds-mode').value = 'update'; h.$('#ds-mode').onchange();
  await h.mod.applyDeepStateTarget(2); assert.equal(h.sent.filter((r) => r.url.endsWith('/apply')).length, 0);
  h.$('#ds-click-apply').checked = true; h.$('#ds-click-apply').onchange();
  await h.mod.applyDeepStateTarget(3); assert.match(h.$('#ds-status').textContent, /других слоёв/);
  await h.mod.applyDeepStateTarget(2);
  const request = h.sent.find((r) => r.url.endsWith('/apply'));
  assert.equal(request.body.target_id, 2); assert.equal(request.body.expected_hash, await geometryHash(geometry));
  assert.equal(h.$('#ds-click-apply').checked, false); assert.equal(h.state.tool, 'select');
});
test('устаревшее чтение файла и незавершённые сохранения не могут применить другой день/сессию', async () => {
  const h = setup(), reading = deferred(); await h.$('#btn-deepstate').onclick();
  const loading = h.mod.loadDeepStateFile({ ...file, text: () => reading.promise });
  h.setDay('2026-11-14'); h.mod.resetDeepStateImport(); reading.resolve(JSON.stringify(geometry)); await loading;
  assert.equal(h.sent.filter((r) => r.url.endsWith('/preview')).length, 0);
  assert.equal(h.$('#ds-create').disabled, true);
  await h.mod.loadDeepStateFile(file); h.setToken('other');
  // Смена контекста карты/входа вызывает reset через mapChanged.
  h.mod.resetDeepStateImport(); await h.mod.applyDeepStateTarget();
  assert.equal(h.sent.filter((r) => r.url.endsWith('/apply')).length, 0);
});
test('ошибочный JSON очищает предыдущий контур и не оставляет активного применения', async () => {
  const h = setup(); await h.$('#btn-deepstate').onclick(); await h.mod.loadDeepStateFile(file);
  await h.mod.loadDeepStateFile({ ...file, text: async () => '{' });
  assert.equal(h.$('#ds-create').disabled, true); assert.match(h.$('#ds-status').textContent, /JSON/);
});
