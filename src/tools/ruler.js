// Инструмент «Линейка»: второй клик фиксирует (клик рядом с началом — отмена);
// Shift — ломаная, клик по первой точке ломаной — завершить. Рисуется на оверлей-канве.
import { map, state } from '../core/store.js';
import { refreshSources } from '../map/render.js';
import { updateHint } from '../ui/hint.js';
import { dedupeCoords } from './draw.js';

const cancel = () => { state.draft = null; refreshSources(); updateHint(); };

export const rulerTool = {
  onClick({ lngLat, point, shift }) {
    if (!state.draft || state.draft.type !== 'ruler') {
      state.draft = { type: 'ruler', coords: [lngLat], cursor: null };
    } else {
      const p0 = map.project(state.draft.coords[0]);
      const dist = Math.hypot(p0.x - point.x, p0.y - point.y);
      // вырожденный второй клик рядом с началом — отмена
      if (state.draft.coords.length === 1 && dist < 4) { cancel(); return false; }
      // клик по первой точке ломаной — завершить
      if (state.draft.coords.length >= 3 && dist < 10) return true;
      state.draft.coords.push(lngLat);
    }
    refreshSources();
    updateHint();
    // без Shift — линейка из двух точек
    return !shift && state.draft.coords.length >= 2;
  },
  finish(d) {
    const pts = dedupeCoords(d.coords);
    if (pts.length < 2) { cancel(); return null; }
    return { type: 'LineString', coordinates: pts };
  }
};
