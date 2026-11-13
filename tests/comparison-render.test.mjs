import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './module-harness.mjs';

test('сравнение: раздельные цвета заливки и границ, видимость, восстановление стиля, очистка', () => {
  let source, layerNames = new Set(), paints = {};
  const map = {
    getSource: () => source, addSource: () => { source = { setData: (d) => { source.data = d; } }; },
    getLayer: (id) => layerNames.has(id), addLayer: (l) => layerNames.add(l.id),
    setPaintProperty: (id, key, value) => { paints[id + key] = value; }
  };
  const c = loadModule('../src/map/date-comparison.js', { map, state: { layers: [{ id: 1, visible: true }, { id: 2, visible: false }] } });
  const data = { type: 'FeatureCollection', features: [1,2].map(layerId => ({ properties: { layerId } })) };
  c.setComparison(data);
  assert.equal(source.data.features.length, 1);
  assert.notDeepEqual(paints['fmO-compare-fillfill-color'], paints['fmO-compare-lineline-color']);
  c.recolorComparison({ addedFill:'#123456',addedLine:'#654321',removedFill:'#ff0000',removedLine:'#990000',opacity:0.7 });
  assert.equal(paints['fmO-compare-fillfill-opacity'], 0.7);
  source = null; layerNames = new Set(); paints = {}; c.renderComparison();
  assert.equal(source.data.features.length,1); assert.equal(layerNames.size,2);
  c.clearComparison(); assert.equal(source.data.features.length,0);
});
