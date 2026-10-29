// Инструмент «Стрелка»: узлы центральной линии; без Shift завершается на втором узле.
import { state } from '../core/store.js';
import { toast } from '../core/util.js';
import { refreshSources } from '../map/render.js';
import { updateHint } from '../ui/hint.js';
import { dedupeCoords } from './draw.js';

export const arrowTool = {
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
