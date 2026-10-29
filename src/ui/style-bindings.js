// Привязка контролов панелей стиля: ввод → state.<type>Style → выбранный объект (декларативно,
// по data-field — см. panel-binder.js) + кнопки, не являющиеся полями стиля.
import { FEATURE_TYPES } from '../../shared/feature-schema.mjs';
import { canEdit } from '../core/session.js';
import { activeSelected, selectedArrow, state, styleStateOf } from '../core/store.js';
import { $, $$ } from '../core/util.js';
import { setMoveMode } from '../edit/move-mode.js';
import { syncStyle } from '../edit/selection.js';
import { putArrowGeometry, scheduleArrowPut } from '../edit/sync.js';
import { refreshSources } from '../map/render.js';
import { setTool } from '../tools/draw.js';
import { updateHint } from './hint.js';
import { bindPanel } from './panel-binder.js';
import { stylePanelEl, updateStylePanels } from './style-panels.js';

// Панели стиля: контролы → state.<type>Style → выбранный объект (PUT).
export function bindStylePanels() {
  for (const type of FEATURE_TYPES) {
    const el = stylePanelEl(type);
    if (el) bindPanel(el, () => styleStateOf(type), () => syncStyle(type));
  }

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

  $$('[data-move]').forEach((btn) => {
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
      updateStylePanels();
    } else {
      updateStylePanels();
    }
  });
  const appBtn = $('#arrow-append');
  if (appBtn) appBtn.addEventListener('click', () => {
    if (!selectedArrow() || !canEdit()) return;
    state.appendArrow = !state.appendArrow;
    updateHint();
    updateStylePanels();
  });
  const delnBtn = $('#arrow-del-node');
  if (delnBtn) delnBtn.addEventListener('click', () => {
    const f = selectedArrow();
    if (!f || f.geometry.coordinates.length <= 2) return;
    f.geometry.coordinates.pop();
    if (Array.isArray(f.properties.nodeMeta)) f.properties.nodeMeta.pop();
    putArrowGeometry(f);
    updateStylePanels();
  });
}
