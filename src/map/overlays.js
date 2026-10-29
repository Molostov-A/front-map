// Оверлеи MapLibre (черновик, выделение, ручки, скелет), порядок поверх объектов, размер ручек, штриховка.
import { map, selectedArrow, state } from '../core/store.js';

export const OVERLAY_DRAFT_FILL = 'fmO-draft-fill';

export function addOverlayLayers() {
  if (!map.getSource('fmO-draft')) map.addSource('fmO-draft', { type: 'geojson', data: emptyFC() });
  if (!map.getSource('fmO-sel')) map.addSource('fmO-sel', { type: 'geojson', data: emptyFC() });
  if (!map.getSource('fmO-handles')) map.addSource('fmO-handles', { type: 'geojson', data: emptyFC() });
  if (!map.getSource('fmO-skel')) map.addSource('fmO-skel', { type: 'geojson', data: emptyFC() });
  if (!map.getSource('fmO-tangents')) map.addSource('fmO-tangents', { type: 'geojson', data: emptyFC() });

  const existing = map.getStyle().layers.map((l) => l.id);
  if (existing.includes(OVERLAY_DRAFT_FILL)) return;

  map.addLayer({ id: OVERLAY_DRAFT_FILL, type: 'fill', source: 'fmO-draft',
    filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['!=', ['get', 'arrowPreview'], true]],
    paint: { 'fill-color': '#4d8dff', 'fill-opacity': 0.18 } });
  map.addLayer({ id: 'fmO-arrow-preview', type: 'fill', source: 'fmO-draft',
    filter: ['==', ['get', 'arrowPreview'], true],
    paint: { 'fill-color': state.arrowStyle.color, 'fill-opacity': state.arrowStyle.opacity } });
  map.addLayer({ id: 'fmO-draft-line', type: 'line', source: 'fmO-draft',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#4d8dff', 'line-width': 2.5, 'line-dasharray': [2, 1.5] } });
  map.addLayer({ id: 'fmO-draft-verts', type: 'circle', source: 'fmO-draft',
    filter: ['==', ['geometry-type'], 'Point'],
    paint: { 'circle-color': '#ffffff', 'circle-radius': 4.5, 'circle-stroke-color': '#2d5bd1', 'circle-stroke-width': 2 } });

  map.addLayer({ id: 'fmO-sel-fill', type: 'fill', source: 'fmO-sel',
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.12 } });
  map.addLayer({ id: 'fmO-sel-line', type: 'line', source: 'fmO-sel',
    paint: { 'line-color': '#ffffff', 'line-width': 5, 'line-opacity': 0.75 } });
  map.addLayer({ id: 'fmO-sel-circle', type: 'circle', source: 'fmO-sel',
    filter: ['==', ['geometry-type'], 'Point'],
    paint: { 'circle-color': '#ffffff', 'circle-radius': 8, 'circle-stroke-color': '#2d5bd1', 'circle-stroke-width': 2.5 } });
  map.addLayer({ id: 'fmO-skel', type: 'line', source: 'fmO-skel',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#ffdd99', 'line-width': 1.5, 'line-opacity': 0.9, 'line-dasharray': [4, 4] } });
  map.addLayer({ id: 'fmO-handles', type: 'circle', source: 'fmO-handles',
    paint: { 'circle-color': '#2d5bd1', 'circle-radius': 6, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } });
  map.addLayer({ id: 'fmO-tangents', type: 'circle', source: 'fmO-tangents',
    paint: { 'circle-color': '#ffaa66', 'circle-radius': 5, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 } });
  handleR = 0; // пересчитать размеры ручек после пересоздания слоёв
}

// Ручки/выделение всегда поверх объектов (иначе их перекрывает заливка стрелки/полигона).
export const OVERLAY_ORDER = [OVERLAY_DRAFT_FILL, 'fmO-arrow-preview', 'fmO-draft-line', 'fmO-draft-verts',
  'fmO-sel-fill', 'fmO-sel-line', 'fmO-sel-circle', 'fmO-skel', 'fmO-handles', 'fmO-tangents'];

export function bringOverlaysToFront() {
  for (const id of OVERLAY_ORDER) { if (map.getLayer(id)) map.moveLayer(id); }
}

export const emptyFC = () => ({ type: 'FeatureCollection', features: [] });

export function hexOfColor(c) {
  return 'fm-hatch-' + String(c || '#e63946').replace(/[^0-9a-f]/gi, '').toLowerCase();
}

export function ensureOverlayImages() {
  if (!map || typeof map.hasImage !== 'function') return;
  try {
    if (!map.hasImage('fm-blank')) {
      const c = document.createElement('canvas');
      c.width = 2; c.height = 2;
      map.addImage('fm-blank', c.getContext('2d').getImageData(0, 0, 2, 2));
    }
    for (const f of state.features) {
      if (f.type !== 'polygon' || !f.properties || f.properties.fill !== 'hatched') continue;
      const id = hexOfColor(f.properties.color);
      if (map.hasImage(id)) continue;
      const S = 12;
      const c = document.createElement('canvas');
      c.width = S; c.height = S;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, S, S);
      ctx.strokeStyle = f.properties.color || '#e63946';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = -S; x <= S; x += 6) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x + S, S);
      }
      ctx.stroke();
      map.addImage(id, ctx.getImageData(0, 0, S, S));
    }
  } catch (e) { /* стиль ещё не готов */ }
}

export function metersPerPixel(lat) {
  const world = 2 * Math.PI * 6378137 * Math.cos(lat * Math.PI / 180);
  return world / (512 * Math.pow(2, map.getZoom()));
}

// Размер ручек/узлов соразмерно телу стрелки: ширина в метрах -> пиксели на текущем масштабе.
export let handleR = 0;

export function arrowHandleRadius() {
  const f = selectedArrow();
  if (!f) {
    const anySel = state.features.some((x) => x.id === state.selectedId);
    return anySel ? 5 : 4;
  }
  const baseW = Number(f.properties.baseWidth) || 600;
  const lat = f.geometry && f.geometry.coordinates[0] ? f.geometry.coordinates[0][1] : map.getCenter().lat;
  return Math.max(2.5, Math.min(5, (baseW / metersPerPixel(lat)) * 0.08));
}

export function updateHandleSizes() {
  if (!map || typeof map.setPaintProperty !== 'function') return;
  const r = Math.round(arrowHandleRadius() * 10) / 10;
  if (r === handleR) return;
  handleR = r;
  try {
    const ids = ['fmO-handles', 'fmO-tangents', 'fmO-draft-verts'];
    for (const id of ids) {
      if (!map.getLayer(id)) continue;
      map.setPaintProperty(id, 'circle-radius', r);
      map.setPaintProperty(id, 'circle-stroke-width', Math.max(1, r * (id === 'fmO-tangents' ? 0.25 : 0.3)));
    }
  } catch (e) { /* слой ещё не готов */ }
}
