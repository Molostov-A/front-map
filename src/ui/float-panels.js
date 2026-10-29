// Плавающие панели: позиция/сворачивание (localStorage), видимость, меню настроек.
import { state } from '../core/store.js';
import { $ } from '../core/util.js';

export const PANEL_KEYS = ['layers', 'props', 'dates'];

export const panelEls = {};

export let panels = null;

export let panelOrder = [];

export function raisePanel(key) {
  panelOrder = panelOrder.filter((x) => x !== key).concat(key);
  panelOrder.forEach((k, i) => { if (panelEls[k]) panelEls[k].style.zIndex = 6 + i; });
}

export function loadPanels() {
  const def = {
    layers: { enabled: true, collapsed: false, side: 'left', top: 60 },
    props: { enabled: true, collapsed: false, side: 'right', top: 96 },
    dates: { enabled: true, collapsed: false, side: 'left', top: 360 }
  };
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('panels') || '{}') || {}; } catch (e) { saved = {}; }
  panels = {};
  for (const k of PANEL_KEYS) panels[k] = Object.assign({}, def[k], saved[k] || {});
}

export function savePanels() {
  try { localStorage.setItem('panels', JSON.stringify(panels)); } catch (e) { /* ignore */ }
}

export function applyPanelRect(key) {
  const el = panelEls[key];
  const p = panels[key];
  el.classList.toggle('collapsed', !!p.collapsed);
  if (p.side) {
    el.dataset.side = p.side;
    el.style.left = '';
    el.style.top = (p.top == null ? 12 : p.top) + 'px';
  } else {
    delete el.dataset.side;
    el.style.left = (p.left == null ? 12 : p.left) + 'px';
    el.style.top = (p.top == null ? 12 : p.top) + 'px';
  }
}

export function setPanelVisible(key, on) {
  const el = panelEls[key];
  if (!el || !panels) return;
  el.classList.toggle('hidden', !(on && panels[key].enabled));
}

export function propsHasContent() {
  return ['#arrow-style', '#line-style', '#polygon-style', '#point-style', '#label-style', '#ruler-style']
    .some((s) => { const el = $(s); return el && el.classList.contains('show'); });
}

export function applyPanelVisibility() {
  setPanelVisible('layers', true);
  setPanelVisible('props', propsHasContent());
  setPanelVisible('dates', state.features.some((x) => x.id === state.selectedId));
}

export function initPanels() {
  for (const k of PANEL_KEYS) panelEls[k] = $('#pnl-' + k);
  panelOrder = PANEL_KEYS.slice();
  loadPanels();
  for (const k of PANEL_KEYS) {
    const el = panelEls[k];
    applyPanelRect(k);
    const head = el.querySelector('.fpanel-head');
    const collapse = el.querySelector('.fp-collapse');
    if (collapse) collapse.onclick = () => {
      panels[k].collapsed = !panels[k].collapsed;
      applyPanelRect(k);
      savePanels();
    };
    el.addEventListener('mousedown', () => raisePanel(k));
    let drag = null;
    head.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      const r = el.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      el.classList.add('dragging');
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!drag) return;
      const app = $('#app').getBoundingClientRect();
      let top = e.clientY - app.top - drag.dy;
      let left = e.clientX - app.left - drag.dx;
      top = Math.max(4, Math.min(app.height - 34, top));
      left = Math.max(-20, Math.min(app.width - 80, left));
      delete el.dataset.side;
      el.style.top = top + 'px';
      el.style.left = left + 'px';
    });
    window.addEventListener('mouseup', () => {
      if (!drag) return;
      drag = null;
      el.classList.remove('dragging');
      const app = $('#app').getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const p = panels[k];
      p.top = Math.round(r.top - app.top);
      if (r.left - app.left < 40) p.side = 'left';
      else if (app.right - r.right < 40) p.side = 'right';
      else { p.side = null; p.left = Math.round(r.left - app.left); }
      applyPanelRect(k);
      savePanels();
    });
  }

  const menu = $('#settings-menu');
  $('#btn-settings').onclick = (e) => {
    e.stopPropagation();
    if (!menu.classList.contains('hidden')) { menu.classList.add('hidden'); return; }
    menu.classList.remove('hidden');
    const app = $('#app').getBoundingClientRect();
    const b = $('#btn-settings').getBoundingClientRect();
    const mw = menu.offsetWidth;
    let left = b.right - app.left + 8;
    if (left + mw > app.width - 8) left = Math.max(8, app.width - mw - 8);
    menu.style.left = Math.round(left) + 'px';
    menu.style.top = Math.round(b.top - app.top) + 'px';
  };
  menu.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', () => menu.classList.add('hidden'));
  const bind = (id, key) => {
    const cb = $(id);
    cb.checked = panels[key].enabled;
    cb.onchange = () => { panels[key].enabled = cb.checked; applyPanelVisibility(); savePanels(); };
  };
  bind('#set-layers', 'layers');
  bind('#set-props', 'props');
  bind('#set-dates', 'dates');
  applyPanelVisibility();
}
