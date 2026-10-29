// Инструмент «Линия»: клик — точка; без Shift линия завершается на второй точке, Shift — многоузловая.
import { state } from '../core/store.js';
import { toast } from '../core/util.js';
import { refreshSources } from '../map/render.js';
import { dedupeCoords } from './draw.js';

export const lineTool = {
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
  /** Черновик → геометрия (или null, если точек мало). */
  finish(d) {
    const coords = dedupeCoords(d.coords);
    if (coords.length < 2) { toast('Линия: минимум 2 точки'); return null; }
    return { type: 'LineString', coordinates: coords };
  }
};
