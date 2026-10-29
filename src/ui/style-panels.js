// Панели стиля: отображение state.<type>Style в контролах, длина/площадь, кнопки «Переместить».
import { formatArea, formatLength, lineLengthKm, polygonAreaKm2 } from '../../measure.mjs';
import { activeSelected, selectedArrow, state } from '../core/store.js';
import { $ } from '../core/util.js';
import { applyPanelVisibility, panels } from './float-panels.js';

// Единая отрисовка панели стиля стрелки (раньше дублировалась в renderArrowValues/updateArrowPanel).
export function renderArrowPanel() {
  const panel = $('#arrow-style');
  const show = state.tool === 'arrow' || !!selectedArrow();
  panel.classList.toggle('show', show);
  if (!show) return;

  const s = state.arrowStyle;
  const text = (id, v) => { $(id).textContent = v; };
  const val = (id, v) => { $(id).value = v; };

  val('#arrow-color', s.color);
  text('#arrow-color-val', s.color);
  val('#arrow-opacity', Math.round(s.opacity * 100));
  text('#arrow-opacity-val', Math.round(s.opacity * 100) + '%');
  val('#arrow-width', s.baseWidth);
  text('#arrow-width-val', `${s.baseWidth} м`);
  val('#arrow-head-width', s.headBaseWidth);
  text('#arrow-head-width-val', `${s.headBaseWidth} м`);
  val('#arrow-head-length', s.headLength);
  text('#arrow-head-length-val', `${s.headLength} м`);
  val('#arrow-head-shape', Math.round(s.headShape * 100));
  text('#arrow-head-shape-val', s.headShape.toFixed(2));
  $('#arrow-ears').checked = s.earsEnabled;
  val('#arrow-ear-spread', s.earSpread);
  text('#arrow-ear-spread-val', `${s.earSpread} м`);
  val('#arrow-ear-forward', s.earForward);
  text('#arrow-ear-forward-val', `${s.earForward} м`);
  $('#arrow-glow').checked = s.glowEnabled;
  val('#arrow-glow-blur', s.glowBlur);
  text('#arrow-glow-blur-val', s.glowBlur);
  val('#arrow-glow-color', s.glowColor);
  $('#arrow-stroke').checked = s.strokeEnabled;
  val('#arrow-stroke-width', Math.round(s.strokeWidth * 10));
  text('#arrow-stroke-width-val', s.strokeWidth.toFixed(1));
  val('#arrow-stroke-color', s.strokeColor);
  val('#arrow-stroke-opacity', Math.round(s.strokeOpacity * 100));
  text('#arrow-stroke-opacity-val', s.strokeOpacity.toFixed(2));
  $('#arrow-stroke-dash').checked = s.strokeDashed;
  val('#arrow-smooth', Math.round(s.smoothAmount * 100));
  text('#arrow-smooth-val', s.smoothAmount.toFixed(2));
  document.querySelectorAll('#arrow-stem-mode button').forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === s.stemMode);
  });

  const off = (id, disabled) => { $(id).disabled = disabled; };
  off('#arrow-smooth', s.stemMode !== 'smooth');
  off('#arrow-ear-spread', !s.earsEnabled);
  off('#arrow-ear-forward', !s.earsEnabled);
  off('#arrow-glow-blur', !s.glowEnabled);
  off('#arrow-glow-color', !s.glowEnabled);
  off('#arrow-stroke-width', !s.strokeEnabled);
  off('#arrow-stroke-color', !s.strokeEnabled);
  off('#arrow-stroke-opacity', !s.strokeEnabled);
  off('#arrow-stroke-dash', !s.strokeEnabled);

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

export function updateArrowPanel() {
  renderArrowPanel();
  updateLinePanel();
  updatePolygonPanel();
  updatePointPanel();
  updateLabelPanel();
  updateRulerPanel();
  renderMoveButtons();
  if (panels) applyPanelVisibility();
}

export function renderMoveButtons() {
  document.querySelectorAll('[data-move]').forEach((b) => {
    const active = !!activeSelected(b.dataset.move) && state.tool === 'select';
    b.disabled = !active;
    b.classList.toggle('on', active && state.moveMode);
  });
}

export function updateMeasurePanels() {
  updateLinePanel();
  updatePolygonPanel();
  updateRulerPanel();
}

export function updateLinePanel() {
  const panel = $('#line-style');
  if (!panel) return;
  panel.classList.toggle('show', state.tool === 'line' || !!activeSelected('line'));
  const s = state.lineStyle;
  $('#line-color').value = s.color;
  $('#line-color-val').textContent = s.color;
  $('#line-opacity').value = Math.round(s.opacity * 100);
  $('#line-opacity-val').textContent = Math.round(s.opacity * 100) + '%';
  $('#line-width').value = s.width;
  $('#line-width-val').textContent = s.width + ' px';
  $('#line-dash').value = s.dash;
  document.querySelectorAll('#line-smooth button').forEach((b) => b.classList.toggle('active', b.dataset.smooth === (s.smooth ? '1' : '0')));
  $('#line-smooth-amount').value = Math.round(s.smoothAmount * 100);
  $('#line-smooth-amount-val').textContent = s.smoothAmount.toFixed(2);
  $('#line-smooth-amount').disabled = !s.smooth;

  const selLine = activeSelected('line');
  const draft = state.draft && state.draft.type === 'line' ? state.draft : null;
  let lineKm = null;
  if (selLine && selLine.geometry && selLine.geometry.type === 'LineString') {
    if (selLine.geometry.coordinates.length >= 2) lineKm = lineLengthKm(selLine.geometry.coordinates);
  } else if (draft && draft.coords.length >= 2) {
    lineKm = lineLengthKm(draft.coords);
  }
  const lenRow = $('#line-length-row');
  if (lenRow) {
    lenRow.style.display = lineKm != null ? 'flex' : 'none';
    $('#line-length-val').textContent = lineKm != null ? formatLength(lineKm) : '—';
  }
}

export function updatePolygonPanel() {
  const panel = $('#polygon-style');
  if (!panel) return;
  panel.classList.toggle('show', state.tool === 'polygon' || !!activeSelected('polygon'));
  const s = state.polygonStyle;
  $('#polygon-color').value = s.color;
  $('#polygon-color-val').textContent = s.color;
  $('#polygon-opacity').value = Math.round(s.opacity * 100);
  $('#polygon-opacity-val').textContent = Math.round(s.opacity * 100) + '%';
  document.querySelectorAll('#polygon-fill button').forEach((b) => b.classList.toggle('active', b.dataset.fill === s.fill));
  $('#polygon-outline-color').value = s.outlineColor;
  $('#polygon-outline-color-val').textContent = s.outlineColor;
  $('#polygon-outline-width').value = s.outlineWidth;
  $('#polygon-outline-width-val').textContent = s.outlineWidth + ' px';
  $('#polygon-area-color').value = s.areaColor;
  $('#polygon-area-color-val').textContent = s.areaColor;
  $('#polygon-area-size').value = s.areaFontSize;
  $('#polygon-area-size-val').textContent = Math.round(s.areaFontSize) + ' px';
  $('#polygon-area-bg').checked = s.areaBg;

  const selPoly = activeSelected('polygon');
  const draft = state.draft && state.draft.type === 'polygon' ? state.draft : null;
  let km2 = null;
  if (selPoly && selPoly.geometry) {
    km2 = polygonAreaKm2(selPoly.geometry);
    if (!(km2 > 0)) km2 = null;
  } else if (draft && draft.coords.length >= 3) {
    km2 = polygonAreaKm2({ type: 'Polygon', coordinates: [[...draft.coords, draft.coords[0]]] });
    if (!(km2 > 0)) km2 = null;
  }
  const areaRow = $('#polygon-area-row');
  if (areaRow) {
    areaRow.style.display = km2 != null ? 'flex' : 'none';
    $('#polygon-area-val').textContent = km2 != null ? formatArea(km2) : '—';
  }
}

export function updatePointPanel() {
  const panel = $('#point-style');
  if (!panel) return;
  panel.classList.toggle('show', state.tool === 'point' || !!activeSelected('point'));
  const s = state.pointStyle;
  $('#point-color').value = s.color;
  $('#point-color-val').textContent = s.color;
  $('#point-size').value = s.size;
  $('#point-size-val').textContent = s.size;
  $('#point-caption').value = s.caption;
  document.querySelectorAll('#point-caption-mode button').forEach((b) => b.classList.toggle('active', b.dataset.mode === s.captionMode));
  renderTextStyleControls('#point-label-', s.label);
}

export function updateLabelPanel() {
  const panel = $('#label-style');
  if (!panel) return;
  panel.classList.toggle('show', state.tool === 'label' || !!activeSelected('label'));
  const s = state.labelStyle;
  $('#label-text').value = s.text;
  renderTextStyleControls('#label-', s.label);
}

export function updateRulerPanel() {
  const panel = $('#ruler-style');
  if (!panel) return;
  panel.classList.toggle('show', state.tool === 'ruler' || !!activeSelected('ruler'));
  const s = state.rulerStyle;
  $('#ruler-color').value = s.color;
  $('#ruler-color-val').textContent = s.color;
  $('#ruler-width').value = s.width;
  $('#ruler-width-val').textContent = s.width + ' px';
  $('#ruler-opacity').value = Math.round(s.opacity * 100);
  $('#ruler-opacity-val').textContent = Math.round(s.opacity * 100) + '%';
  $('#ruler-font-size').value = s.fontSize;
  $('#ruler-font-size-val').textContent = Math.round(s.fontSize) + ' px';
  $('#ruler-label-color').value = s.labelColor;
  $('#ruler-label-color-val').textContent = s.labelColor;
  $('#ruler-ticks').checked = s.showTicks;
  $('#ruler-labels').checked = s.showLabels;

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
  const row = $('#ruler-length-row');
  if (row) {
    row.style.display = km != null ? 'flex' : 'none';
    $('#ruler-length-val').textContent = km != null ? formatLength(km) : '—';
  }
}

export function renderTextStyleControls(prefix, ls) {
  const q = (id) => document.querySelector(prefix + id);
  const set = (id, v) => { const el = q(id); if (el) el.value = v; };
  const txt = (id, v) => { const el = q(id); if (el) el.textContent = v; };
  const chk = (id, v) => { const el = q(id); if (el) el.checked = v; };
  set('color', ls.color); txt('color-val', ls.color);
  set('size', ls.size); txt('size-val', ls.size + ' px');
  set('font', ls.font);
  set('halo-color', ls.haloColor); txt('halo-color-val', ls.haloColor);
  set('halo-width', ls.haloWidth); txt('halo-width-val', ls.haloWidth);
  set('opacity', Math.round(ls.opacity * 100)); txt('opacity-val', Math.round(ls.opacity * 100) + '%');
  chk('italic', ls.italic);
  chk('bold', ls.bold);
  chk('underline', ls.underline);
  chk('strike', ls.strike);
  chk('bg', ls.bg);
  set('bg-color', ls.bgColor); txt('bg-color-val', ls.bgColor);
  const bgc = q('bg-color'); if (bgc) bgc.disabled = !ls.bg;
}
