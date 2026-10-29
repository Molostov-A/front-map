// Режим «Переместить»: перетаскивание выбранного объекта целиком.
import { canEdit } from '../core/session.js';
import { map, state } from '../core/store.js';
import { translateGeom } from './geometry.js';
import { putArrowGeometry } from './sync.js';
import { canvasLngLat } from '../map/markers.js';
import { refreshSources } from '../map/render.js';
import { updateHint } from '../ui/hint.js';
import { updateArrowPanel, updateMeasurePanels } from '../ui/style-panels.js';

export function beginMove(start) {
  if (!canEdit()) return;
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

export function onDocMove(ev) {
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

export function onDocUp() {
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

export function setMoveMode(on) {
  state.moveMode = !!on && canEdit();
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
