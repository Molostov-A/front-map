// Инструменты рисования: переключение, черновик, завершение, создание объекта (POST).
import { api } from '../core/api.js';
import { currentDay } from '../core/days.js';
import { canEdit } from '../core/session.js';
import { map, state } from '../core/store.js';
import { toast } from '../core/util.js';
import { select } from '../edit/selection.js';
import { refreshSources } from '../map/render.js';
import { updateHint } from '../ui/hint.js';
import { renderLayerList } from '../ui/layer-list.js';
import { updateArrowPanel } from '../ui/style-panels.js';

export function setTool(t) {
  if (!canEdit()) t = 'select';
  state.tool = t;
  if (t !== 'select') state.appendArrow = false;
  document.querySelectorAll('#toolbar [data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
  if (map) {
    map.doubleClickZoom.disable(); // мешает завершению фигуры
    // при рисовании Shift+клик добавляет узлы, поэтому box zoom отключаем
    if (t === 'select') map.boxZoom.enable();
    else map.boxZoom.disable();
  }
  refreshSources();
  updateHint();
  updateArrowPanel();
}

export function ensureCanDraw() {
  const L = state.layers.find((l) => l.id === state.activeLayerId);
  if (!L) { toast('Нет активного слоя'); return false; }
  if (!L.visible) { toast('Активный слой скрыт — включите его'); return false; }
  return true;
}

export async function createFeature({ layer_id, type, geometry, properties }) {
  try {
    if (!canEdit()) return null;
    const body = { layer_id, type, geometry, properties, date: currentDay() };
    const created = await api.send('POST', '/api/features', body);
    state.features.push(created);
    refreshSources();
    renderLayerList();
    setTool('select'); // после рисования возвращаемся в режим выбора
    return created;
  } catch (e) { toast('Ошибка: ' + e.message); return null; }
}

export function finishDraft() {
  const d = state.draft;
  if (!d) return;
  const coords = d.coords ? d.coords.filter((c, i, arr) => i === 0 || c[0] !== arr[i - 1][0] || c[1] !== arr[i - 1][1]) : [];
  if (d.type === 'arrow') {
    const nodes = (d.nodes || []).filter((c, i, arr) => i === 0 || c[0] !== arr[i - 1][0] || c[1] !== arr[i - 1][1]);
    if (nodes.length < 2) { toast('Стрелка: нужно минимум 2 узла'); return; }
    commitDraft({ type: 'LineString', coordinates: nodes }, 'arrow');
    return;
  }
  if (d.type === 'ruler') {
    const pts = (d.coords || []).filter((c, i, arr) => i === 0 || c[0] !== arr[i - 1][0] || c[1] !== arr[i - 1][1]);
    if (pts.length < 2) { state.draft = null; refreshSources(); updateHint(); return; }
    commitDraft({ type: 'LineString', coordinates: pts }, 'ruler');
    return;
  }
  if (d.type === 'line') {
    if (coords.length < 2) { toast('Линия: минимум 2 точки'); return; }
    commitDraft({ type: 'LineString', coordinates: coords }, 'line');
  } else {
    if (coords.length < 3) { toast('Полигон: минимум 3 точки'); return; }
    commitDraft({ type: 'Polygon', coordinates: [[...coords, coords[0]]] }, 'polygon');
  }
}

export function defaultPropsFor(type) {
  if (type === 'line') return { ...state.lineStyle };
  if (type === 'polygon') return { ...state.polygonStyle };
  if (type === 'point') return { ...state.pointStyle, label: { ...state.pointStyle.label } };
  if (type === 'label') return { ...state.labelStyle, label: { ...state.labelStyle.label } };
  if (type === 'arrow') return { ...state.arrowStyle };
  if (type === 'ruler') return { ...state.rulerStyle };
  return {};
}

export function commitDraft(geometry, type) {
  state.draft = null;
  refreshSources();
  createFeature({ layer_id: state.activeLayerId, type, geometry, properties: defaultPropsFor(type) })
    .then((created) => {
      if ((type === 'arrow' || type === 'ruler') && created) { select(created.id); updateArrowPanel(); }
    });
}

export function cancelDraft() {
  if (state.draft) { state.draft = null; refreshSources(); return true; }
  return false;
}
