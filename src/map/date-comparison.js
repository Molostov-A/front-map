// Цветовой оверлей изменений территории; данные и оформление независимы от объектов.
import { map, state } from '../core/store.js';

export const comparisonDefaults = { addedFill: '#34d399', addedLine: '#047857',
  removedFill: '#fb7185', removedLine: '#be123c', unchangedFill: '#94a3b8', unchangedLine: '#475569', opacity: 0.5 };
let data = { type: 'FeatureCollection', features: [] }, settings = { ...comparisonDefaults };

export function renderComparison() {
  if (!map) return;
  if (!map.getSource('fmO-compare')) map.addSource('fmO-compare', { type: 'geojson', data });
  const before = map.getLayer('fmO-poly-preview-fill') ? 'fmO-poly-preview-fill'
    : map.getLayer('fmO-sel-fill') ? 'fmO-sel-fill' : undefined;
  if (!map.getLayer('fmO-compare-fill')) {
    map.addLayer({ id: 'fmO-compare-unchanged-fill', type: 'fill', source: 'fmO-compare',
      filter: ['==', ['get', 'kind'], 'unchanged'], paint: {} }, before);
    map.addLayer({ id: 'fmO-compare-unchanged-line', type: 'line', source: 'fmO-compare',
      filter: ['==', ['get', 'kind'], 'unchanged'], paint: { 'line-width': 2 } }, before);
    map.addLayer({ id: 'fmO-compare-fill', type: 'fill', source: 'fmO-compare', filter: ['!=', ['get', 'kind'], 'unchanged'], paint: {} }, before);
    map.addLayer({ id: 'fmO-compare-line', type: 'line', source: 'fmO-compare', filter: ['!=', ['get', 'kind'], 'unchanged'], paint: { 'line-width': 3 } }, before);
  }
  const visible = new Set(state.layers.filter((l) => l.visible).map((l) => l.id));
  map.getSource('fmO-compare').setData({ type: 'FeatureCollection', features: data.features.filter((f) => visible.has(f.properties.layerId)) });
  const color = (a, b, c) => ['match', ['get', 'kind'], 'added', a, 'removed', b, c];
  map.setPaintProperty('fmO-compare-fill', 'fill-color', color(settings.addedFill, settings.removedFill, settings.unchangedFill));
  map.setPaintProperty('fmO-compare-fill', 'fill-opacity', settings.opacity);
  map.setPaintProperty('fmO-compare-line', 'line-color', color(settings.addedLine, settings.removedLine, settings.unchangedLine));
  map.setPaintProperty('fmO-compare-unchanged-fill', 'fill-color', settings.unchangedFill);
  map.setPaintProperty('fmO-compare-unchanged-fill', 'fill-opacity', settings.opacity);
  map.setPaintProperty('fmO-compare-unchanged-line', 'line-color', settings.unchangedLine);
}
export function setComparison(fc, colors = settings) {
  data = fc; settings = { ...comparisonDefaults, ...colors }; renderComparison();
}
export function recolorComparison(colors) {
  settings = { ...comparisonDefaults, ...colors }; renderComparison();
}
export function clearComparison() {
  data = { type: 'FeatureCollection', features: [] };
  if (map?.getSource('fmO-compare')) map.getSource('fmO-compare').setData(data);
}
