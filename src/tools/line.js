// Инструмент «Линия»: клик — точка; без Shift линия завершается на второй точке, Shift — многоузловая.
import { state } from '../core/store.js';
import { toast } from '../core/util.js';
import { refreshSources } from '../map/render.js';
import { dedupeCoords } from './draw.js';

export const lineTool = {
  hint: () => 'Клик — линия · Shift+клик — добавить точку · Enter / двойной клик — завершить · Esc — отмена',
  /** @returns {boolean} true — завершить черновик */
  onClick({ lngLat, shift }) {
    if (!state.draft || state.draft.type !== 'line') {
      state.draft = { type: 'line', coords: [lngLat], cursor: null };
    } else {
      state.draft.coords.push(lngLat);
    }
    refreshSources();
    return !shift && state.draft.coords.length >= 2;
  },
  /** Черновик → GeoJSON-объекты оверлея: линия до курсора + вершины. */
  draft(d) {
    if (!d.coords.length) return [];
    const pts = d.cursor ? [...d.coords, d.cursor] : [...d.coords];
    return [{ type: 'Feature', geometry: { type: 'LineString', coordinates: pts }, properties: {} },
      ...d.coords.map((c) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: {} }))];
  },
  /** Черновик → геометрия (или null, если точек мало). */
  finish(d) {
    const coords = dedupeCoords(d.coords);
    if (coords.length < 2) { toast('Линия: минимум 2 точки'); return null; }
    return { type: 'LineString', coordinates: coords };
  }
};
