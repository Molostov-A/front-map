// Временный контур импорта, не участвует в выборе и восстанавливается после смены подложки.
import { map } from '../core/store.js';

let preview = { type: 'FeatureCollection', features: [] };
export function renderDeepStatePreview() {
  if (!map) return;
  if (!map.getSource('fmO-ds-preview')) map.addSource('fmO-ds-preview', { type: 'geojson', data: preview });
  if (!map.getLayer('fmO-ds-preview-fill')) {
    map.addLayer({ id: 'fmO-ds-preview-fill', type: 'fill', source: 'fmO-ds-preview',
      paint: { 'fill-color': '#22d3ee', 'fill-opacity': 0.22 } });
    map.addLayer({ id: 'fmO-ds-preview-line', type: 'line', source: 'fmO-ds-preview',
      paint: { 'line-color': '#0891b2', 'line-width': 3, 'line-dasharray': [3, 2] } });
  }
  map.getSource('fmO-ds-preview').setData(preview);
}
export function setDeepStatePreview(geometry) {
  preview = { type: 'FeatureCollection', features: geometry ? [{ type: 'Feature', geometry, properties: {} }] : [] };
  renderDeepStatePreview();
}
export function clearDeepStatePreview() {
  preview = { type: 'FeatureCollection', features: [] };
  if (map?.getSource('fmO-ds-preview')) map.getSource('fmO-ds-preview').setData(preview);
}
