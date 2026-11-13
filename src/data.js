// Загрузка карты на выбранный день и полная перерисовка UI.
import { api } from './core/api.js';
import { hooks } from './core/hooks.js';
import { currentDay } from './core/days.js';
import { canEdit, viewerVisibility } from './core/session.js';
import { state } from './core/store.js';
import { rebuildStyle } from './map/style-layers.js';
import { resetPolygonOperations } from './ui/polygon-operations.js';
import { updateDatesPanel } from './ui/dates-panel.js';
import { renderLayerList } from './ui/layer-list.js';
import { updateStylePanels } from './ui/style-panels.js';

let loadGeneration = 0;
let creatingLayer = null;

export async function reload() {
  resetPolygonOperations();
  hooks.mapChanged();
  const generation = ++loadGeneration;
  const day = currentDay();
  const active = () => generation === loadGeneration && day === currentDay();
  const q = `?date=${encodeURIComponent(day)}`;
  let data;
  try {
    data = await api.get('/api/map' + q);
    if (!active()) return;
    if (!data.layers.length && canEdit()) {
      // Параллельные reload не должны создать несколько стартовых слоёв.
      if (!creatingLayer) {
        creatingLayer = api.send('POST', '/api/layers', { name: 'Слой 1', color: '#e63946' })
          .finally(() => { creatingLayer = null; });
      }
      await creatingLayer;
      if (!active()) return;
      data = await api.get('/api/map' + q);
      if (!active()) return;
    }
  } catch (e) {
    if (active()) throw e;
    return;
  }
  state.layers = data.layers;
  state.features = data.features;
  if (!canEdit()) {
    for (const L of state.layers) if (viewerVisibility.has(L.id)) L.visible = viewerVisibility.get(L.id);
  }
  if (!state.layers.some((l) => l.id === state.activeLayerId)) {
    state.activeLayerId = state.layers[0] ? state.layers[0].id : null;
  }
  if (state.selectedId && !state.features.some((f) => f.id === state.selectedId)) {
    state.selectedId = null;
    state.dates = null;
  }
  state.selectedIds = (state.selectedIds || []).filter((id) => state.features.some((f) => f.id === id
    && state.layers.some((l) => l.id === f.layer_id && l.visible)));
  if (!state.selectedIds.includes(state.selectedId)) state.selectedId = state.selectedIds.at(-1) ?? null;
  rebuildStyle();
  renderLayerList();
  updateStylePanels();
  updateDatesPanel();
}
