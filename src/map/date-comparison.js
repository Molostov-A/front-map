// Цветовой оверлей изменений территории; данные и оформление независимы от объектов.
import { map, state } from '../core/store.js';

export const comparisonDefaults = { addedFill: '#34d399', addedLine: '#047857',
  removedFill: '#fb7185', removedLine: '#be123c', opacity: 0.5 };
let data = { type: 'FeatureCollection', features: [] }, settings = { ...comparisonDefaults };

export function renderComparison() {
  if (!map) return;
  if (!map.getSource('fmO-compare')) map.addSource('fmO-compare', { type: 'geojson', data });
  const before = map.getLayer('fmO-poly-preview-fill') ? 'fmO-poly-preview-fill'
    : map.getLayer('fmO-sel-fill') ? 'fmO-sel-fill' : undefined;
  if (!map.getLayer('fmO-compare-fill')) {
    map.addLayer({ id: 'fmO-compare-fill', type: 'fill', source: 'fmO-compare', paint: {} }, before);
    map.addLayer({ id: 'fmO-compare-line', type: 'line', source: 'fmO-compare', paint: { 'line-width': 3 } }, before);
  }
  const visible = new Set(state.layers.filter((l) => l.visible).map((l) => l.id));
  map.getSource('fmO-compare').setData({ type: 'FeatureCollection', features: data.features.filter((f) => visible.has(f.properties.layerId)) });
  const color = (a, b) => ['match', ['get', 'kind'], 'added', a, b];
  map.setPaintProperty('fmO-compare-fill', 'fill-color', color(settings.addedFill, settings.removedFill));
  map.setPaintProperty('fmO-compare-fill', 'fill-opacity', settings.opacity);
  map.setPaintProperty('fmO-compare-line', 'line-color', color(settings.addedLine, settings.removedLine));
}
export function setComparison(fc, colors = settings) {
  data = fc; settings = { ...colors }; renderComparison();
}
export function recolorComparison(colors) {
  settings = { ...colors }; renderComparison();
}
export function clearComparison() {
  data = { type: 'FeatureCollection', features: [] };
  if (map?.getSource('fmO-compare')) map.getSource('fmO-compare').setData(data);
}
