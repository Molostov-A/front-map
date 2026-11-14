// События карты и клавиатура: раздача кликов инструментам (tools/index.js, tools/select.js),
// общая механика черновика (курсор, ПКМ/двойной клик/Enter — завершить), перетаскивание узлов.
import { hooks } from '../core/hooks.js';
import { canEdit } from '../core/session.js';
import { map, state } from '../core/store.js';
import { $ } from '../core/util.js';
import { applyCoord } from '../edit/geometry.js';
import { beginMove, setMoveMode } from '../edit/move-mode.js';
import { select } from '../edit/selection.js';
import { deleteSelected, putArrowGeometry } from '../edit/sync.js';
import { refreshSources, scheduleRefreshSources } from '../map/render.js';
import { updateHint } from '../ui/hint.js';
import { renderLayerList } from '../ui/layer-list.js';
import { closeDelete, closeModal, deleteOpen, modalOpen } from '../ui/modals.js';
import { updateStylePanels, updateMeasurePanels } from '../ui/style-panels.js';
import { closeCalendar } from '../ui/timeline.js';
import { cancelDraft, ensureCanDraw, setTool } from './draw.js';
import { DRAW_TOOLS, finishDraft } from './index.js';
import { deepStateImportTool } from './deepstate-import.js';
import { eyedropperTool } from './eyedropper.js';
import { selectTool } from './select.js';

// События карты: рисование, выбор, перетаскивание узлов, курсор.
export function bindMapEvents() {
  map.on('click', (e) => {
    if (state.ignoreNextClick) { state.ignoreNextClick = false; return; }
    if (state.moveMode) return;
    if (state.tool === 'select') { selectTool.onClick(e); return; }
    if (state.tool === 'eyedropper') { eyedropperTool.onClick(e); return; }
    if (state.tool === 'deepstate-import') { deepStateImportTool.onClick(e); return; }

    if (!ensureCanDraw()) return;
    const tool = DRAW_TOOLS[state.tool];
    if (!tool) return;
    // Shift — рисование несколькими узлами; без Shift линия/стрелка/линейка завершаются на втором клике
    const shift = !!(e.originalEvent && e.originalEvent.shiftKey);
    if (tool.onClick({ lngLat: [e.lngLat.lng, e.lngLat.lat], point: e.point, shift })) finishDraft();
  });

  map.on('contextmenu', (e) => {
    if (state.appendArrow) {
      state.appendArrow = false;
      refreshSources();
      updateHint();
      updateStylePanels();
      return;
    }
    if (state.draft) { e.preventDefault(); finishDraft(); }
  });

  map.on('dblclick', (e) => {
    if (state.draft) { finishDraft(); return; }
    if (state.tool === 'select') selectTool.onDblClick(e);
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
        scheduleRefreshSources(updateMeasurePanels);
      }
      return;
    }
    if (state.draft) {
      state.draft.cursor = [e.lngLat.lng, e.lngLat.lat];
      scheduleRefreshSources();
      return;
    }
    if (state.tool === 'select') selectTool.onHover(e);
    else if (state.tool === 'eyedropper') eyedropperTool.onHover(e);
    else if (state.tool === 'deepstate-import') deepStateImportTool.onHover();
    else map.getCanvas().style.cursor = 'crosshair';
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
    if (state.moveMode || !canEdit()) return;
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
        updateStylePanels();
      }
      return;
    }
    hooks.mapChanged();
    state.drag = { featureId: state.selectedId, index: idx, ring: Number(hit.properties.ring), polygon: Number(hit.properties.polygon || 0), moved: false };
    map.getCanvas().style.cursor = 'grabbing';
  });
  map.on('mousedown', 'fmO-tangents', (e) => {
    if (state.moveMode || !canEdit()) return;
    if (state.tool !== 'select' || !state.selectedId) return;
    e.preventDefault();
    const hit = map.queryRenderedFeatures(e.point, { layers: ['fmO-tangents'] })[0];
    if (!hit) return;
    hooks.mapChanged();
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
    putArrowGeometry(feat).then(renderLayerList);
  });
}

// Клавиатура: Esc / Enter / Delete.
export function bindKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.tool === 'deepstate-import') { setTool('select'); return; }
    const tag = (/** @type {HTMLElement} */ (e.target).tagName || '').toLowerCase();
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
      if (state.tool === 'eyedropper' || state.tool === 'deepstate-import') { setTool('select'); return; }
      if (!$('#calendar').classList.contains('hidden')) { closeCalendar(); return; }
      if (state.moveMode) { setMoveMode(false); return; }
      if (state.appendArrow) {
        state.appendArrow = false;
        refreshSources();
        updateHint();
        updateStylePanels();
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
}
