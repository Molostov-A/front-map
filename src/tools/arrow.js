// Инструмент «Стрелка»: узлы центральной линии; без Shift завершается на втором узле.
import { arrowPolygonLngLat } from '../../arrow.mjs';
import { state } from '../core/store.js';
import { toast } from '../core/util.js';
import { refreshSources } from '../map/render.js';
import { updateHint } from '../ui/hint.js';
import { dedupeCoords } from './draw.js';

/** @type {import('../types').Tool} */
export const arrowTool = {
  selectAfterCreate: true,
  hint: (d) => (d && d.nodes && d.nodes.length
    ? 'Shift+клик — добавить узел · ПКМ / Enter / двойной клик — завершить · Esc — отмена'
    : 'Клик — начало стрелки · Shift+клик — несколько узлов · ПКМ / Enter — завершить'),
  /** Узлы, центральная линия до курсора и предпросмотр полигона стрелки (fmO-arrow-preview). */
  draft(d) {
    const nodes = d.nodes || [];
    if (!nodes.length) return [];
    const pts = d.cursor ? [...nodes, d.cursor] : [...nodes];
    /** @type {any[]} */
    const out = nodes.map((c) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: {} }));
    if (pts.length >= 2) {
      out.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: pts }, properties: {} });
      try {
        const poly = arrowPolygonLngLat(pts, state.arrowStyle, null);
        if (poly) out.push({ type: 'Feature', geometry: poly, properties: { arrowPreview: true } });
      } catch (e) { /* пока мало точек */ }
    }
    return out;
  },
  onClick({ lngLat, shift }) {
    if (!state.draft || state.draft.type !== 'arrow') {
      state.draft = { type: 'arrow', nodes: [lngLat], cursor: null };
    } else {
      state.draft.nodes.push(lngLat);
    }
    refreshSources();
    updateHint();
    return !shift && state.draft.nodes.length >= 2;
  },
  finish(d) {
    const nodes = dedupeCoords(d.nodes);
    if (nodes.length < 2) { toast('Стрелка: нужно минимум 2 узла'); return null; }
    return { type: 'LineString', coordinates: nodes };
  }
};
