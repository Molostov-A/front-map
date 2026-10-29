// Инструмент «Линейка»: второй клик фиксирует (клик рядом с началом — отмена);
// Shift — ломаная, клик по первой точке ломаной — завершить. Рисуется на оверлей-канве.
import { map, state } from '../core/store.js';
import { refreshSources } from '../map/render.js';
import { updateHint } from '../ui/hint.js';
import { dedupeCoords } from './draw.js';

const cancel = () => { state.draft = null; refreshSources(); updateHint(); };

/** @type {import('../types').Tool} */
export const rulerTool = {
  selectAfterCreate: true,
  hint(d) {
    const n = d && d.coords ? d.coords.length : 0;
    if (n >= 2) return 'Shift+клик — добавить точку · клик по первой точке / ПКМ / Enter / двойной клик — завершить · Esc — отмена';
    if (n === 1) return 'Клик — вторая точка (фиксация) · Shift+клик — добавить точку (ломаная) · Esc — отмена';
    return 'Клик — начало линейки · Shift+клик — ломаная из нескольких точек · Esc — отмена';
  },
  // draft не нужен: черновик линейки рисуется на оверлей-канве (map/ruler-canvas.js)
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
