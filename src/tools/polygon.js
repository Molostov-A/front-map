// Инструмент «Полигон»: клик — точка; клик по первой точке (или Enter/ПКМ) — замкнуть.
import { map, state } from '../core/store.js';
import { toast } from '../core/util.js';
import { refreshSources } from '../map/render.js';
import { dedupeCoords } from './draw.js';

export const polygonTool = {
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
  finish(d) {
    const coords = dedupeCoords(d.coords);
    if (coords.length < 3) { toast('Полигон: минимум 3 точки'); return null; }
    return { type: 'Polygon', coordinates: [[...coords, coords[0]]] };
  }
};
