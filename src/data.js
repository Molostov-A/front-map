// Загрузка карты на выбранный день и полная перерисовка UI.
import { api } from './core/api.js';
import { currentDay } from './core/days.js';
import { canEdit, viewerVisibility } from './core/session.js';
import { state } from './core/store.js';
import { rebuildStyle } from './map/style-layers.js';
import { updateDatesPanel } from './ui/dates-panel.js';
import { renderLayerList } from './ui/layer-list.js';
import { updateStylePanels } from './ui/style-panels.js';

export async function reload() {
  const q = `?date=${encodeURIComponent(currentDay())}`;
  const data = await api.get('/api/map' + q);
  state.layers = data.layers;
  state.features = data.features;

  if (!state.layers.length && canEdit()) {
    await api.send('POST', '/api/layers', { name: 'Слой 1', color: '#e63946' });
    const again = await api.get('/api/map' + q);
    state.layers = again.layers;
    state.features = again.features;
  }
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
  rebuildStyle();
  renderLayerList();
  updateStylePanels();
  updateDatesPanel();
}
