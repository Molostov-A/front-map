// Точка входа клиента: авторизация, создание карты, привязка UI, первая загрузка.
// Логика — в src/ (core → map → ui → edit → tools); вызовы «снизу вверх» — через src/core/hooks.js.
import * as maplibregl from './vendor/maplibre-gl.mjs';
import { basemapById } from './basemaps.mjs';
import { hooks } from './src/core/hooks.js';
import { map, setMap } from './src/core/store.js';
import { $, $$, diag } from './src/core/util.js';
import { reload } from './src/data.js';
import { applyPolygonOperation } from './src/edit/polygon-operations.js';
import { bindPolygonOperations } from './src/ui/polygon-operations.js';
import { beginMove } from './src/edit/move-mode.js';
import { select, syncStyle } from './src/edit/selection.js';
import { deleteSelected } from './src/edit/sync.js';
import { updateAreaLabelVisibility } from './src/map/area-labels.js';
import { applyBasemap, bindBasemapSelect, currentBasemapId, loadBaseStyle } from './src/map/basemap.js';
import { addOverlayLayers, updateHandleSizes } from './src/map/overlays.js';
import { drawRulers, initRulerCanvas, resizeRulerCanvas } from './src/map/ruler-canvas.js';
import { cancelDraft, setTool } from './src/tools/draw.js';
import './src/tools/index.js'; // регистрирует инструменты в core/tools-registry.js
import { bindKeyboard, bindMapEvents } from './src/tools/map-events.js';
import { ensureAuth, initLoginForm, initUsersModal, showLogin, updateUserBox } from './src/ui/auth.js';
import { bindDatesPanel } from './src/ui/dates-panel.js';
import { initPanels } from './src/ui/float-panels.js';
import { updateHint } from './src/ui/hint.js';
import { addLayer } from './src/ui/layer-list.js';
import { bindModals } from './src/ui/modals.js';
import { bindStylePanels } from './src/ui/style-bindings.js';
import { bindTimeline, renderTimeline } from './src/ui/timeline.js';

window.addEventListener('error', (e) => diag(e.message + ' @' + e.filename + ':' + e.lineno));
window.addEventListener('unhandledrejection', (e) => diag('promise: ' + (e.reason && e.reason.message || e.reason)));

// Тулбар: инструменты, удаление, сброс, новый слой.
function bindToolbar() {
  $$('#toolbar [data-tool]').forEach((b) => {
    b.onclick = () => setTool(b.dataset.tool);
  });
  $('#btn-delete').onclick = deleteSelected;
  $('#btn-clear').onclick = () => { if (!cancelDraft()) select(null); };
  $('#add-layer').onclick = addLayer;
}

// Хуки для вызовов «снизу вверх» по слоям (см. src/core/hooks.js).
hooks.select = select;
hooks.beginMove = beginMove;
hooks.reload = reload;
hooks.polygonOperation = applyPolygonOperation;
hooks.unauthorized = showLogin;

(async function init() {
  /* auth: показываем форму входа, пока пользователь не авторизован */
  initLoginForm();
  await ensureAuth();
  updateUserBox();
  initUsersModal();

  bindModals();

  const base = await loadBaseStyle();
  setMap(new maplibregl.Map({
    container: 'map',
    style: base,
    center: [34.5, 48.7],
    zoom: 6,
    attributionControl: { compact: true }
  }));
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  map.on('error', (e) => {
    const err = e.error;
    const msg = 'map: ' + (err && err.message || e.type);
    // Ошибки загрузки ресурсов/тайлов (AJAXError с url/status) не фатальны — пишем только в
    // консоль, чтобы не затирать <title> (его использует e2e для проверки инициализации).
    if (err && (err.url || typeof err.status === 'number')) console.error('[front-map] ' + msg);
    else diag(msg);
  });
  map.on('zoom', updateHandleSizes);
  map.on('move', updateHandleSizes);
  map.on('zoom', updateAreaLabelVisibility);
  map.on('move', updateAreaLabelVisibility);
  window.__map = map;
  document.title = 'boot';
  await new Promise((res) => {
    let done = false;
    const finish = () => { if (!done) { done = true; clearTimeout(t); res(); } };
    const t = setTimeout(finish, 10000);
    map.once('load', finish);
  });
  document.title = 'loaded';

  addOverlayLayers();
  initRulerCanvas();
  map.on('resize', resizeRulerCanvas);
  map.on('move', drawRulers);
  map.on('zoom', drawRulers);
  syncStyle('arrow');

  bindBasemapSelect();
  bindToolbar();
  bindStylePanels();
  bindPolygonOperations();
  bindTimeline();
  bindDatesPanel();
  bindMapEvents();
  bindKeyboard();

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
