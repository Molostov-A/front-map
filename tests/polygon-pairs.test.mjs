import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextSelection, polygonPairs } from '../polygon-pairs.mjs';

const rect = (id, x, layer_id = 1) => ({ id, layer_id, type: 'polygon', geometry: { type: 'Polygon',
  coordinates: [[[x, 0], [x + 3, 0], [x + 3, 3], [x, 3], [x, 0]]] } });
test('пары всех выбранных пересекающихся полигонов, касание/скрытые/дубликаты исключены', () => {
  const features = [rect(1, 0), rect(2, 1), rect(3, 2), rect(4, 5), rect(5, 0, 2)];
  const pairs = polygonPairs(features, [1, 2, 3, 4, 5, 1], [{ id: 1, visible: true }, { id: 2, visible: false }]);
  assert.deepEqual(pairs.map((p) => p.key), ['1:2', '1:3', '2:3']);
  assert.deepEqual(polygonPairs(features, [1], [{ id: 1, visible: true }]), []);
});
test('множественное выделение: добавление, удаление, замена и сброс', () => {
  assert.deepEqual(nextSelection([1], 2, true), [1, 2]);
  assert.deepEqual(nextSelection([1, 2], 1, true), [2]);
  assert.deepEqual(nextSelection([1, 2], 3, false), [3]);
  assert.deepEqual(nextSelection([1, 2], null, true), []);
});
