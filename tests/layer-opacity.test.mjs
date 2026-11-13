import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './module-harness.mjs';

test('прозрачность всех частей слоя умножается один раз, 0 и 1 допустимы', () => {
  const calls = [];
  const original = { 'fill-color': '#123456', 'fill-opacity': ['get', 'opacity'] };
  const map = { getStyle: () => ({ layers: [{ id: 'fill', source: 'fmS-1', type: 'fill', metadata: { baseOpacityPaint: original } },
    { id: 'other', source: 'fmS-2', type: 'line' }] }), setPaintProperty: (...args) => calls.push(args) };
  const { opacityPaint, applyLayerOpacity } = loadModule('../src/map/layer-opacity.js', { map });
  assert.equal(opacityPaint(original, 'fill', 0)['fill-opacity'][2], 0);
  assert.equal(opacityPaint({}, 'circle', 0.4)['circle-stroke-opacity'][2], 0.4);
  assert.equal(opacityPaint({}, 'line', 1)['line-opacity'][1], 1);
  applyLayerOpacity({ id: 1, opacity: 0.4 }); applyLayerOpacity({ id: 1, opacity: 0.2 });
  assert.equal(calls.length, 2); assert.equal(calls[1][2][2], 0.2);
  assert.deepEqual(original, { 'fill-color': '#123456', 'fill-opacity': ['get', 'opacity'] });
});
