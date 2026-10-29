// Инструмент «Полигон»: клик — точка; клик по первой точке (или Enter/ПКМ) — замкнуть.
import { map, state } from '../core/store.js';
import { toast } from '../core/util.js';
import { refreshSources } from '../map/render.js';
import { dedupeCoords } from './draw.js';

export const polygonTool = {
  hint: () => 'Клик — добавить точку · клик по первой точке / Enter — закрыть · Esc — отмена',
  onClick({ lngLat, point }) {
    if (!state.draft || state.draft.type !== 'polygon') {
      state.draft = { type: 'polygon', coords: [lngLat], cursor: null };
    } else {
      // замкнуть полигон по первой точке
      if (state.draft.coords.length >= 3) {
        const p = map.project(state.draft.coords[0]);
        if (Math.hypot(p.x - point.x, p.y - point.y) < 10) return true;
      }
      state.draft.coords.push(lngLat);
    }
    refreshSources();
    return false;
  },
  /** Черновик → полигон до курсора (замкнутый) + вершины. */
  draft(d) {
    if (!d.coords.length) return [];
    const ring = d.cursor ? [...d.coords, d.cursor] : [...d.coords];
    if (ring.length < 2) return [];
    const a = ring[0], b = ring[ring.length - 1];
    if (a[0] !== b[0] || a[1] !== b[1]) ring.push(a);
    return [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} },
      ...d.coords.map((c) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: {} }))];
  },
  finish(d) {
    const coords = dedupeCoords(d.coords);
    if (coords.length < 3) { toast('Полигон: минимум 3 точки'); return null; }
    return { type: 'Polygon', coordinates: [[...coords, coords[0]]] };
  }
};
