import * as maplibregl from './vendor/maplibre-gl.mjs';
import { project, arrowPolygonLngLat, arrowOutline, arrowNearestSegment } from './arrow.mjs';
import { BASEMAPS, DEFAULT_BASEMAP_ID, basemapById } from './basemaps.mjs';
import { lineLengthKm, polygonAreaKm2, formatLength, formatArea, polygonLabelPoint, ringCentroid, pickRulerMajorUnit, formatUnit } from './measure.mjs';

/* ================= helpers ================= */
const $ = (s) => document.querySelector(s);
const fmtDate = (iso) => new Date(iso).toLocaleString('ru-RU', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
});
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const bool = (v, d) => typeof v === 'boolean' ? v : d;

/* даты (гранулярность — день, формат YYYY-MM-DD) */
const todayDay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtDay = (day) => {
  if (!day) return '—';
  const [y, m, d] = String(day).slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
};
const shiftDay = (day, n) => {
  const d = new Date(String(day).slice(0, 10) + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const MONTHS_RU =  ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2400);
}

const API_BASE = String(window.__FM_API_BASE || '').replace(/\/$/, '');
const api = {
  async get(u) {
    const r = await fetch(API_BASE + u, { credentials: 'include' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 401) showLogin();
      throw new Error(j.error || r.status);
    }
    return j;
  },
  async send(m, u, b) {
    const r = await fetch(API_BASE + u, {
      method: m,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: b ? JSON.stringify(b) : undefined
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 401) showLogin();
      const err = new Error(j.error || r.status);
      err.status = r.status;
      throw err;
    }
    return j;
  }
};

/* ================= auth ================= */
let currentUser = null;
let loginResolve = null;

function showLogin() {
  const back = document.getElementById('login-back');
  if (back) back.classList.add('show');
}

function hideLogin() {
  const back = document.getElementById('login-back');
  if (back) back.classList.remove('show');
}

function initLoginForm() {
  const form = document.getElementById('login-card');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('login-error');
    const btn = document.getElementById('login-submit');
    if (errEl) errEl.textContent = '';
    if (btn) btn.disabled = true;
    try {
      const r = await api.send('POST', '/api/auth/login', {
        username: document.getElementById('login-user').value,
        password: document.getElementById('login-pass').value
      });
      currentUser = r.user;
      document.getElementById('login-pass').value = '';
      hideLogin();
      if (loginResolve) { const f = loginResolve; loginResolve = null; f(r.user); }
    } catch (err) {
      if (errEl) errEl.textContent = 'Неверный логин или пароль';
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

// Гарантирует авторизацию: возвращает пользователя, показав форму входа при необходимости.
async function ensureAuth() {
  try {
    const r = await api.get('/api/auth/me');
    if (r && r.user) { currentUser = r.user; return r.user; }
  } catch (e) { /* не авторизован */ }
  showLogin();
  return new Promise((resolve) => { loginResolve = resolve; });
}

function setUsersError(msg) {
  const el = document.getElementById('users-error');
  if (el) el.textContent = msg || '';
}

function updateUserBox() {
  const nameEl = document.getElementById('ub-name');
  const roleEl = document.getElementById('ub-role');
  const usersBtn = document.getElementById('btn-users');
  if (nameEl) nameEl.textContent = currentUser ? currentUser.username : '—';
  if (roleEl) roleEl.textContent = currentUser ? '(' + currentUser.role + ')' : '';
  if (usersBtn) usersBtn.style.display = currentUser && currentUser.role === 'admin' ? '' : 'none';
  const logout = document.getElementById('btn-logout');
  if (logout && !logout.__wired) {
    logout.__wired = true;
    logout.addEventListener('click', async () => {
      try { await api.send('POST', '/api/auth/logout'); } catch (e) { /* ignore */ }
      window.location.reload();
    });
  }
  if (usersBtn && !usersBtn.__wired) {
    usersBtn.__wired = true;
    usersBtn.addEventListener('click', () => {
      document.getElementById('users-back').classList.add('show');
      renderUsers();
    });
  }
}

async function renderUsers() {
  const list = document.getElementById('users-list');
  if (!list) return;
  list.innerHTML = '';
  let users = [];
  try { users = await api.get('/api/users'); } catch (e) { setUsersError(e.message); return; }
  for (const u of users) {
    const row = document.createElement('div');
    row.className = 'users-row';
    const nm = document.createElement('span');
    nm.className = 'u-nm'; nm.textContent = u.username;
    const rl = document.createElement('span');
    rl.className = 'u-rl'; rl.textContent = u.role;
    const del = document.createElement('button');
    del.className = 'icon-btn'; del.textContent = '🗑'; del.title = 'Удалить';
    if (currentUser && u.id === currentUser.id) del.disabled = true;
    del.onclick = async () => {
      try { await api.send('DELETE', '/api/users/' + u.id); await renderUsers(); }
      catch (e) { setUsersError(e.message); }
    };
    row.append(nm, rl, del);
    list.append(row);
  }
}

function initUsersModal() {
  const close = document.getElementById('users-close');
  if (close) close.addEventListener('click', () => document.getElementById('users-back').classList.remove('show'));
  const back = document.getElementById('users-back');
  if (back) back.addEventListener('click', (e) => { if (e.target.id === 'users-back') back.classList.remove('show'); });
  const form = document.getElementById('users-add');
  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setUsersError('');
    try {
      await api.send('POST', '/api/users', {
        username: document.getElementById('users-new-name').value,
        password: document.getElementById('users-new-pass').value,
        role: document.getElementById('users-new-role').value
      });
      document.getElementById('users-new-name').value = '';
      document.getElementById('users-new-pass').value = '';
      await renderUsers();
    } catch (err) { setUsersError(err.message); }
  });
}

/* ================= state ================= */
const ARROW_STYLE_DEFAULTS = {
  color: '#7f8cff', opacity: 0.95, baseWidth: 600,
  headBaseWidth: 300, headLength: 900, headShape: 0,
  earsEnabled: true, earSpread: 1400, earForward: 0,
  stemMode: 'sharp', smoothAmount: 0.6,
  glowEnabled: false, glowBlur: 12, glowColor: '#7f8cff',
  strokeEnabled: true, strokeWidth: 2, strokeColor: '#ffffff',
  strokeOpacity: 1, strokeDashed: false
};

function normalizeArrowStyle(src) {
  const s = src || {}, d = ARROW_STYLE_DEFAULTS;
  const color = (v, dv) => typeof v === 'string' && v ? v : dv;
  return {
    color: color(s.color, d.color),
    opacity: num(s.opacity, d.opacity),
    baseWidth: num(s.baseWidth, d.baseWidth),
    headBaseWidth: num(s.headBaseWidth, d.headBaseWidth),
    headLength: num(s.headLength, d.headLength),
    headShape: num(s.headShape, d.headShape),
    earsEnabled: bool(s.earsEnabled, d.earsEnabled),
    earSpread: num(s.earSpread, d.earSpread),
    earForward: num(s.earForward, d.earForward),
    stemMode: s.stemMode === 'smooth' ? 'smooth' : 'sharp',
    smoothAmount: num(s.smoothAmount, d.smoothAmount),
    glowEnabled: bool(s.glowEnabled, d.glowEnabled),
    glowBlur: num(s.glowBlur, d.glowBlur),
    glowColor: color(s.glowColor, d.glowColor),
    strokeEnabled: bool(s.strokeEnabled, d.strokeEnabled),
    strokeWidth: num(s.strokeWidth, d.strokeWidth),
    strokeColor: color(s.strokeColor, d.strokeColor),
    strokeOpacity: num(s.strokeOpacity, d.strokeOpacity),
    strokeDashed: bool(s.strokeDashed, d.strokeDashed)
  };
}

const DASH_KEYS = ['solid', 'dotted', 'dashed', 'dashdot'];
const FONT_KEYS = ['system', 'sans', 'serif', 'mono', 'cursive'];
const colorOr = (v, dv) => typeof v === 'string' && v ? v : dv;

const LINE_STYLE_DEFAULTS = { color: '#e63946', opacity: 1, width: 3, dash: 'solid', smooth: false, smoothAmount: 0.6 };
function normalizeLineStyle(src) {
  const s = src || {}, d = LINE_STYLE_DEFAULTS;
  return {
    color: colorOr(s.color, d.color),
    opacity: num(s.opacity, d.opacity),
    width: num(s.width, d.width),
    dash: DASH_KEYS.includes(s.dash) ? s.dash : d.dash,
    smooth: bool(s.smooth, d.smooth),
    smoothAmount: num(s.smoothAmount, d.smoothAmount)
  };
}

const POLYGON_STYLE_DEFAULTS = { color: '#e63946', opacity: 0.25, fill: 'solid', outlineColor: '#e63946', outlineWidth: 2, outlineDash: 'solid', areaColor: '#eaf0ff', areaFontSize: 12, areaBg: true };
function normalizePolygonStyle(src) {
  const s = src || {}, d = POLYGON_STYLE_DEFAULTS;
  return {
    color: colorOr(s.color, d.color),
    opacity: num(s.opacity, d.opacity),
    fill: s.fill === 'hatched' ? 'hatched' : 'solid',
    outlineColor: colorOr(s.outlineColor, d.outlineColor),
    outlineWidth: num(s.outlineWidth, d.outlineWidth),
    outlineDash: DASH_KEYS.includes(s.outlineDash) ? s.outlineDash : d.outlineDash,
    areaColor: colorOr(s.areaColor, d.areaColor),
    areaFontSize: num(s.areaFontSize, d.areaFontSize),
    areaBg: bool(s.areaBg, d.areaBg)
  };
}

const RULER_STYLE_DEFAULTS = { color: '#e0b050', width: 3, opacity: 1, fontSize: 12, labelColor: '#eaf0ff', showTicks: true, showLabels: true };
function normalizeRulerStyle(src) {
  const s = src || {}, d = RULER_STYLE_DEFAULTS;
  const color = colorOr(s.color, d.color);
  return {
    color,
    width: num(s.width, d.width),
    opacity: num(s.opacity, d.opacity),
    fontSize: num(s.fontSize, d.fontSize),
    labelColor: colorOr(s.labelColor, d.labelColor),
    showTicks: bool(s.showTicks, d.showTicks),
    showLabels: bool(s.showLabels, d.showLabels)
  };
}

const TEXT_STYLE_DEFAULTS = {
  color: '#ffffff', size: 13, font: 'system', haloColor: '#0b0d10', haloWidth: 2,
  opacity: 1, bg: false, bgColor: '#1b1e24', italic: false, bold: false, underline: false, strike: false
};
function normalizeTextStyle(src) {
  const s = src || {}, d = TEXT_STYLE_DEFAULTS;
  return {
    color: colorOr(s.color, d.color),
    size: num(s.size, d.size),
    font: FONT_KEYS.includes(s.font) ? s.font : d.font,
    haloColor: colorOr(s.haloColor, d.haloColor),
    haloWidth: num(s.haloWidth, d.haloWidth),
    opacity: num(s.opacity, d.opacity),
    bg: bool(s.bg, d.bg),
    bgColor: colorOr(s.bgColor, d.bgColor),
    italic: bool(s.italic, d.italic),
    bold: bool(s.bold, d.bold),
    underline: bool(s.underline, d.underline),
    strike: bool(s.strike, d.strike)
  };
}

const POINT_STYLE_DEFAULTS = { color: '#e63946', size: 7, caption: '', captionMode: 'selected' };
function normalizePointStyle(src) {
  const s = src || {}, d = POINT_STYLE_DEFAULTS;
  return {
    color: colorOr(s.color, d.color),
    size: num(s.size, d.size),
    caption: typeof s.caption === 'string' ? s.caption : d.caption,
    captionMode: ['never', 'selected', 'always'].includes(s.captionMode) ? s.captionMode : d.captionMode,
    label: normalizeTextStyle(s.label)
  };
}

const LABEL_STYLE_DEFAULTS = { text: '' };
function normalizeLabelStyle(src) {
  const s = src || {};
  return {
    text: typeof s.text === 'string' ? s.text : LABEL_STYLE_DEFAULTS.text,
    label: normalizeTextStyle(s.label)
  };
}

const state = {
  layers: [],
  features: [],
  activeLayerId: null,
  tool: 'select',
  selectedId: null,
  draft: null,          // {type:'line'|'polygon', coords, cursor} | {type:'arrow', nodes:[...], cursor}
  drag: null,           // {featureId, index, ring, moved} | {featureId, type:'tangent', index, which}
  appendArrow: false,   // режим «дорисовать» для выбранной стрелки
  arrowStyle: normalizeArrowStyle(ARROW_STYLE_DEFAULTS),
  lineStyle: normalizeLineStyle(LINE_STYLE_DEFAULTS),
  polygonStyle: normalizePolygonStyle(POLYGON_STYLE_DEFAULTS),
  pointStyle: normalizePointStyle(POINT_STYLE_DEFAULTS),
  labelStyle: normalizeLabelStyle(LABEL_STYLE_DEFAULTS),
  rulerStyle: normalizeRulerStyle(RULER_STYLE_DEFAULTS),
  markers: new Map(),   // id -> { marker, el } для надписей и подписей точек
  areaMarkers: new Map(), // id -> marker для подписей площади полигонов
  moveMode: false,      // режим перемещения выбранного элемента
  move: null,           // активное перетаскивание: { featureId, start, orig, moved }
  ignoreNextClick: false,
  date: null,           // выбранный день YYYY-MM-DD; null = "сейчас"
  dates: null,          // даты выбранного элемента { created_at, deleted_at, changes:[...] }
  calView: null         // отображаемый месяц календаря: Date (1-е число)
};

let map = null;
let LABEL_FONT = ['Noto Sans Regular'];

// диагностика: ошибки видны в <title> (для headless-проверок) и в консоли
function diag(msg) {
  document.title = 'ERR: ' + msg;
  console.error('[front-map] ' + msg);
}
window.addEventListener('error', (e) => diag(e.message + ' @' + e.filename + ':' + e.lineno));
window.addEventListener('unhandledrejection', (e) => diag('promise: ' + (e.reason && e.reason.message || e.reason)));


/* ================= modal ================= */
let modalResolve = null;
function promptModal({ title, name = '', color = '#e63946', showColor = true }) {
  return new Promise((resolve) => {
    modalResolve = resolve;
    $('#modal-title').textContent = title;
    $('#modal-name').value = name;
    $('#modal-color').value = color;
    $('#modal-color').style.display = showColor ? '' : 'none';
    $('#modal-color-label').style.display = showColor ? '' : 'none';
    $('#modal-back').style.display = 'flex';
    setTimeout(() => $('#modal-name').focus(), 0);
  });
}
function closeModal(val) {
  $('#modal-back').style.display = 'none';
  if (modalResolve) { const r = modalResolve; modalResolve = null; r(val); }
}
const modalOpen = () => $('#modal-back').style.display === 'flex';

/* ================= base style ================= */
async function loadBaseStyle() {
  try {
    const r = await fetch('https://tiles.openfreemap.org/styles/liberty');
    if (!r.ok) throw new Error('style');
    const s = await r.json();
    s.glyphs = s.glyphs || 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.utf8';
    const sym = s.layers.find((l) => l.type === 'symbol'
      && Array.isArray(l.layout && l.layout['text-font'])
      && typeof l.layout['text-font'][0] === 'string');
    if (sym) LABEL_FONT = sym.layout['text-font'];
    return s;
  } catch (e) {
    return {
      version: 8,
      glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.utf8',
      sources: {
        osm: {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
            'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
            'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
          ],
          tileSize: 256,
          attribution: '© OpenStreetMap, © CARTO'
        }
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': '#f4f4f4' } },
        { id: 'osm', type: 'raster', source: 'osm' }
      ]
    };
  }
}

/* ================= basemaps ================= */
let currentBasemapId = DEFAULT_BASEMAP_ID;

async function basemapStyle(id) {
  const bm = basemapById(id);
  if (!bm) return null;
  return bm.kind === 'liberty' ? await loadBaseStyle() : bm.style;
}

function buildBasemapSelect() {
  const sel = $('#basemap');
  if (!sel) return;
  const groups = new Map();
  for (const b of BASEMAPS) {
    let g = groups.get(b.group);
    if (!g) {
      g = document.createElement('optgroup');
      g.label = b.group;
      groups.set(b.group, g);
      sel.appendChild(g);
    }
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = b.label;
    g.appendChild(opt);
  }
  sel.value = currentBasemapId;
}

async function applyBasemap(id) {
  if (!basemapById(id) || id === currentBasemapId) return;
  const style = await basemapStyle(id);
  if (!style) return;
  await new Promise((resolve, reject) => {
    map.once('style.load', () => resolve());
    try { map.setStyle(style, { diff: false }); } catch (e) { reject(e); }
  });
  currentBasemapId = id;
  rebuildStyle();
  try { localStorage.setItem('basemap', id); } catch (e) { /* ignore */ }
}

/* ================= style building ================= */
const OVERLAY_DRAFT_FILL = 'fmO-draft-fill';

const DASH_NAMES = ['solid', 'dotted', 'dashed', 'dashdot'];
const DASH_ARRAYS = { solid: [1, 0], dotted: [1, 2], dashed: [5, 3], dashdot: [6, 2, 1, 2] };
const FONT_FAMILIES = {
  system: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  sans: 'Arial, Helvetica, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'Consolas, "Courier New", monospace',
  cursive: '"Comic Sans MS", cursive'
};

function addOverlayLayers() {
  if (!map.getSource('fmO-draft')) map.addSource('fmO-draft', { type: 'geojson', data: emptyFC() });
  if (!map.getSource('fmO-sel')) map.addSource('fmO-sel', { type: 'geojson', data: emptyFC() });
  if (!map.getSource('fmO-handles')) map.addSource('fmO-handles', { type: 'geojson', data: emptyFC() });
  if (!map.getSource('fmO-skel')) map.addSource('fmO-skel', { type: 'geojson', data: emptyFC() });
  if (!map.getSource('fmO-tangents')) map.addSource('fmO-tangents', { type: 'geojson', data: emptyFC() });

  const existing = map.getStyle().layers.map((l) => l.id);
  if (existing.includes(OVERLAY_DRAFT_FILL)) return;

  map.addLayer({ id: OVERLAY_DRAFT_FILL, type: 'fill', source: 'fmO-draft',
    filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['!=', ['get', 'arrowPreview'], true]],
    paint: { 'fill-color': '#4d8dff', 'fill-opacity': 0.18 } });
  map.addLayer({ id: 'fmO-arrow-preview', type: 'fill', source: 'fmO-draft',
    filter: ['==', ['get', 'arrowPreview'], true],
    paint: { 'fill-color': state.arrowStyle.color, 'fill-opacity': state.arrowStyle.opacity } });
  map.addLayer({ id: 'fmO-draft-line', type: 'line', source: 'fmO-draft',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#4d8dff', 'line-width': 2.5, 'line-dasharray': [2, 1.5] } });
  map.addLayer({ id: 'fmO-draft-verts', type: 'circle', source: 'fmO-draft',
    filter: ['==', ['geometry-type'], 'Point'],
    paint: { 'circle-color': '#ffffff', 'circle-radius': 4.5, 'circle-stroke-color': '#2d5bd1', 'circle-stroke-width': 2 } });

  map.addLayer({ id: 'fmO-sel-fill', type: 'fill', source: 'fmO-sel',
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.12 } });
  map.addLayer({ id: 'fmO-sel-line', type: 'line', source: 'fmO-sel',
    paint: { 'line-color': '#ffffff', 'line-width': 5, 'line-opacity': 0.75 } });
  map.addLayer({ id: 'fmO-sel-circle', type: 'circle', source: 'fmO-sel',
    filter: ['==', ['geometry-type'], 'Point'],
    paint: { 'circle-color': '#ffffff', 'circle-radius': 8, 'circle-stroke-color': '#2d5bd1', 'circle-stroke-width': 2.5 } });
  map.addLayer({ id: 'fmO-skel', type: 'line', source: 'fmO-skel',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#ffdd99', 'line-width': 1.5, 'line-opacity': 0.9, 'line-dasharray': [4, 4] } });
  map.addLayer({ id: 'fmO-handles', type: 'circle', source: 'fmO-handles',
    paint: { 'circle-color': '#2d5bd1', 'circle-radius': 6, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } });
  map.addLayer({ id: 'fmO-tangents', type: 'circle', source: 'fmO-tangents',
    paint: { 'circle-color': '#ffaa66', 'circle-radius': 5, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 } });
  handleR = 0; // пересчитать размеры ручек после пересоздания слоёв
}

// Ручки/выделение всегда поверх объектов (иначе их перекрывает заливка стрелки/полигона).
const OVERLAY_ORDER = [OVERLAY_DRAFT_FILL, 'fmO-arrow-preview', 'fmO-draft-line', 'fmO-draft-verts',
  'fmO-sel-fill', 'fmO-sel-line', 'fmO-sel-circle', 'fmO-skel', 'fmO-handles', 'fmO-tangents'];
function bringOverlaysToFront() {
  for (const id of OVERLAY_ORDER) { if (map.getLayer(id)) map.moveLayer(id); }
}

function rebuildStyle() {
  const ids = map.getStyle().layers.map((l) => l.id).filter((id) => id.startsWith('fmL-'));
  for (const id of ids) map.removeLayer(id);
  const srcs = Object.keys(map.getStyle().sources).filter((k) => k.startsWith('fmS-'));
  for (const k of srcs) map.removeSource(k);

  // снизу вверх: сервер отдаёт z_order DESC, реверсируем
  [...state.layers].reverse().forEach((L) => {
    map.addSource(`fmS-${L.id}`, { type: 'geojson', data: emptyFC() });
    const common = { source: `fmS-${L.id}`, beforeId: OVERLAY_DRAFT_FILL };
    const color = L.color || '#e63946';
    const arrowColor = ['coalesce', ['get', 'color'], color];
    const arrowOpacity = ['coalesce', ['get', 'opacity'], 0.6];
    const arrowGlowColor = ['coalesce', ['get', 'glowColor'], arrowColor];
    const arrowGlowBlur = ['coalesce', ['get', 'glowBlur'], 12];
    const arrowStrokeColor = ['coalesce', ['get', 'strokeColor'], '#ffffff'];
    const arrowStrokeWidth = ['coalesce', ['get', 'strokeWidth'], 2];
    const arrowStrokeOpacity = ['coalesce', ['get', 'strokeOpacity'], 1];
    const arrowStrokeDashed = ['coalesce', ['get', 'strokeDashed'], false];

    map.addLayer({ id: `fmL-fill-${L.id}`, type: 'fill', ...common,
      filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['!=', ['get', 'hatch'], true]],
      paint: {
        'fill-color': ['coalesce', ['get', 'color'], color],
        'fill-opacity': ['coalesce', ['get', 'opacity'], 0.25],
        'fill-outline-color': 'rgba(0,0,0,0)'
      } });

    map.addLayer({ id: `fmL-hatch-${L.id}`, type: 'fill', ...common,
      filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['==', ['get', 'hatch'], true]],
      paint: {
        'fill-pattern': ['coalesce', ['get', 'hatchImg'], 'fm-blank'],
        'fill-opacity': ['coalesce', ['get', 'opacity'], 0.25]
      } });

    map.addLayer({ id: `fmL-arrow-glow-${L.id}`, type: 'fill', ...common,
      filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['==', ['get', 'type'], 'arrow'], ['==', ['get', 'glowEnabled'], true]],
      paint: {
        'fill-color': arrowGlowColor,
        'fill-opacity': ['*', arrowOpacity, 0.3]
      } });

    map.addLayer({ id: `fmL-arrow-stroke-${L.id}`, type: 'line', ...common,
      filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['==', ['get', 'type'], 'arrow'], ['==', ['get', 'strokeEnabled'], true]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': arrowStrokeColor,
        'line-width': arrowStrokeWidth,
        'line-opacity': arrowStrokeOpacity,
        'line-dasharray': ['case', ['==', ['get', 'strokeDashed'], true], ['literal', [4, 4]], ['literal', [1, 0]]]
      } });

    // line-dasharray не поддерживает feature-выражения — отдельный слой на каждый тип обводки
    for (const dashName of DASH_NAMES) {
      map.addLayer({ id: `fmL-outline-${L.id}-${dashName}`, type: 'line', ...common,
        filter: ['all',
          ['==', ['geometry-type'], 'Polygon'],
          ['==', ['get', 'type'], 'polygon'],
          ['==', ['coalesce', ['get', 'outlineDash'], 'solid'], dashName]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['coalesce', ['get', 'outlineColor'], ['coalesce', ['get', 'color'], color]],
          'line-width': ['coalesce', ['get', 'outlineWidth'], 2],
          'line-dasharray': DASH_ARRAYS[dashName]
        } });
    }

    for (const dashName of DASH_NAMES) {
      map.addLayer({ id: `fmL-line-${L.id}-${dashName}`, type: 'line', ...common,
        filter: ['all',
          ['==', ['geometry-type'], 'LineString'],
          ['==', ['get', 'type'], 'line'],
          ['==', ['coalesce', ['get', 'dash'], 'solid'], dashName]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['coalesce', ['get', 'color'], color],
          'line-width': ['coalesce', ['get', 'width'], 3],
          'line-opacity': ['coalesce', ['get', 'opacity'], 1],
          'line-dasharray': DASH_ARRAYS[dashName]
        } });
    }

    // линейка: тело рисует MapLibre, деления и подписи — на оверлей-канве (drawRulers)
    map.addLayer({ id: `fmL-ruler-${L.id}`, type: 'line', ...common,
      filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'type'], 'ruler']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['coalesce', ['get', 'color'], '#e0b050'],
        'line-width': ['coalesce', ['get', 'width'], 3],
        'line-opacity': ['coalesce', ['get', 'opacity'], 1]
      } });

    // невидимая широкая линия — только для попадания клика/курсора
    map.addLayer({ id: `fmL-rulerhit-${L.id}`, type: 'line', ...common,
      filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'type'], 'ruler']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': 'rgba(0,0,0,0)', 'line-width': 16 } });

    map.addLayer({ id: `fmL-circle-${L.id}`, type: 'circle', ...common,
      filter: ['all', ['==', ['geometry-type'], 'Point'], ['!=', ['get', 'type'], 'label']],
      paint: {
        'circle-color': ['coalesce', ['get', 'color'], color],
        'circle-radius': ['coalesce', ['get', 'size'], 7],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5
      } });
  });

  addOverlayLayers();
  bringOverlaysToFront();
  refreshSources();
}

const emptyFC = () => ({ type: 'FeatureCollection', features: [] });

function featureGeometry(f) {
  const g = f.geometry;
  if (!g) return g;
  if (f.type === 'arrow' && g.type === 'LineString' && g.coordinates.length >= 2) {
    try {
      const p = f.properties || {};
      return arrowPolygonLngLat(g.coordinates, p, p.nodeMeta);
    } catch (e) { return null; }
  }
  if (f.type === 'line' && g.type === 'LineString' && g.coordinates.length >= 2
    && f.properties && f.properties.smooth) {
    try {
      const p = f.properties;
      const out = arrowOutline(g.coordinates, { stemMode: 'smooth', smoothAmount: p.smoothAmount }, p.nodeMeta);
      if (out && out.skeleton.length >= 2) return { type: 'LineString', coordinates: out.skeleton };
    } catch (e) { /* оставляем исходную геометрию */ }
  }
  return g;
}

function toGeoJSON(f) {
  const props = Object.assign({}, f.properties, { id: f.id, type: f.type });
  if (f.type === 'polygon' && f.properties && f.properties.fill === 'hatched') {
    props.hatch = true;
    props.hatchImg = hexOfColor(f.properties.color);
  }
  return { type: 'Feature', geometry: featureGeometry(f), properties: props };
}

function stemStyleOf(f) {
  const p = f.properties || {};
  const stemMode = f.type === 'line' ? (p.smooth ? 'smooth' : 'sharp') : (p.stemMode === 'smooth' ? 'smooth' : 'sharp');
  return { stemMode, smoothAmount: num(p.smoothAmount, 0.6) };
}

function handlesFor(feat) {
  const g = feat.geometry;
  const out = [];
  if (!g) return out;
  if (g.type === 'Point') out.push({ c: g.coordinates, ring: 0, i: 0 });
  else if (g.type === 'LineString') g.coordinates.forEach((c, i) => out.push({ c, ring: 0, i }));
  else if (g.type === 'MultiLineString') {
    g.coordinates.forEach((line, ri) => {
      line.forEach((c, i) => {
        // середина основания производная (отрезок A..B определяет её) — не редактируем
        if (ri === 1 && i === 0) return;
        out.push({ c, ring: ri, i });
      });
    });
  }
  else if (g.type === 'Polygon') {
    g.coordinates.forEach((ring, ri) => {
      const last = ring.length - 1;
      ring.forEach((c, i) => {
        if (i === last && c[0] === ring[0][0] && c[1] === ring[0][1]) return;
        out.push({ c, ring: ri, i });
      });
    });
  }
  return out;
}

function draftFC() {
  const fc = emptyFC();
  const d = state.draft;
  if (!d) return fc;
  if (d.type === 'ruler') return fc; // линейка рисуется на оверлей-канве
  if (d.type === 'arrow') {
    const nodes = d.nodes || [];
    if (!nodes.length) return fc;
    const pts = d.cursor ? [...nodes, d.cursor] : [...nodes];
    nodes.forEach((c) => fc.features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: {} }));
    if (pts.length >= 2) {
      fc.features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: pts }, properties: {} });
      try {
        const poly = arrowPolygonLngLat(pts, state.arrowStyle, null);
        if (poly) fc.features.push({ type: 'Feature', geometry: poly, properties: { arrowPreview: true } });
      } catch (e) { /* пока мало точек */ }
    }
    return fc;
  }
  if (!d.coords.length) return fc;
  const pts = [...d.coords];
  if (d.cursor) pts.push(d.cursor);
  if (d.type === 'line') {
    fc.features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: pts }, properties: {} });
    d.coords.forEach((c) => fc.features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: {} }));
  } else if (pts.length >= 2) {
    const ring = pts.slice();
    const a = ring[0], b = ring[ring.length - 1];
    if (a[0] !== b[0] || a[1] !== b[1]) ring.push(a);
    fc.features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} });
    d.coords.forEach((c) => fc.features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: {} }));
  }
  return fc;
}

function refreshSources() {
  ensureOverlayImages();

  const byLayer = new Map(state.layers.map((L) => [L.id, []]));
  for (const f of state.features) {
    if (!f.geometry) continue;
    const arr = byLayer.get(f.layer_id);
    if (arr) arr.push(toGeoJSON(f));
  }
  for (const L of state.layers) {
    const src = map.getSource(`fmS-${L.id}`);
    if (src) src.setData(L.visible ? { type: 'FeatureCollection', features: byLayer.get(L.id) || [] } : emptyFC());
  }

  const sel = state.features.find((f) => f.id === state.selectedId);
  const showGeomSel = sel && sel.geometry && sel.type !== 'label';
  map.getSource('fmO-sel').setData(showGeomSel
    ? { type: 'FeatureCollection', features: [toGeoJSON(sel)] } : emptyFC());
  map.getSource('fmO-handles').setData(sel && sel.type !== 'label'
    ? { type: 'FeatureCollection', features: handlesFor(sel).map((h) => ({
        type: 'Feature', geometry: { type: 'Point', coordinates: h.c },
        properties: { index: h.i, ring: h.ring }
      })) }
    : emptyFC());

  // скелет и ручки сглаживания выбранной стрелки/линии
  let skel = emptyFC();
  let tangents = emptyFC();
  const isSmoothSkeleton = sel && sel.geometry && sel.geometry.type === 'LineString'
    && (sel.type === 'arrow' || sel.type === 'line');
  if (isSmoothSkeleton) {
    const p = sel.properties || {};
    const out = arrowOutline(sel.geometry.coordinates, stemStyleOf(sel), p.nodeMeta);
    if (out) {
      skel = { type: 'FeatureCollection', features: [
        { type: 'Feature', geometry: { type: 'LineString', coordinates: out.skeleton }, properties: {} }
      ] };
      if (out.smooth) {
        const feats = [];
        out.handles.forEach((h, i) => {
          feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: h.in }, properties: { index: i, which: 'in', auto: h.auto } });
          feats.push({ type: 'Feature', geometry: { type: 'Point', coordinates: h.out }, properties: { index: i, which: 'out', auto: h.auto } });
        });
        tangents = { type: 'FeatureCollection', features: feats };
      }
    }
  }
  map.getSource('fmO-skel').setData(skel);
  map.getSource('fmO-tangents').setData(tangents);
  map.getSource('fmO-draft').setData(draftFC());
  updateHandleSizes();
  syncMarkers();
  syncAreaLabels();
  drawRulers();
}

function hexOfColor(c) {
  return 'fm-hatch-' + String(c || '#e63946').replace(/[^0-9a-f]/gi, '').toLowerCase();
}

function ensureOverlayImages() {
  if (!map || typeof map.hasImage !== 'function') return;
  try {
    if (!map.hasImage('fm-blank')) {
      const c = document.createElement('canvas');
      c.width = 2; c.height = 2;
      map.addImage('fm-blank', c.getContext('2d').getImageData(0, 0, 2, 2));
    }
    for (const f of state.features) {
      if (f.type !== 'polygon' || !f.properties || f.properties.fill !== 'hatched') continue;
      const id = hexOfColor(f.properties.color);
      if (map.hasImage(id)) continue;
      const S = 12;
      const c = document.createElement('canvas');
      c.width = S; c.height = S;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, S, S);
      ctx.strokeStyle = f.properties.color || '#e63946';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = -S; x <= S; x += 6) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x + S, S);
      }
      ctx.stroke();
      map.addImage(id, ctx.getImageData(0, 0, S, S));
    }
  } catch (e) { /* стиль ещё не готов */ }
}

function applyTextStyle(el, ls) {
  el.style.color = ls.color;
  el.style.fontSize = ls.size + 'px';
  el.style.fontFamily = FONT_FAMILIES[ls.font] || FONT_FAMILIES.system;
  el.style.fontWeight = ls.bold ? '700' : '400';
  el.style.fontStyle = ls.italic ? 'italic' : 'normal';
  const deco = [];
  if (ls.underline) deco.push('underline');
  if (ls.strike) deco.push('line-through');
  el.style.textDecoration = deco.length ? deco.join(' ') : 'none';
  el.style.opacity = String(ls.opacity);
  if (ls.haloWidth > 0) {
    el.style.webkitTextStroke = `${ls.haloWidth}px ${ls.haloColor}`;
    el.style.paintOrder = 'stroke fill';
  } else {
    el.style.webkitTextStroke = '';
  }
  el.style.background = ls.bg ? ls.bgColor : 'transparent';
  el.style.padding = ls.bg ? '2px 6px' : '0';
  el.style.borderRadius = ls.bg ? '4px' : '0';
}

function syncMarkers() {
  if (!map) return;
  const keep = new Set();
  for (const f of state.features) {
    if (!f.geometry || f.geometry.type !== 'Point') continue;
    const layer = state.layers.find((l) => l.id === f.layer_id);
    if (layer && !layer.visible) continue;
    let text = '';
    let ls = null;
    let anchor = 'center';
    let offset = [0, 0];
    if (f.type === 'label') {
      text = f.properties.text || '';
      ls = normalizeTextStyle(f.properties.label);
    } else if (f.type === 'point') {
      const p = f.properties || {};
      const show = p.caption && (p.captionMode === 'always'
        || (p.captionMode === 'selected' && f.id === state.selectedId));
      if (!show) continue;
      text = p.caption;
      ls = normalizeTextStyle(p.label);
      anchor = 'top';
      offset = [0, 14];
    } else continue;
    if (!text) continue;
    keep.add(f.id);
    let entry = state.markers.get(f.id);
    if (!entry) {
      const el = document.createElement('div');
      el.className = 'fm-text-marker';
      el.addEventListener('click', (ev) => { ev.stopPropagation(); select(f.id); });
      el.addEventListener('mousedown', (ev) => {
        if (state.moveMode && state.selectedId === f.id && state.tool === 'select') {
          ev.preventDefault();
          beginMove(markerLngLat(ev));
          return;
        }
        ev.stopPropagation();
      });
      const marker = new maplibregl.Marker({ element: el, anchor, offset })
        .setLngLat(f.geometry.coordinates).addTo(map);
      entry = { marker, el, anchor };
      state.markers.set(f.id, entry);
    }
    entry.el.textContent = text;
    const pe = (state.tool === 'select') ? 'auto' : 'none';
    entry.el.style.pointerEvents = pe;
    entry.marker.getElement().style.pointerEvents = pe;
    entry.el.classList.toggle('selected', f.id === state.selectedId);
    entry.el.style.cursor = (state.moveMode && state.selectedId === f.id) ? 'grab' : 'pointer';
    applyTextStyle(entry.el, ls);
    entry.marker.setLngLat(f.geometry.coordinates);
  }
  for (const [id, entry] of state.markers) {
    if (!keep.has(id)) { entry.marker.remove(); state.markers.delete(id); }
  }
}

/* ================= измерения (площадь/длина) ================= */
function syncAreaLabels() {
  if (!map) return;
  const keep = new Set();
  for (const f of state.features) {
    const g = f.geometry;
    if (!g || f.type !== 'polygon') continue;
    if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') continue;
    const layer = state.layers.find((l) => l.id === f.layer_id);
    if (layer && !layer.visible) continue;
    const pt = polygonLabelPoint(g);
    if (!pt) continue;
    keep.add(f.id);
    let marker = state.areaMarkers.get(f.id);
    if (!marker) {
      const el = document.createElement('div');
      el.className = 'fm-area-label';
      marker = new maplibregl.Marker({ element: el });
      marker.setLngLat(pt).addTo(map);
      state.areaMarkers.set(f.id, marker);
    }
    const el = marker.getElement();
    el.textContent = formatArea(polygonAreaKm2(g));
    applyAreaLabelStyle(el, f.properties);
    applyAreaLabelFit(el, g);
    marker.setLngLat(pt);
  }
  for (const [id, marker] of state.areaMarkers) {
    if (!keep.has(id)) { marker.remove(); state.areaMarkers.delete(id); }
  }
}

// Скрывает подпись площади, если её размер не помещается в экранные габариты полигона.
function applyAreaLabelFit(el, geom) {
  if (!map || !geom) return;
  el.style.display = '';
  const rings = geom.type === 'Polygon' ? geom.coordinates : geom.coordinates.flat();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const ring of rings) {
    for (const c of ring) {
      const p = map.project(c);
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }
  const w = maxX - minX, h = maxY - minY;
  const lw = el.offsetWidth, lh = el.offsetHeight;
  el.style.display = (isFinite(w) && w >= lw && h >= lh) ? '' : 'none';
}

function updateAreaLabelVisibility() {
  if (!map) return;
  for (const f of state.features) {
    if (f.type !== 'polygon' || !f.geometry) continue;
    const marker = state.areaMarkers.get(f.id);
    if (marker) applyAreaLabelFit(marker.getElement(), f.geometry);
  }
}

/* ================= линейка (оверлей-канва) =================
   Тело линейки рисует MapLibre (слой fmL-ruler-*), а деления, подписи делений
   и итоговую длину — эта канва поверх карты. Механика делений/подписей и подбор
   шага делений портированы из polygon-and-ruler-example.html. */
let rulerCanvas = null;
let rulerCtx = null;
let rulerDpr = 1;
const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));

function initRulerCanvas() {
  rulerCanvas = document.getElementById('ruler-layer');
  if (!rulerCanvas) return;
  rulerCtx = rulerCanvas.getContext('2d');
  resizeRulerCanvas();
}

function resizeRulerCanvas() {
  if (!rulerCanvas || !map) return;
  const el = map.getContainer();
  const w = Math.max(1, el.clientWidth || 1);
  const h = Math.max(1, el.clientHeight || 1);
  rulerDpr = window.devicePixelRatio || 1;
  rulerCanvas.width = Math.round(w * rulerDpr);
  rulerCanvas.height = Math.round(h * rulerDpr);
  rulerCanvas.style.width = w + 'px';
  rulerCanvas.style.height = h + 'px';
  drawRulers();
}

function drawRulers() {
  if (!rulerCtx || !map) return;
  const w = rulerCanvas.width / rulerDpr;
  const h = rulerCanvas.height / rulerDpr;
  rulerCtx.setTransform(rulerDpr, 0, 0, rulerDpr, 0, 0);
  rulerCtx.clearRect(0, 0, w, h);

  for (const f of state.features) {
    if (f.type !== 'ruler' || !f.geometry || f.geometry.type !== 'LineString') continue;
    const coords = f.geometry.coordinates;
    if (coords.length < 2) continue;
    const layer = state.layers.find((l) => l.id === f.layer_id);
    if (layer && !layer.visible) continue;
    drawRulerPath(rulerCtx, coords, f.properties, { drawBody: false, preview: false });
  }

  const d = state.draft;
  if (d && d.type === 'ruler' && d.coords && d.coords.length >= 1) {
    const pts = d.coords.slice();
    if (d.cursor) pts.push(d.cursor);
    drawRulerPath(rulerCtx, pts, state.rulerStyle, { drawBody: true, preview: true });
  }
}

// Ломаная линейка: тело (если черновик), деления/подписи по сегментам с накоплением
// метража, заливка полигона и подпись площади для ≥3 точек, итоговая длина.
function drawRulerPath(ctx, ptsLL, props, opts) {
  const o = opts || {};
  if (!ptsLL || ptsLL.length < 2) return;
  const p = normalizeRulerStyle(props);
  const multi = ptsLL.length >= 3;
  if (multi) drawRulerPolygon(ctx, ptsLL, p);

  if (o.drawBody) {
    const first = map.project(ptsLL[0]);
    ctx.save();
    ctx.globalAlpha = clamp01(p.opacity);
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < ptsLL.length; i++) { const q = map.project(ptsLL[i]); ctx.lineTo(q.x, q.y); }
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = p.color;
    ctx.lineWidth = p.width;
    ctx.setLineDash(o.preview ? [8, 6] : []);
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.restore();
  }

  let acc = 0;
  for (let i = 0; i < ptsLL.length - 1; i++) {
    const a = ptsLL[i], b = ptsLL[i + 1];
    const isLast = i === ptsLL.length - 2;
    drawRulerOverlay(ctx, a, b, p, {
      drawBody: false,
      preview: o.preview,
      startMeters: acc,
      drawTotal: !multi && isLast
    });
    acc += lineLengthKm([a, b]) * 1000;
  }

  if (multi && p.showLabels) {
    const totalMeters = lineLengthKm(ptsLL) * 1000;
    const mid = pathMidpoint(ptsLL);
    const midS = map.project(mid);
    drawRotatedText(ctx, formatLength(totalMeters / 1000), midS.x, midS.y, 0, p.labelColor || p.color, p.fontSize + 2);
    const area = polygonAreaKm2({ type: 'Polygon', coordinates: [ptsLL] });
    if (area > 0) {
      const c = ringCentroid(ptsLL);
      const cp = map.project([c.x, c.y]);
      drawRotatedText(ctx, formatArea(area), cp.x, cp.y, 0, p.labelColor || p.color, p.fontSize + 1);
    }
  }
}

function pathMidpoint(ptsLL) {
  let total = 0;
  const segs = [];
  for (let i = 0; i < ptsLL.length - 1; i++) {
    const m = lineLengthKm([ptsLL[i], ptsLL[i + 1]]);
    segs.push(m);
    total += m;
  }
  let acc = 0;
  const target = total / 2;
  for (let i = 0; i < segs.length; i++) {
    if (acc + segs[i] >= target) {
      const t = segs[i] > 0 ? (target - acc) / segs[i] : 0;
      const a = ptsLL[i], b = ptsLL[i + 1];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    acc += segs[i];
  }
  return ptsLL[Math.floor(ptsLL.length / 2)];
}

function hexToRgba(hex, a) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return `rgba(224,176,80,${a})`;
  let s = m[1];
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  const n = parseInt(s, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function drawRulerPolygon(ctx, ptsLL, p) {
  if (ptsLL.length < 3) return;
  ctx.save();
  ctx.globalAlpha = clamp01(p.opacity);
  const first = map.project(ptsLL[0]);
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < ptsLL.length; i++) { const q = map.project(ptsLL[i]); ctx.lineTo(q.x, q.y); }
  ctx.closePath();
  ctx.fillStyle = hexToRgba(p.color, 0.16);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(p.color, 0.55);
  ctx.lineWidth = 1.25;
  ctx.setLineDash([6, 5]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawRotatedText(ctx, text, x, y, angle, color, fontSize, weight) {
  let ta = angle;
  if (ta > Math.PI / 2) ta -= Math.PI;
  if (ta < -Math.PI / 2) ta += Math.PI;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ta);
  ctx.font = `${weight || 'bold'} ${fontSize}px "Segoe UI", Roboto, system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.shadowColor = 'rgba(0,0,0,0.75)';
  ctx.shadowBlur = 5;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// Механика отрисовки линейки портирована из polygon-and-ruler-example.html.
function drawRulerOverlay(ctx, startLL, endLL, props, opts) {
  const p = normalizeRulerStyle(props);
  const o = opts || {};
  const sS = map.project(startLL);
  const eS = map.project(endLL);
  const dxS = eS.x - sS.x, dyS = eS.y - sS.y;
  const lenS = Math.hypot(dxS, dyS);
  if (lenS < 1) return;

  const angle = Math.atan2(dyS, dxS);
  const lat = (startLL[1] + endLL[1]) / 2;
  const mpp = metersPerPixel(lat) || 1;
  const totalMeters = lenS * mpp;
  const baseAlpha = clamp01(p.opacity);

  const nx = dxS / lenS, ny = dyS / lenS;
  const perpX = -ny, perpY = nx;
  const color = p.color;

  ctx.save();
  ctx.globalAlpha = baseAlpha;

  // тело рисуем только для черновика (у сохранённых — слой MapLibre)
  if (o.drawBody) {
    ctx.beginPath();
    ctx.moveTo(sS.x, sS.y);
    ctx.lineTo(eS.x, eS.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = p.width;
    ctx.setLineDash(o.preview ? [8, 6] : []);
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
  }

  const majorMeters = pickRulerMajorUnit(lenS, mpp);
  const majorPxS = majorMeters / mpp;
  const mediumPxS = majorPxS / 2;
  const smallPxS = majorPxS / 10;

  let baseTick;
  if (lenS < 60) baseTick = 5;
  else if (lenS < 120) baseTick = 7;
  else if (lenS < 250) baseTick = 9;
  else if (lenS < 450) baseTick = 11;
  else baseTick = 13;

  const majorTick = Math.max(4, Math.min(baseTick, majorPxS / 3));
  const mediumTick = Math.max(3.5, majorTick * 0.7);
  const smallTick = Math.max(3, majorTick * 0.55);

  const labelColor = p.labelColor || color;

  if (p.showTicks) {
    const drawSmall = smallPxS >= 2;
    const drawMedium = mediumPxS >= 3;
    const numSteps = Math.min(6000, Math.floor(lenS / smallPxS));
    for (let i = 0; i <= numSteps; i++) {
      const dS = i * smallPxS;
      if (dS > lenS + 0.01) break;
      const px = sS.x + nx * dS;
      const py = sS.y + ny * dS;
      const isMajor = (i % 10 === 0);
      const isMedium = (i % 5 === 0) && !isMajor;
      if (!isMajor && !isMedium && !drawSmall) continue;
      if (isMedium && !drawMedium) continue;
      let tl, lw, alpha;
      if (isMajor) { tl = majorTick; lw = 2.2; alpha = 1; }
      else if (isMedium) { tl = mediumTick; lw = 1.6; alpha = 0.85; }
      else { tl = smallTick; lw = 1.1; alpha = 0.65; }
      ctx.globalAlpha = baseAlpha * alpha;
      ctx.beginPath();
      ctx.moveTo(px - perpX * tl, py - perpY * tl);
      ctx.lineTo(px + perpX * tl, py + perpY * tl);
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
    ctx.globalAlpha = baseAlpha;
  }

  if (p.showLabels) {
    const MIN_LABEL_DIST = 48;
    let labelStep = majorPxS < MIN_LABEL_DIST ? 2 : 1;
    if (majorPxS * labelStep >= MIN_LABEL_DIST) {
      const numMajor = Math.floor(lenS / majorPxS);
      for (let i = 0; i <= numMajor; i += labelStep) {
        const dS = i * majorPxS;
        if (dS > lenS + 0.01) break;
        const px = sS.x + nx * dS;
        const py = sS.y + ny * dS;
        const off = majorTick + 9;
        drawRotatedText(ctx, formatUnit((o.startMeters || 0) + i * majorMeters), px - perpX * off, py - perpY * off,
          angle, p.labelColor, p.fontSize);
      }
    }
  }

  // итоговая длина — по центру, с другой стороны от делений
  if (p.showLabels && o.drawTotal !== false) {
    const midX = (sS.x + eS.x) / 2, midY = (sS.y + eS.y) / 2;
    const totalOff = majorTick + 14;
    drawRotatedText(ctx, formatLength(totalMeters / 1000), midX + perpX * totalOff, midY + perpY * totalOff,
      angle, p.labelColor, p.fontSize + 2);
  }

  if (o.preview) {
    ctx.globalAlpha = baseAlpha;
    ctx.beginPath();
    ctx.arc(sS.x, sS.y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = '#0f1a24'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath();
    ctx.arc(eS.x, eS.y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = '#101b24'; ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.stroke();
  }

  ctx.restore();
}

function applyAreaLabelStyle(el, props) {
  const s = normalizePolygonStyle(props);
  el.style.color = s.areaColor;
  el.style.fontSize = s.areaFontSize + 'px';
  if (s.areaBg) {
    el.style.background = '#1b1e24cc';
    el.style.border = '1px solid #3a4250';
    el.style.borderRadius = '5px';
    el.style.padding = '2px 6px';
    el.style.boxShadow = '0 2px 8px #0006';
    el.style.textShadow = 'none';
  } else {
    el.style.background = 'transparent';
    el.style.border = 'none';
    el.style.borderRadius = '0';
    el.style.padding = '0';
    el.style.boxShadow = 'none';
    el.style.textShadow = '0 0 3px #000, 0 0 2px #000';
  }
}


/* ================= data loading ================= */
async function reload() {
  const q = state.date ? `?date=${encodeURIComponent(state.date)}` : '';
  const data = await api.get('/api/map' + q);
  state.layers = data.layers;
  state.features = data.features;

  if (!state.layers.length) {
    await api.send('POST', '/api/layers', { name: 'Слой 1', color: '#e63946' });
    const again = await api.get('/api/map' + q);
    state.layers = again.layers;
    state.features = again.features;
  }
  if (!state.layers.some((l) => l.id === state.activeLayerId)) {
    state.activeLayerId = state.layers[0] ? state.layers[0].id : null;
  }
  if (state.selectedId && !state.features.some((f) => f.id === state.selectedId)) {
    state.selectedId = null;
    state.dates = null;
  }
  rebuildStyle();
  renderLayerList();
  updateArrowPanel();
  updateDatesPanel();
}

/* ================= timeline ================= */
function renderTimeline() {
  const el = $('#tl-date');
  if (el) el.textContent = fmtDay(state.date || todayDay());
  const now = $('#tl-now');
  if (now) now.classList.toggle('hist', state.date !== null);
}

/* переход на произвольный день (календарь) */
async function setDay(day) {
  state.date = day || null;
  closeCalendar();
  renderTimeline();
  updateHint();
  try { await reload(); } catch (e) { toast('Ошибка: ' + e.message); }
}

/* сдвиг на соседний день */
function stepDay(n) {
  setDay(shiftDay(state.date || todayDay(), n));
}

/* ================= calendar ================= */
function openCalendar() {
  const base = state.date ? new Date(state.date + 'T00:00:00') : new Date();
  state.calView = new Date(base.getFullYear(), base.getMonth(), 1);
  renderCalendar();
  $('#calendar').classList.remove('hidden');
}

function closeCalendar() {
  const cal = $('#calendar');
  if (cal) cal.classList.add('hidden');
}

function renderCalendar() {
  const cal = $('#calendar');
  if (!cal || !state.calView) return;
  const y = state.calView.getFullYear();
  const m = state.calView.getMonth();
  const sel = state.date;
  const today = todayDay();
  const startDow = (new Date(y, m, 1).getDay() + 6) % 7; // Пн = 0
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const dow = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  let html = `<div id="cal-head">
    <button class="icon-btn" data-cal="prev" title="Предыдущий месяц">‹</button>
    <span class="cal-title">${MONTHS_RU[m]} ${y}</span>
    <button class="icon-btn" data-cal="next" title="Следующий месяц">›</button>
  </div><div id="cal-grid">`;
  dow.forEach((d) => { html += `<span class="cal-dow">${d}</span>`; });
  for (let i = 0; i < startDow; i++) html += '<span></span>';
  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cls = ['cal-day'];
    if (dayStr === today) cls.push('today');
    if (dayStr === sel) cls.push('sel');
    html += `<button class="${cls.join(' ')}" data-day="${dayStr}">${day}</button>`;
  }
  html += '</div>';
  cal.innerHTML = html;

  cal.querySelectorAll('[data-cal]').forEach((b) => {
    b.onclick = () => {
      state.calView = new Date(y, m + (b.dataset.cal === 'next' ? 1 : -1), 1);
      renderCalendar();
    };
  });
  cal.querySelectorAll('[data-day]').forEach((b) => {
    b.onclick = () => setDay(b.dataset.day);
  });
}

/* ================= dates panel ================= */
async function refreshDates() {
  if (!state.selectedId) { state.dates = null; updateDatesPanel(); return; }
  try { state.dates = await api.get(`/api/features/${state.selectedId}/dates`); }
  catch (e) { state.dates = null; }
  updateDatesPanel();
}

function updateDatesPanel() {
  const f = state.features.find((x) => x.id === state.selectedId);
  applyPanelVisibility();
  if (!f) return;

  const d = state.dates && state.dates.id === f.id ? state.dates : null;
  $('#dates-created').value = (d && d.created_at) || f.created_at || '';
  $('#dates-deleted').value = (d && d.deleted_at) || '';

  const box = $('#dates-changes');
  box.innerHTML = '';
  const changes = (d && d.changes) || [];
  if (!changes.length) {
    const empty = document.createElement('div');
    empty.className = 'as-row';
    empty.style.color = '#8a93a2';
    empty.textContent = '—';
    box.appendChild(empty);
    return;
  }
  for (const c of changes) {
    const row = document.createElement('div');
    row.className = 'dates-row';
    const inp = document.createElement('input');
    inp.type = 'date';
    inp.value = c.valid_from;
    inp.addEventListener('change', async () => {
      try {
        await api.send('PATCH', `/api/features/${f.id}/versions/${c.id}`, { valid_from: inp.value });
        await reload();
        await refreshDates();
      } catch (e) { toast('Ошибка: ' + e.message); refreshDates(); }
    });
    const go = document.createElement('button');
    go.className = 'icon-btn';
    go.textContent = '↧';
    go.title = 'Перейти к этой дате';
    go.onclick = () => setDay(c.valid_from);
    row.append(inp, go);
    box.appendChild(row);
  }
}

/* ================= delete modal ================= */
let deleteResolve = null;
function askDelete() {
  return new Promise((resolve) => {
    deleteResolve = resolve;
    $('#delete-date').textContent = fmtDay(state.date || todayDay());
    $('#delete-back').style.display = 'flex';
  });
}
function closeDelete(v) {
  $('#delete-back').style.display = 'none';
  const r = deleteResolve; deleteResolve = null;
  if (r) r(v);
}
const deleteOpen = () => $('#delete-back').style.display === 'flex';

/* ================= layers UI ================= */
function countFeatures(layerId) {
  return state.features.filter((f) => f.layer_id === layerId).length;
}

// Суммарная площадь всех полигонов слоя (км²).
function layerAreaKm2(layerId) {
  let sum = 0;
  for (const f of state.features) {
    if (f.layer_id !== layerId || f.type !== 'polygon' || !f.geometry) continue;
    sum += polygonAreaKm2(f.geometry);
  }
  return sum;
}

function renderLayerList() {
  const box = $('#layer-list');
  box.innerHTML = '';
  for (const L of state.layers) {
    const item = document.createElement('div');
    item.className = 'layer-item' + (L.id === state.activeLayerId ? ' active' : '') + (L.visible ? '' : ' hidden-layer');

    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.background = L.color;

    const nm = document.createElement('span');
    nm.className = 'lname';
    nm.textContent = L.name;
    nm.title = L.name;

    const cnt = countFeatures(L.id);
    const areaKm2 = layerAreaKm2(L.id);
    const metaText = areaKm2 > 0 ? `${cnt} · ${formatArea(areaKm2)}` : String(cnt);

    const main = document.createElement('div');
    main.className = 'lmain';
    const row1 = document.createElement('div');
    row1.className = 'lrow1';
    row1.appendChild(sw);
    row1.appendChild(nm);
    const meta = document.createElement('span');
    meta.className = 'lmeta';
    meta.textContent = metaText;
    meta.title = areaKm2 > 0
      ? `Объектов: ${cnt}; суммарная площадь полигонов: ${formatArea(areaKm2)}`
      : `Объектов: ${cnt}`;
    main.appendChild(row1);
    main.appendChild(meta);

    const mk = (txt, title, fn) => {
      const b = document.createElement('button');
      b.className = 'icon-btn';
      b.textContent = txt;
      b.title = title;
      b.onclick = (e) => { e.stopPropagation(); fn(); };
      return b;
    };

    item.append(main,
      mk(L.visible ? '👁' : '🚫', 'Показать/скрыть', async () => {
        try { await api.send('PATCH', `/api/layers/${L.id}`, { visible: !L.visible }); await reload(); }
        catch (e) { toast('Ошибка: ' + e.message); }
      }),
      mk('↑', 'Выше', () => moveLayer(L, -1)),
      mk('✎', 'Переименовать / цвет', async () => {
        const r = await promptModal({ title: 'Слой', name: L.name, color: L.color });
        if (!r || !r.name.trim()) return;
        try { await api.send('PATCH', `/api/layers/${L.id}`, { name: r.name.trim(), color: r.color.trim() || L.color }); await reload(); }
        catch (e) { toast('Ошибка: ' + e.message); }
      }),
      mk('🗑', 'Удалить слой', async () => {
        if (!confirm(`Удалить слой «${L.name}» со всеми элементами?`)) return;
        try { await api.send('DELETE', `/api/layers/${L.id}`); if (state.activeLayerId === L.id) state.activeLayerId = null; await reload(); }
        catch (e) { toast('Ошибка: ' + e.message); }
      })
    );
    item.onclick = () => {
      state.activeLayerId = L.id;
      $('#active-layer-name').textContent = L.name;
      renderLayerList();
    };
    box.appendChild(item);
  }
  const active = state.layers.find((l) => l.id === state.activeLayerId);
  $('#active-layer-name').textContent = active ? active.name : '—';
}

async function moveLayer(L, dir) {
  const idx = state.layers.findIndex((l) => l.id === L.id);
  const other = state.layers[idx + dir]; // список в порядке DESC: idx-1 выше по z
  if (!other) return;
  try {
    await api.send('PATCH', `/api/layers/${L.id}`, { z_order: other.z_order });
    await api.send('PATCH', `/api/layers/${other.id}`, { z_order: L.z_order });
    await reload();
  } catch (e) { toast('Ошибка: ' + e.message); }
}

async function addLayer() {
  const r = await promptModal({ title: 'Новый слой', name: '', color: '#e63946' });
  if (!r || !r.name.trim()) return;
  try {
    const created = await api.send('POST', '/api/layers', { name: r.name.trim(), color: r.color.trim() || '#e63946' });
    state.activeLayerId = created.id;
    await reload();
  } catch (e) { toast('Ошибка: ' + e.message); }
}

/* ================= drawing ================= */
function setTool(t) {
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

function updateHint() {
  const h = $('#hint');
  if (state.appendArrow) {
    h.style.display = 'block';
    h.textContent = 'Дорисовка стрелки: клик — добавить узел · ПКМ / Esc — завершить';
    return;
  }
  if (state.tool === 'arrow') {
    h.style.display = 'block';
    const n = state.draft && state.draft.nodes ? state.draft.nodes.length : 0;
    h.textContent = n
      ? 'Shift+клик — добавить узел · ПКМ / Enter / двойной клик — завершить · Esc — отмена'
      : 'Клик — начало стрелки · Shift+клик — несколько узлов · ПКМ / Enter — завершить';
    return;
  }
  if (state.tool === 'ruler') {
    h.style.display = 'block';
    const n = state.draft && state.draft.coords ? state.draft.coords.length : 0;
    h.textContent = n >= 2
      ? 'Shift+клик — добавить точку · клик по первой точке / ПКМ / Enter / двойной клик — завершить · Esc — отмена'
      : (n === 1
        ? 'Клик — вторая точка (фиксация) · Shift+клик — добавить точку (ломаная) · Esc — отмена'
        : 'Клик — начало линейки · Shift+клик — ломаная из нескольких точек · Esc — отмена');
    return;
  }
  const msgs = {
    line: 'Клик — линия · Shift+клик — добавить точку · Enter / двойной клик — завершить · Esc — отмена',
    polygon: 'Клик — добавить точку · клик по первой точке / Enter — закрыть · Esc — отмена',
    point: 'Клик по карте — поставить точку',
    label: 'Клик по карте — создать надпись',
    ruler: 'Клик — начало линейки · клик — вторая точка (фиксация) · Esc — отмена',
    select: 'Клик — выбрать элемент · тяните синие точки · Del — удалить'
  };
  if (msgs[state.tool]) { h.style.display = 'block'; h.textContent = msgs[state.tool]; }
  else h.style.display = 'none';
}

function ensureCanDraw() {
  const L = state.layers.find((l) => l.id === state.activeLayerId);
  if (!L) { toast('Нет активного слоя'); return false; }
  if (!L.visible) { toast('Активный слой скрыт — включите его'); return false; }
  return true;
}

async function createFeature({ layer_id, type, geometry, properties }) {
  try {
    const body = { layer_id, type, geometry, properties };
    if (state.date) body.date = state.date;
    const created = await api.send('POST', '/api/features', body);
    state.features.push(created);
    refreshSources();
    renderLayerList();
    setTool('select'); // после рисования возвращаемся в режим выбора
    return created;
  } catch (e) { toast('Ошибка: ' + e.message); return null; }
}

function finishDraft() {
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

function defaultPropsFor(type) {
  if (type === 'line') return { ...state.lineStyle };
  if (type === 'polygon') return { ...state.polygonStyle };
  if (type === 'point') return { ...state.pointStyle, label: { ...state.pointStyle.label } };
  if (type === 'label') return { ...state.labelStyle, label: { ...state.labelStyle.label } };
  if (type === 'arrow') return { ...state.arrowStyle };
  if (type === 'ruler') return { ...state.rulerStyle };
  return {};
}

function commitDraft(geometry, type) {
  state.draft = null;
  refreshSources();
  createFeature({ layer_id: state.activeLayerId, type, geometry, properties: defaultPropsFor(type) })
    .then((created) => {
      if ((type === 'arrow' || type === 'ruler') && created) { select(created.id); updateArrowPanel(); }
    });
}

function cancelDraft() {
  if (state.draft) { state.draft = null; refreshSources(); return true; }
  return false;
}

/* ================= selection & editing ================= */
function select(id) {
  if (state.moveMode && id !== state.selectedId) setMoveMode(false);
  state.selectedId = id;
  state.appendArrow = false;
  const f = state.features.find((x) => x.id === id);
  // стиль панели всегда отражает выбранный элемент (иначе правка одного поля затирала бы остальные)
  if (f) {
    if (f.type === 'arrow') state.arrowStyle = normalizeArrowStyle(f.properties);
    else if (f.type === 'line') state.lineStyle = normalizeLineStyle(f.properties);
    else if (f.type === 'polygon') state.polygonStyle = normalizePolygonStyle(f.properties);
    else if (f.type === 'point') state.pointStyle = normalizePointStyle(f.properties);
    else if (f.type === 'label') state.labelStyle = normalizeLabelStyle(f.properties);
    else if (f.type === 'ruler') state.rulerStyle = normalizeRulerStyle(f.properties);
  }
  refreshSources();
  updateArrowPanel();
  refreshDates();
}

function selectedArrow() {
  const f = state.features.find((x) => x.id === state.selectedId);
  return f && f.type === 'arrow' ? f : null;
}

// Единая отрисовка панели стиля стрелки (раньше дублировалась в renderArrowValues/updateArrowPanel).
function renderArrowPanel() {
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

const STYLE_KEY = { line: 'lineStyle', polygon: 'polygonStyle', point: 'pointStyle', label: 'labelStyle', arrow: 'arrowStyle', ruler: 'rulerStyle' };

function styleStateOf(type) { return state[STYLE_KEY[type]]; }

function activeSelected(type) {
  const f = state.features.find((x) => x.id === state.selectedId);
  return f && f.type === type ? f : null;
}

function syncStyle(type) {
  const s = styleStateOf(type);
  let normalized = s;
  if (type === 'line') normalized = state.lineStyle = normalizeLineStyle(s);
  else if (type === 'polygon') normalized = state.polygonStyle = normalizePolygonStyle(s);
  else if (type === 'point') normalized = state.pointStyle = normalizePointStyle(s);
  else if (type === 'label') normalized = state.labelStyle = normalizeLabelStyle(s);
  else if (type === 'ruler') normalized = state.rulerStyle = normalizeRulerStyle(s);
  const sel = activeSelected(type);
  if (sel) {
    sel.properties = { ...sel.properties, ...normalized };
    scheduleArrowPut(sel);
  }
  refreshSources();
  updateArrowPanel();
}

function updateArrowPanel() {
  renderArrowPanel();
  updateLinePanel();
  updatePolygonPanel();
  updatePointPanel();
  updateLabelPanel();
  updateRulerPanel();
  renderMoveButtons();
  if (panels) applyPanelVisibility();
}

function renderMoveButtons() {
  document.querySelectorAll('[data-move]').forEach((b) => {
    const active = !!activeSelected(b.dataset.move) && state.tool === 'select';
    b.disabled = !active;
    b.classList.toggle('on', active && state.moveMode);
  });
}

function canvasLngLat(clientX, clientY) {
  const rect = map.getCanvas().getBoundingClientRect();
  const p = map.unproject([clientX - rect.left, clientY - rect.top]);
  return [p.lng, p.lat];
}

function markerLngLat(ev) { return canvasLngLat(ev.clientX, ev.clientY); }

function translateGeom(geom, orig, dx, dy) {
  if (!geom || !orig) return;
  if (geom.type === 'Point') geom.coordinates = [orig.coordinates[0] + dx, orig.coordinates[1] + dy];
  else if (geom.type === 'LineString') geom.coordinates = orig.coordinates.map((c) => [c[0] + dx, c[1] + dy]);
  else if (geom.type === 'MultiLineString') geom.coordinates = orig.coordinates.map((l) => l.map((c) => [c[0] + dx, c[1] + dy]));
  else if (geom.type === 'Polygon') geom.coordinates = orig.coordinates.map((r) => r.map((c) => [c[0] + dx, c[1] + dy]));
  else if (geom.type === 'MultiPolygon') geom.coordinates = orig.coordinates.map((p) => p.map((r) => r.map((c) => [c[0] + dx, c[1] + dy])));
}

function beginMove(start) {
  const f = state.features.find((x) => x.id === state.selectedId);
  if (!f || !f.geometry) return;
  state.move = {
    featureId: f.id,
    start: [start[0], start[1]],
    orig: JSON.parse(JSON.stringify(f.geometry)),
    moved: false
  };
  document.addEventListener('mousemove', onDocMove);
  document.addEventListener('mouseup', onDocUp);
  map.getCanvas().style.cursor = 'grabbing';
}

function onDocMove(ev) {
  const m = state.move;
  if (!m) return;
  const f = state.features.find((x) => x.id === m.featureId);
  if (!f) return;
  const ll = canvasLngLat(ev.clientX, ev.clientY);
  translateGeom(f.geometry, m.orig, ll[0] - m.start[0], ll[1] - m.start[1]);
  m.moved = true;
  refreshSources();
  updateMeasurePanels();
}

function onDocUp() {
  document.removeEventListener('mousemove', onDocMove);
  document.removeEventListener('mouseup', onDocUp);
  const m = state.move;
  state.move = null;
  if (map) map.getCanvas().style.cursor = '';
  if (m && m.moved) {
    const f = state.features.find((x) => x.id === m.featureId);
    if (f) putArrowGeometry(f);
  }
  state.ignoreNextClick = true;
  setTimeout(() => { state.ignoreNextClick = false; }, 0);
  setMoveMode(false);
}

function setMoveMode(on) {
  state.moveMode = !!on;
  if (map) {
    try {
      if (state.moveMode) { map.dragPan.disable(); map.boxZoom.disable(); }
      else { map.dragPan.enable(); map.boxZoom.enable(); }
    } catch (e) { /* ignore */ }
  }
  if (!state.moveMode) state.move = null;
  updateArrowPanel();
  updateHint();
}

function updateMeasurePanels() {
  updateLinePanel();
  updatePolygonPanel();
  updateRulerPanel();
}

function updateLinePanel() {
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

function updatePolygonPanel() {
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

function updatePointPanel() {
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

function updateLabelPanel() {
  const panel = $('#label-style');
  if (!panel) return;
  panel.classList.toggle('show', state.tool === 'label' || !!activeSelected('label'));
  const s = state.labelStyle;
  $('#label-text').value = s.text;
  renderTextStyleControls('#label-', s.label);
}

function updateRulerPanel() {
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

function renderTextStyleControls(prefix, ls) {
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

function syncArrowStyle() {
  const sel = selectedArrow();
  state.arrowStyle = normalizeArrowStyle(state.arrowStyle);
  if (map) {
    try {
      map.setPaintProperty('fmO-arrow-preview', 'fill-color', state.arrowStyle.color);
      map.setPaintProperty('fmO-arrow-preview', 'fill-opacity', state.arrowStyle.opacity);
    } catch (e) { /* стиль ещё строится */ }
  }
  if (sel) {
    sel.properties = { ...sel.properties, ...state.arrowStyle };
    scheduleArrowPut(sel);
  }
  refreshSources();
  updateArrowPanel();
}

let arrowPutTimer = null;
let pendingArrow = null;
function scheduleArrowPut(f) {
  pendingArrow = { id: f.id, props: { ...f.properties }, date: state.date || null };
  clearTimeout(arrowPutTimer);
  arrowPutTimer = setTimeout(async () => {
    const p = pendingArrow; pendingArrow = null;
    try {
      const body = { properties: p.props };
      if (p.date) body.date = p.date;
      const upd = await api.send('PUT', `/api/features/${p.id}`, body);
      const i = state.features.findIndex((x) => x.id === upd.id);
      if (i >= 0) state.features[i] = upd;
      refreshSources();
      refreshDates();
    } catch (e) { toast('Ошибка: ' + e.message); }
  }, 300);
}
function cancelArrowPut() {
  if (pendingArrow) { clearTimeout(arrowPutTimer); pendingArrow = null; }
}

async function deleteSelected() {
  if (!state.selectedId) { toast('Ничего не выбрано'); return; }
  const id = state.selectedId;
  const day = state.date || todayDay();
  cancelArrowPut();
  const mode = await askDelete();
  if (!mode) return;
  try {
    if (mode === 'from') {
      await api.send('DELETE', `/api/features/${id}?mode=from&date=${encodeURIComponent(day)}`);
    } else {
      await api.send('DELETE', `/api/features/${id}`);
    }
    state.selectedId = null;
    state.dates = null;
    await reload();
    updateDatesPanel();
  } catch (e) { toast('Ошибка: ' + e.message); }
}

function applyCoord(feat, g, c) {
  const geo = feat.geometry;
  if (g.type === 'tangent') {
    const p = feat.properties || (feat.properties = {});
    const meta = Array.isArray(p.nodeMeta) ? [...p.nodeMeta] : [];
    while (meta.length < geo.coordinates.length) meta.push({ auto: true });
    const node = project(geo.coordinates[g.index]);
    const off = project(c);
    const prev = meta[g.index] && meta[g.index].auto === false ? meta[g.index] : {};
    const m = { ...prev, auto: false };
    if (g.which === 'in') m.i = [off[0] - node[0], off[1] - node[1]];
    else m.o = [off[0] - node[0], off[1] - node[1]];
    meta[g.index] = m;
    p.nodeMeta = meta;
    return;
  }
  if (geo.type === 'Point') geo.coordinates = c;
  else if (geo.type === 'LineString') geo.coordinates[g.index] = c;
  else if (geo.type === 'MultiLineString') {
    geo.coordinates[g.ring][g.index] = c;
    if (g.ring === 0) { // середина основания следует за хвостом
      const [a, b] = geo.coordinates[0];
      geo.coordinates[1][0] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    }
  }
  else if (geo.type === 'Polygon') {
    const ring = geo.coordinates[g.ring];
    ring[g.index] = c;
    if (g.index === 0) ring[ring.length - 1] = c;
  }
}

function putArrowGeometry(f) {
  const body = { geometry: f.geometry, properties: { ...f.properties } };
  if (state.date) body.date = state.date;
  api.send('PUT', `/api/features/${f.id}`, body)
    .then((upd) => {
      const i = state.features.findIndex((x) => x.id === upd.id);
      if (i >= 0) state.features[i] = upd;
      refreshSources();
      refreshDates();
    })
    .catch((err) => { toast('Ошибка: ' + err.message); reload().catch(() => {}); });
}

function metersPerPixel(lat) {
  const world = 2 * Math.PI * 6378137 * Math.cos(lat * Math.PI / 180);
  return world / (512 * Math.pow(2, map.getZoom()));
}

// Размер ручек/узлов соразмерно телу стрелки: ширина в метрах -> пиксели на текущем масштабе.
let handleR = 0;
function arrowHandleRadius() {
  const f = selectedArrow();
  if (!f) {
    const anySel = state.features.some((x) => x.id === state.selectedId);
    return anySel ? 5 : 4;
  }
  const baseW = Number(f.properties.baseWidth) || 600;
  const lat = f.geometry && f.geometry.coordinates[0] ? f.geometry.coordinates[0][1] : map.getCenter().lat;
  return Math.max(2.5, Math.min(5, (baseW / metersPerPixel(lat)) * 0.08));
}
function updateHandleSizes() {
  if (!map || typeof map.setPaintProperty !== 'function') return;
  const r = Math.round(arrowHandleRadius() * 10) / 10;
  if (r === handleR) return;
  handleR = r;
  try {
    map.setPaintProperty('fmO-handles', 'circle-radius', r);
    map.setPaintProperty('fmO-handles', 'circle-stroke-width', Math.max(1, r * 0.3));
    map.setPaintProperty('fmO-tangents', 'circle-radius', r);
    map.setPaintProperty('fmO-tangents', 'circle-stroke-width', Math.max(1, r * 0.25));
    map.setPaintProperty('fmO-draft-verts', 'circle-radius', r);
    map.setPaintProperty('fmO-draft-verts', 'circle-stroke-width', Math.max(1, r * 0.3));
  } catch (e) { /* слой ещё не готов */ }
}

function fmLIds() {
  return map.getStyle().layers.map((l) => l.id).filter((id) => id.startsWith('fmL-'));
}

/* ================= floating panels ================= */
const PANEL_KEYS = ['layers', 'props', 'dates'];
const panelEls = {};
let panels = null;
let panelOrder = [];

function raisePanel(key) {
  panelOrder = panelOrder.filter((x) => x !== key).concat(key);
  panelOrder.forEach((k, i) => { if (panelEls[k]) panelEls[k].style.zIndex = 6 + i; });
}

function loadPanels() {
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

function savePanels() {
  try { localStorage.setItem('panels', JSON.stringify(panels)); } catch (e) { /* ignore */ }
}

function applyPanelRect(key) {
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

function setPanelVisible(key, on) {
  const el = panelEls[key];
  if (!el || !panels) return;
  el.classList.toggle('hidden', !(on && panels[key].enabled));
}

function propsHasContent() {
  return ['#arrow-style', '#line-style', '#polygon-style', '#point-style', '#label-style', '#ruler-style']
    .some((s) => { const el = $(s); return el && el.classList.contains('show'); });
}

function applyPanelVisibility() {
  setPanelVisible('layers', true);
  setPanelVisible('props', propsHasContent());
  setPanelVisible('dates', state.features.some((x) => x.id === state.selectedId));
}

function initPanels() {
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

/* ================= init ================= */
(async function init() {
  /* auth: показываем форму входа, пока пользователь не авторизован */
  initLoginForm();
  await ensureAuth();
  updateUserBox();
  initUsersModal();

  /* modal bindings */
  $('#modal-ok').onclick = () => closeModal({ name: $('#modal-name').value, color: $('#modal-color').value });
  $('#modal-cancel').onclick = () => closeModal(null);
  $('#modal-back').onclick = (e) => { if (e.target.id === 'modal-back') closeModal(null); };

  const base = await loadBaseStyle();
  map = new maplibregl.Map({
    container: 'map',
    style: base,
    center: [34.5, 48.7],
    zoom: 6,
    attributionControl: { compact: true }
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  map.on('error', (e) => diag('map: ' + (e.error && e.error.message || e.type)));
  map.on('zoom', updateHandleSizes);
  map.on('move', updateHandleSizes);
  map.on('zoom', updateAreaLabelVisibility);
  map.on('move', updateAreaLabelVisibility);
  window.__map = map;
  document.title = 'boot';
  await new Promise((res) => map.on('load', res));
  document.title = 'loaded';

  addOverlayLayers();
  initRulerCanvas();
  map.on('resize', resizeRulerCanvas);
  map.on('move', drawRulers);
  map.on('zoom', drawRulers);
  syncArrowStyle();

  /* basemap control */
  buildBasemapSelect();
  $('#basemap').addEventListener('change', async (e) => {
    try { await applyBasemap(e.target.value); }
    catch (err) { toast('Ошибка карты: ' + err.message); e.target.value = currentBasemapId; }
  });

  /* toolbar */
  document.querySelectorAll('#toolbar [data-tool]').forEach((b) => {
    b.onclick = () => setTool(b.dataset.tool);
  });
  $('#btn-delete').onclick = deleteSelected;
  $('#btn-clear').onclick = () => { if (!cancelDraft()) select(null); };
  $('#add-layer').onclick = addLayer;

  /* arrow style panel */
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
    if (!selectedArrow()) return;
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

  /* timeline */
  $('#tl-prev').onclick = () => stepDay(-1);
  $('#tl-next').onclick = () => stepDay(1);
  $('#tl-now').onclick = async () => {
    state.date = null;
    state.selectedId = null;
    closeCalendar();
    renderTimeline();
    updateHint();
    try { await reload(); } catch (e) { toast('Ошибка: ' + e.message); }
  };
  $('#tl-cal').onclick = (e) => {
    e.stopPropagation();
    if ($('#calendar').classList.contains('hidden')) openCalendar();
    else closeCalendar();
  };
  $('#tl-date').onclick = () => { if ($('#calendar').classList.contains('hidden')) openCalendar(); };
  $('#calendar').addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', (e) => {
    const cal = $('#calendar');
    if (!cal.classList.contains('hidden') && !cal.contains(e.target) && e.target.id !== 'tl-cal' && e.target.id !== 'tl-date') {
      closeCalendar();
    }
  });

  /* dates panel */
  $('#dates-created').addEventListener('change', async () => {
    const id = state.selectedId; if (!id) return;
    try { await api.send('PATCH', `/api/features/${id}`, { created_at: $('#dates-created').value }); await reload(); await refreshDates(); }
    catch (e) { toast('Ошибка: ' + e.message); refreshDates(); }
  });
  $('#dates-deleted').addEventListener('change', async () => {
    const id = state.selectedId; if (!id) return;
    try { await api.send('PATCH', `/api/features/${id}`, { deleted_at: $('#dates-deleted').value || null }); await reload(); await refreshDates(); }
    catch (e) { toast('Ошибка: ' + e.message); refreshDates(); }
  });
  $('#dates-deleted-clear').onclick = async () => {
    const id = state.selectedId; if (!id) return;
    try { await api.send('PATCH', `/api/features/${id}`, { deleted_at: null }); await reload(); await refreshDates(); }
    catch (e) { toast('Ошибка: ' + e.message); }
  };

  /* delete modal */
  $('#delete-all').onclick = () => closeDelete('all');
  $('#delete-from').onclick = () => closeDelete('from');
  $('#delete-cancel').onclick = () => closeDelete(null);
  $('#delete-back').onclick = (e) => { if (e.target.id === 'delete-back') closeDelete(null); };

  /* map events */
  map.on('click', (e) => {
    if (state.ignoreNextClick) { state.ignoreNextClick = false; return; }
    if (state.moveMode) return;
    if (state.tool === 'select') {
      if (state.appendArrow) {
        const f = selectedArrow();
        if (f && ensureCanDraw()) {
          const lngLat = [e.lngLat.lng, e.lngLat.lat];
          f.geometry.coordinates.push(lngLat);
          const meta = Array.isArray(f.properties.nodeMeta)
            ? f.properties.nodeMeta
            : f.geometry.coordinates.slice(0, -1).map(() => ({ auto: true }));
          meta.push({ auto: true });
          f.properties.nodeMeta = meta;
          putArrowGeometry(f);
          updateArrowPanel();
        }
        return;
      }
      const handles = map.queryRenderedFeatures(e.point, { layers: ['fmO-handles'] });
      if (handles.length) return;
      const ids = fmLIds();
      const hits = ids.length ? map.queryRenderedFeatures(e.point, { layers: ids }) : [];
      select(hits.length ? Number(hits[0].properties.id) : null);
      return;
    }

    if (!ensureCanDraw()) return;
    const lngLat = [e.lngLat.lng, e.lngLat.lat];
    // Shift — рисование несколькими узлами; без Shift линия/стрелка завершается на втором клике
    const shift = !!(e.originalEvent && e.originalEvent.shiftKey);

    if (state.tool === 'point') {
      createFeature({ layer_id: state.activeLayerId, type: 'point', geometry: { type: 'Point', coordinates: lngLat }, properties: defaultPropsFor('point') });
      return;
    }
    if (state.tool === 'label') {
      promptModal({ title: 'Текст надписи', name: '', showColor: false }).then((r) => {
        if (r && r.name.trim()) {
          createFeature({
            layer_id: state.activeLayerId,
            type: 'label',
            geometry: { type: 'Point', coordinates: lngLat },
            properties: { ...defaultPropsFor('label'), text: r.name.trim() }
          });
        }
      });
      return;
    }

    if (state.tool === 'ruler') {
      if (!state.draft || state.draft.type !== 'ruler') {
        state.draft = { type: 'ruler', coords: [lngLat], cursor: null };
      } else {
        const p0 = map.project(state.draft.coords[0]);
        const nearFirst = Math.hypot(p0.x - e.point.x, p0.y - e.point.y) < 10;
        // вырожденный второй клик рядом с началом — отмена
        if (state.draft.coords.length === 1 && Math.hypot(p0.x - e.point.x, p0.y - e.point.y) < 4) {
          state.draft = null;
          refreshSources();
          updateHint();
          return;
        }
        // клик по первой точке ломаной — завершить
        if (state.draft.coords.length >= 3 && nearFirst) { finishDraft(); return; }
        state.draft.coords.push(lngLat);
      }
      refreshSources();
      updateHint();
      // без Shift — линейка из двух точек
      if (!shift && state.draft && state.draft.coords.length >= 2) finishDraft();
      return;
    }

    if (state.tool === 'arrow') {
      if (!state.draft || state.draft.type !== 'arrow') {
        state.draft = { type: 'arrow', nodes: [lngLat], cursor: null };
      } else {
        state.draft.nodes.push(lngLat);
      }
      refreshSources();
      updateHint();
      if (!shift && state.draft.nodes.length >= 2) finishDraft();
      return;
    }

    // line / polygon
    if (!state.draft || state.draft.type !== state.tool) {
      state.draft = { type: state.tool, coords: [lngLat], cursor: null };
    } else {
      // замкнуть полигон по первой точке
      if (state.tool === 'polygon' && state.draft.coords.length >= 3) {
        const p = map.project(state.draft.coords[0]);
        if (Math.hypot(p.x - e.point.x, p.y - e.point.y) < 10) { finishDraft(); return; }
      }
      state.draft.coords.push(lngLat);
    }
    refreshSources();
    // без Shift линия — одна линия из двух точек
    if (state.tool === 'line' && !shift && state.draft && state.draft.coords.length >= 2) finishDraft();
  });

  map.on('contextmenu', (e) => {
    if (state.appendArrow) {
      state.appendArrow = false;
      refreshSources();
      updateHint();
      updateArrowPanel();
      return;
    }
    if (state.draft) { e.preventDefault(); finishDraft(); }
  });

  map.on('dblclick', (e) => {
    if (state.draft) { finishDraft(); return; }
    if (state.tool !== 'select') return;
    if (state.appendArrow) return;
    const sel = selectedArrow();
    if (sel) {
      const tol = metersPerPixel(e.lngLat.lat) * 14;
      const near = arrowNearestSegment(sel.geometry.coordinates, sel.properties || {},
        sel.properties && sel.properties.nodeMeta, [e.lngLat.lng, e.lngLat.lat], tol);
      if (near) {
        sel.geometry.coordinates.splice(near.segIndex + 1, 0, near.point);
        const meta = Array.isArray(sel.properties.nodeMeta)
          ? sel.properties.nodeMeta
          : sel.geometry.coordinates.slice(0, -1).map(() => ({ auto: true }));
        meta.splice(near.segIndex + 1, 0, { auto: true });
        sel.properties.nodeMeta = meta;
        putArrowGeometry(sel);
        updateArrowPanel();
      }
      return;
    }
    const ids = fmLIds();
    const hits = ids.length ? map.queryRenderedFeatures(e.point, { layers: ids }) : [];
    if (!hits.length) return;
    const f = state.features.find((x) => x.id === Number(hits[0].properties.id));
    if (!f || f.type !== 'label') return;
    promptModal({ title: 'Текст надписи', name: f.properties.text || '', showColor: false }).then(async (r) => {
      if (!r) return;
      try {
        const upd = await api.send('PUT', `/api/features/${f.id}`, { properties: { text: r.name.trim() } });
        const i = state.features.findIndex((x) => x.id === upd.id);
        state.features[i] = upd;
        refreshSources();
      } catch (err) { toast('Ошибка: ' + err.message); }
    });
  });

  // курсор
  map.on('mousemove', (e) => {
    if (state.move) return;
    if (state.moveMode) { map.getCanvas().style.cursor = 'grab'; return; }
    if (state.drag) {
      const g = state.drag;
      const feat = state.features.find((f) => f.id === g.featureId);
      if (feat) {
        applyCoord(feat, g, [e.lngLat.lng, e.lngLat.lat]);
        g.moved = true;
        refreshSources();
        updateMeasurePanels();
      }
      return;
    }
    if (state.draft) {
      state.draft.cursor = [e.lngLat.lng, e.lngLat.lat];
      refreshSources();
      return;
    }
    if (state.tool === 'select') {
      if (state.appendArrow) { map.getCanvas().style.cursor = 'crosshair'; return; }
      const handles = map.queryRenderedFeatures(e.point, { layers: ['fmO-handles', 'fmO-tangents'] });
      const ids = fmLIds();
      const hits = !handles.length && ids.length ? map.queryRenderedFeatures(e.point, { layers: ids }) : [];
      map.getCanvas().style.cursor = (handles.length || hits.length) ? 'pointer' : '';
    } else {
      map.getCanvas().style.cursor = 'crosshair';
    }
  });

  // перемещение выбранного элемента (режим «Переместить»)
  map.on('mousedown', (e) => {
    if (state.tool !== 'select' || !state.moveMode) return;
    if (!state.selectedId) { setMoveMode(false); return; }
    e.preventDefault();
    beginMove([e.lngLat.lng, e.lngLat.lat]);
  });

  // перетаскивание вершин
  map.on('mousedown', 'fmO-handles', (e) => {
    if (state.moveMode) return;
    if (state.tool !== 'select' || !state.selectedId) return;
    e.preventDefault();
    const hit = map.queryRenderedFeatures(e.point, { layers: ['fmO-handles'] })[0];
    if (!hit) return;
    const f = state.features.find((x) => x.id === state.selectedId);
    const idx = Number(hit.properties.index);
    if (f && f.type === 'arrow' && e.originalEvent && e.originalEvent.shiftKey) {
      if (f.geometry.coordinates.length > 2) {
        f.geometry.coordinates.splice(idx, 1);
        if (Array.isArray(f.properties.nodeMeta)) f.properties.nodeMeta.splice(idx, 1);
        putArrowGeometry(f);
        updateArrowPanel();
      }
      return;
    }
    state.drag = { featureId: state.selectedId, index: idx, ring: Number(hit.properties.ring), moved: false };
    map.getCanvas().style.cursor = 'grabbing';
  });
  map.on('mousedown', 'fmO-tangents', (e) => {
    if (state.moveMode) return;
    if (state.tool !== 'select' || !state.selectedId) return;
    e.preventDefault();
    const hit = map.queryRenderedFeatures(e.point, { layers: ['fmO-tangents'] })[0];
    if (!hit) return;
    state.drag = { featureId: state.selectedId, type: 'tangent', index: Number(hit.properties.index), which: hit.properties.which, moved: false };
    map.getCanvas().style.cursor = 'grabbing';
  });
  map.on('mouseup', () => {
    if (!state.drag) return;
    const g = state.drag;
    const { featureId, moved } = g;
    state.drag = null;
    map.getCanvas().style.cursor = '';
    if (!moved) return;
    const feat = state.features.find((f) => f.id === featureId);
    if (!feat) return;
    const body = { geometry: feat.geometry };
    if (g.type === 'tangent') body.properties = { ...feat.properties };
    if (state.date) body.date = state.date;
    api.send('PUT', `/api/features/${featureId}`, body)
      .then((upd) => {
        const i = state.features.findIndex((f) => f.id === upd.id);
        if (i >= 0) state.features[i] = upd;
        refreshSources();
        refreshDates();
        renderLayerList();
      })
      .catch((err) => { toast('Ошибка: ' + err.message); reload().catch(() => {}); });
  });

  // клавиатура
  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if (modalOpen()) {
      if (e.key === 'Escape') closeModal(null);
      if (e.key === 'Enter') closeModal({ name: $('#modal-name').value, color: $('#modal-color').value });
      return;
    }
    if (deleteOpen()) {
      if (e.key === 'Escape') closeDelete(null);
      return;
    }
    if (e.key === 'Escape') {
      if (!$('#calendar').classList.contains('hidden')) { closeCalendar(); return; }
      if (state.moveMode) { setMoveMode(false); return; }
      if (state.appendArrow) {
        state.appendArrow = false;
        refreshSources();
        updateHint();
        updateArrowPanel();
        return;
      }
      const d = state.draft;
      if (d && d.type === 'arrow') {
        state.draft = null;
        refreshSources();
        updateHint();
      } else if (!cancelDraft()) select(null);
    }
    else if (e.key === 'Enter') { if (state.draft) finishDraft(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { if (state.selectedId) { e.preventDefault(); deleteSelected(); } }
  });

  // старт
  initPanels();
  setTool('select');
  await reload();
  renderTimeline();
  updateHint();

  try {
    const saved = localStorage.getItem('basemap');
    if (saved && saved !== currentBasemapId && basemapById(saved)) {
      await applyBasemap(saved);
      $('#basemap').value = currentBasemapId;
    }
  } catch (e) { /* ignore */ }

  document.title = 'ready';
})().catch((err) => {
  console.error(err);
  diag('init: ' + err.message);
});
