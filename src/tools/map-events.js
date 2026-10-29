// События карты (клик, двойной клик, ПКМ, курсор, перетаскивание узлов) и клавиатура.
import { arrowNearestSegment } from '../../arrow.mjs';
import { normalizeStyle } from '../../shared/feature-schema.mjs';
import { api } from '../core/api.js';
import { currentDay } from '../core/days.js';
import { canEdit } from '../core/session.js';
import { map, selectedArrow, state } from '../core/store.js';
import { $, toast } from '../core/util.js';
import { hooks } from '../core/hooks.js';
import { applyCoord } from '../edit/geometry.js';
import { beginMove, setMoveMode } from '../edit/move-mode.js';
import { select } from '../edit/selection.js';
import { cancelArrowPut, deleteSelected, putArrowGeometry } from '../edit/sync.js';
import { metersPerPixel } from '../map/overlays.js';
import { refreshSources } from '../map/render.js';
import { fmLIds } from '../map/style-layers.js';
import { cancelDraft, createFeature, defaultPropsFor, ensureCanDraw, finishDraft } from './draw.js';
import { refreshDates } from '../ui/dates-panel.js';
import { updateHint } from '../ui/hint.js';
import { renderLayerList } from '../ui/layer-list.js';
import { closeDelete, closeModal, deleteOpen, modalOpen, promptModal } from '../ui/modals.js';
import { updateArrowPanel, updateMeasurePanels } from '../ui/style-panels.js';
import { closeCalendar } from '../ui/timeline.js';

// События карты: рисование, выбор, перетаскивание узлов, курсор.
export function bindMapEvents() {
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
    const sel = canEdit() && selectedArrow();
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
    if (!f || f.type !== 'label' || !canEdit()) return;
    promptModal({ title: 'Текст надписи', name: f.properties.text || '', showColor: false }).then(async (r) => {
      if (!r) return;
      cancelArrowPut(f.id);
      try {
        const upd = await api.send('PUT', `/api/features/${f.id}`, {
          properties: { ...f.properties, text: r.name.trim() },
          date: currentDay()
        });
        const i = state.features.findIndex((x) => x.id === upd.id);
        if (i >= 0) state.features[i] = upd;
        if (upd.id === state.selectedId) state.labelStyle = normalizeStyle('label', upd.properties);
        refreshSources();
        updateArrowPanel();
        refreshDates();
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
        updateArrowPanel();
      }
      return;
    }
    state.drag = { featureId: state.selectedId, index: idx, ring: Number(hit.properties.ring), moved: false };
    map.getCanvas().style.cursor = 'grabbing';
  });
  map.on('mousedown', 'fmO-tangents', (e) => {
    if (state.moveMode || !canEdit()) return;
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
    const body = { geometry: feat.geometry, date: currentDay() };
    if (g.type === 'tangent') body.properties = { ...feat.properties };
    api.send('PUT', `/api/features/${featureId}`, body)
      .then((upd) => {
        const i = state.features.findIndex((f) => f.id === upd.id);
        if (i >= 0) state.features[i] = upd;
        refreshSources();
        refreshDates();
        renderLayerList();
      })
      .catch((err) => { toast('Ошибка: ' + err.message); hooks.reload().catch(() => {}); });
  });
}

// Клавиатура: Esc / Enter / Delete.
export function bindKeyboard() {
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
}
