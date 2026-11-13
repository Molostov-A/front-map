// Временная подсветка A/B/результата не меняет объекты и не участвует в hit-test.
import { map } from '../core/store.js';

let preview = { type: 'FeatureCollection', features: [] };
export function renderPolygonPreview() {
  if (!map) return;
  if (!map.getSource('fmO-poly-preview')) map.addSource('fmO-poly-preview', { type: 'geojson', data: preview });
  const before = map.getLayer('fmO-sel-fill') ? 'fmO-sel-fill' : undefined;
  if (!map.getLayer('fmO-poly-preview-fill')) {
    map.addLayer({ id: 'fmO-poly-preview-fill', type: 'fill', source: 'fmO-poly-preview',
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['get', 'opacity'] } }, before);
    map.addLayer({ id: 'fmO-poly-preview-line', type: 'line', source: 'fmO-poly-preview',
      paint: { 'line-color': ['get', 'color'], 'line-width': 3 } }, before);
  }
  map.getSource('fmO-poly-preview').setData(preview);
}
export function setPolygonPreview(a, b, result) {
  preview = { type: 'FeatureCollection', features: [
    { type: 'Feature', geometry: a, properties: { color: '#3185ff', opacity: 0.12 } },
    { type: 'Feature', geometry: b, properties: { color: '#ffad33', opacity: 0.12 } },
    ...(result ? [{ type: 'Feature', geometry: result, properties: { color: '#df58ff', opacity: 0.4 } }] : [])
  ] };
  renderPolygonPreview();
}
export function clearPolygonPreview() {
  preview = { type: 'FeatureCollection', features: [] };
  if (map?.getSource('fmO-poly-preview')) map.getSource('fmO-poly-preview').setData(preview);
}
