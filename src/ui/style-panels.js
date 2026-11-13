// Панели стиля: показ панели нужного типа, отображение state.<type>Style (декларативно, panel-binder.js),
// строки длины/площади, кнопки стрелки и «Переместить».
import { formatArea, formatLength, lineLengthKm, polygonAreaKm2 } from '../../measure.mjs';
import { FEATURE_TYPES } from '../../shared/feature-schema.mjs';
import { activeSelected, selectedArrow, state, styleStateOf } from '../core/store.js';
import { $, $$ } from '../core/util.js';
import { applyPanelVisibility, panels } from './float-panels.js';
import { renderPolygonOperations } from './polygon-operations.js';
import { renderPanel } from './panel-binder.js';

/** Панель стиля типа: `#<type>-style`. */
export const stylePanelEl = (type) => $(`#${type}-style`);

/** Перерисовать все панели стиля (видимость, значения, длина/площадь, кнопки). */
export function updateStylePanels() {
  for (const type of FEATURE_TYPES) {
    const el = stylePanelEl(type);
    if (!el) continue;
    el.classList.toggle('show', state.tool === type || !!activeSelected(type));
    renderPanel(el, styleStateOf(type));
  }
  renderArrowExtras();
  updateMeasurePanels();
  renderMoveButtons();
  renderPolygonOperations();
  if (panels) applyPanelVisibility();
}

// Кнопки и флажки стрелки, которые относятся к геометрии, а не к стилю.
function renderArrowExtras() {
  const sel = selectedArrow();
  const as = $('#arrow-autosmooth');
  if (as) {
    const meta = sel && sel.properties ? sel.properties.nodeMeta : null;
    as.checked = !meta || meta.every((m) => m && m.auto);
    as.disabled = !sel;
  }
  const app = $('#arrow-append');
  if (app) { app.disabled = !sel; app.classList.toggle('active', state.appendArrow); }
  const deln = $('#arrow-del-node');
  if (deln) deln.disabled = !sel || sel.geometry.coordinates.length <= 2;
}

export function renderMoveButtons() {
  $$('[data-move]').forEach((b) => {
    const active = !!activeSelected(b.dataset.move) && state.tool === 'select';
    b.disabled = !active;
    b.classList.toggle('on', active && state.moveMode);
  });
}

/** Строки длины/площади (вызывается и на каждом кадре перетаскивания). */
export function updateMeasurePanels() {
  updateLineLength();
  updatePolygonArea();
  updateRulerLength();
}

function setMeasureRow(rowId, valId, text) {
  const row = $(rowId);
  if (!row) return;
  row.style.display = text != null ? 'flex' : 'none';
  $(valId).textContent = text != null ? text : '—';
}

function updateLineLength() {
  const selLine = activeSelected('line');
  const draft = state.draft && state.draft.type === 'line' ? state.draft : null;
  let lineKm = null;
  if (selLine && selLine.geometry && selLine.geometry.type === 'LineString') {
    if (selLine.geometry.coordinates.length >= 2) lineKm = lineLengthKm(selLine.geometry.coordinates);
  } else if (draft && draft.coords.length >= 2) {
    lineKm = lineLengthKm(draft.coords);
  }
  setMeasureRow('#line-length-row', '#line-length-val', lineKm != null ? formatLength(lineKm) : null);
}

function updatePolygonArea() {
  const selPoly = activeSelected('polygon');
  const draft = state.draft && state.draft.type === 'polygon' ? state.draft : null;
  let km2 = null;
  if (selPoly && selPoly.geometry) {
    km2 = polygonAreaKm2(selPoly.geometry);
  } else if (draft && draft.coords.length >= 3) {
    km2 = polygonAreaKm2({ type: 'Polygon', coordinates: [[...draft.coords, draft.coords[0]]] });
  }
  setMeasureRow('#polygon-area-row', '#polygon-area-val', km2 > 0 ? formatArea(km2) : null);
}

function updateRulerLength() {
  const selRuler = activeSelected('ruler');
  const draft = state.draft && state.draft.type === 'ruler' ? state.draft : null;
  let km = null;
  if (selRuler && selRuler.geometry && selRuler.geometry.type === 'LineString'
    && selRuler.geometry.coordinates.length >= 2) {
    km = lineLengthKm(selRuler.geometry.coordinates);
  } else if (draft && draft.coords) {
    const pts = draft.coords.slice();
    if (draft.cursor) pts.push(draft.cursor);
    if (pts.length >= 2) km = lineLengthKm(pts);
  }
  setMeasureRow('#ruler-length-row', '#ruler-length-val', km != null ? formatLength(km) : null);
}
