// Общее для инструментов: переключение, проверка слоя, создание объекта (POST), черновик.
// Логика конкретных инструментов — tools/<type>.js, реестр и finishDraft — tools/index.js.
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

/** Убирает подряд идущие одинаковые точки (двойной клик ставит точку дважды). */
export const dedupeCoords = (coords) =>
  (coords || []).filter((c, i, arr) => i === 0 || c[0] !== arr[i - 1][0] || c[1] !== arr[i - 1][1]);

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
