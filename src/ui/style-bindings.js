// Привязка контролов панелей стиля: ввод → state.<type>Style → выбранный объект.
import { canEdit } from '../core/session.js';
import { activeSelected, selectedArrow, state, styleStateOf } from '../core/store.js';
import { $ } from '../core/util.js';
import { setMoveMode } from '../edit/move-mode.js';
import { syncArrowStyle, syncStyle } from '../edit/selection.js';
import { putArrowGeometry, scheduleArrowPut } from '../edit/sync.js';
import { refreshSources } from '../map/render.js';
import { setTool } from '../tools/draw.js';
import { updateHint } from './hint.js';
import { updateArrowPanel } from './style-panels.js';

// Панели стиля: контролы → state.<type>Style → выбранный объект (PUT).
export function bindStylePanels() {
  const bindArrow = (id, get, set) => {
    const el = $(id);
    el.addEventListener('input', () => {
      set(el);
      syncArrowStyle();
    });
  };
  bindArrow('#arrow-color', null, (el) => { state.arrowStyle.color = el.value; });
  bindArrow('#arrow-opacity', null, (el) => { state.arrowStyle.opacity = Number(el.value) / 100; });
  bindArrow('#arrow-width', null, (el) => { state.arrowStyle.baseWidth = Number(el.value); });
  bindArrow('#arrow-head-width', null, (el) => { state.arrowStyle.headBaseWidth = Number(el.value); });
  bindArrow('#arrow-head-length', null, (el) => { state.arrowStyle.headLength = Number(el.value); });
  bindArrow('#arrow-head-shape', null, (el) => { state.arrowStyle.headShape = Number(el.value) / 100; });
  bindArrow('#arrow-ears', null, (el) => { state.arrowStyle.earsEnabled = el.checked; });
  bindArrow('#arrow-ear-spread', null, (el) => { state.arrowStyle.earSpread = Number(el.value); });
  bindArrow('#arrow-ear-forward', null, (el) => { state.arrowStyle.earForward = Number(el.value); });
  bindArrow('#arrow-glow', null, (el) => { state.arrowStyle.glowEnabled = el.checked; });
  bindArrow('#arrow-glow-blur', null, (el) => { state.arrowStyle.glowBlur = Number(el.value); });
  bindArrow('#arrow-glow-color', null, (el) => { state.arrowStyle.glowColor = el.value; });
  bindArrow('#arrow-stroke', null, (el) => { state.arrowStyle.strokeEnabled = el.checked; });
  bindArrow('#arrow-stroke-width', null, (el) => { state.arrowStyle.strokeWidth = Number(el.value) / 10; });
  bindArrow('#arrow-stroke-color', null, (el) => { state.arrowStyle.strokeColor = el.value; });
  bindArrow('#arrow-stroke-opacity', null, (el) => { state.arrowStyle.strokeOpacity = Number(el.value) / 100; });
  bindArrow('#arrow-stroke-dash', null, (el) => { state.arrowStyle.strokeDashed = el.checked; });
  bindArrow('#arrow-smooth', null, (el) => { state.arrowStyle.smoothAmount = Number(el.value) / 100; });

  // Числовые размеры (в метрах) меняются относительно текущего значения:
  // клик по спиннеру или стрелки клавиатуры дают шаг ~2% от текущего, но не меньше 2 м;
  // удержание спиннера повторяет шаг.
  const bindRelativeNumber = (id) => {
    const el = $(id);
    if (!el) return;
    let delay = null;
    let repeat = null;
    const stepBy = (dir) => {
      const cur = Number(el.value) || 0;
      const delta = Math.max(2, Math.round(Math.abs(cur) * 0.02));
      const min = el.min !== '' ? Number(el.min) : -Infinity;
      const max = el.max !== '' ? Number(el.max) : Infinity;
      const next = Math.min(max, Math.max(min, cur + dir * delta));
      if (next !== cur) {
        el.value = String(next);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };
    const stop = () => {
      if (delay) { clearTimeout(delay); delay = null; }
      if (repeat) { clearInterval(repeat); repeat = null; }
    };
    const start = (dir) => {
      stop();
      stepBy(dir);
      delay = setTimeout(() => { repeat = setInterval(() => stepBy(dir), 55); }, 350);
    };
    el.addEventListener('mousedown', (e) => {
      if (e.offsetX >= el.clientWidth - 20) {
        e.preventDefault();
        start(e.offsetY < el.clientHeight / 2 ? 1 : -1);
        el.focus();
      }
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        stepBy(e.key === 'ArrowUp' ? 1 : -1);
      }
    });
    el.addEventListener('mouseup', stop);
    el.addEventListener('mouseleave', stop);
    el.addEventListener('blur', stop);
    window.addEventListener('mouseup', stop);
  };
  ['#arrow-width', '#arrow-head-width', '#arrow-head-length', '#arrow-ear-spread', '#arrow-ear-forward']
    .forEach(bindRelativeNumber);

  document.querySelectorAll('#arrow-stem-mode button').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.arrowStyle.stemMode = btn.dataset.mode;
      syncArrowStyle();
    });
  });

  /* line / polygon / point / label style panels */
  const bindStyle = (id, type, apply) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', () => { apply(el, styleStateOf(type)); syncStyle(type); });
  };
  bindStyle('#line-color', 'line', (el, s) => { s.color = el.value; });
  bindStyle('#line-opacity', 'line', (el, s) => { s.opacity = Number(el.value) / 100; });
  bindStyle('#line-width', 'line', (el, s) => { s.width = Number(el.value); });
  bindStyle('#line-smooth-amount', 'line', (el, s) => { s.smoothAmount = Number(el.value) / 100; });
  bindStyle('#line-dash', 'line', (el, s) => { s.dash = el.value; });
  document.querySelectorAll('#line-smooth button').forEach((btn) => {
    btn.addEventListener('click', () => { state.lineStyle.smooth = btn.dataset.smooth === '1'; syncStyle('line'); });
  });

  bindStyle('#polygon-color', 'polygon', (el, s) => { s.color = el.value; });
  bindStyle('#polygon-opacity', 'polygon', (el, s) => { s.opacity = Number(el.value) / 100; });
  bindStyle('#polygon-outline-color', 'polygon', (el, s) => { s.outlineColor = el.value; });
  bindStyle('#polygon-outline-width', 'polygon', (el, s) => { s.outlineWidth = Number(el.value); });
  document.querySelectorAll('#polygon-fill button').forEach((btn) => {
    btn.addEventListener('click', () => { state.polygonStyle.fill = btn.dataset.fill; syncStyle('polygon'); });
  });
  bindStyle('#polygon-outline-dash', 'polygon', (el, s) => { s.outlineDash = el.value; });
  bindStyle('#polygon-area-color', 'polygon', (el, s) => { s.areaColor = el.value; });
  bindStyle('#polygon-area-size', 'polygon', (el, s) => { s.areaFontSize = Number(el.value); });
  bindStyle('#polygon-area-bg', 'polygon', (el, s) => { s.areaBg = el.checked; });

  bindStyle('#point-color', 'point', (el, s) => { s.color = el.value; });
  bindStyle('#point-size', 'point', (el, s) => { s.size = Number(el.value); });
  bindStyle('#point-caption', 'point', (el, s) => { s.caption = el.value; });
  document.querySelectorAll('#point-caption-mode button').forEach((btn) => {
    btn.addEventListener('click', () => { state.pointStyle.captionMode = btn.dataset.mode; syncStyle('point'); });
  });

  bindStyle('#label-text', 'label', (el, s) => { s.text = el.value; });

  bindStyle('#ruler-color', 'ruler', (el, s) => { s.color = el.value; });
  bindStyle('#ruler-width', 'ruler', (el, s) => { s.width = Number(el.value); });
  bindStyle('#ruler-opacity', 'ruler', (el, s) => { s.opacity = Number(el.value) / 100; });
  bindStyle('#ruler-font-size', 'ruler', (el, s) => { s.fontSize = Number(el.value); });
  bindStyle('#ruler-label-color', 'ruler', (el, s) => { s.labelColor = el.value; });
  bindStyle('#ruler-ticks', 'ruler', (el, s) => { s.showTicks = el.checked; });
  bindStyle('#ruler-labels', 'ruler', (el, s) => { s.showLabels = el.checked; });

  const bindTextStyle = (type, prefix) => {
    const b = (id, fn) => {
      const el = document.querySelector(prefix + id);
      if (!el) return;
      el.addEventListener('input', () => { fn(el, styleStateOf(type).label); syncStyle(type); });
    };
    b('color', (el, s) => { s.color = el.value; });
    b('size', (el, s) => { s.size = Number(el.value); });
    b('font', (el, s) => { s.font = el.value; });
    b('halo-color', (el, s) => { s.haloColor = el.value; });
    b('halo-width', (el, s) => { s.haloWidth = Number(el.value); });
    b('opacity', (el, s) => { s.opacity = Number(el.value) / 100; });
    b('italic', (el, s) => { s.italic = el.checked; });
    b('bold', (el, s) => { s.bold = el.checked; });
    b('underline', (el, s) => { s.underline = el.checked; });
    b('strike', (el, s) => { s.strike = el.checked; });
    b('bg', (el, s) => { s.bg = el.checked; });
    b('bg-color', (el, s) => { s.bgColor = el.value; });
  };
  bindTextStyle('point', '#point-label-');
  bindTextStyle('label', '#label-');

  document.querySelectorAll('[data-move]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.moveMode) { setMoveMode(false); return; }
      if (!activeSelected(btn.dataset.move)) return;
      if (state.tool !== 'select') setTool('select');
      setMoveMode(true);
    });
  });

  const asEl = $('#arrow-autosmooth');
  if (asEl) asEl.addEventListener('change', () => {
    const f = selectedArrow();
    if (!f) return;
    if (asEl.checked) {
      f.properties.nodeMeta = f.geometry.coordinates.map(() => ({ auto: true }));
      scheduleArrowPut(f);
      refreshSources();
      updateArrowPanel();
    } else {
      updateArrowPanel();
    }
  });
  const appBtn = $('#arrow-append');
  if (appBtn) appBtn.addEventListener('click', () => {
    if (!selectedArrow() || !canEdit()) return;
    state.appendArrow = !state.appendArrow;
    updateHint();
    updateArrowPanel();
  });
  const delnBtn = $('#arrow-del-node');
  if (delnBtn) delnBtn.addEventListener('click', () => {
    const f = selectedArrow();
    if (!f || f.geometry.coordinates.length <= 2) return;
    f.geometry.coordinates.pop();
    if (Array.isArray(f.properties.nodeMeta)) f.properties.nodeMeta.pop();
    putArrowGeometry(f);
    updateArrowPanel();
  });
}
