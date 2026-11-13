// Инструмент «Выбор»: клик — выбрать объект (или дорисовать узел стрелки в режиме «Дорисовать»),
// двойной клик — вставить узел в стрелку / изменить текст надписи, курсор при наведении.
import { arrowNearestSegment } from '../../arrow.mjs';
import { normalizeStyle } from '../../shared/feature-schema.mjs';
import { canEdit } from '../core/session.js';
import { map, selectedArrow, state } from '../core/store.js';
import { select } from '../edit/selection.js';
import { saveFeature, putArrowGeometry } from '../edit/sync.js';
import { metersPerPixel } from '../map/overlays.js';
import { fmLIds } from '../map/style-layers.js';
import { promptModal } from '../ui/modals.js';
import { updateStylePanels } from '../ui/style-panels.js';
import { ensureCanDraw } from './draw.js';

const hitFeatures = (point) => {
  const ids = fmLIds();
  return ids.length ? map.queryRenderedFeatures(point, { layers: ids }) : [];
};

/** @type {import('../types').Tool} */
export const selectTool = {
  hint: () => 'Клик — выбрать элемент · тяните синие точки · Del — удалить',

  onClick(e) {
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
        updateStylePanels();
      }
      return;
    }
    const handles = map.queryRenderedFeatures(e.point, { layers: ['fmO-handles'] });
    if (handles.length) return;
    const hits = hitFeatures(e.point);
    select(hits.length ? Number(hits[0].properties.id) : null);
  },

  onDblClick(e) {
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
        updateStylePanels();
      }
      return;
    }
    const hits = hitFeatures(e.point);
    if (!hits.length) return;
    const f = state.features.find((x) => x.id === Number(hits[0].properties.id));
    if (!f || f.type !== 'label' || !canEdit()) return;
    promptModal({ title: 'Текст надписи', name: f.properties.text || '', showColor: false }).then(async (r) => {
      if (!r) return;
      f.properties = { ...f.properties, text: r.name.trim() };
      await saveFeature(f, { properties: f.properties });
      if (f.id === state.selectedId) state.labelStyle = normalizeStyle('label', f.properties);
      updateStylePanels();
    });
  },

  onHover(e) {
    if (state.appendArrow) { map.getCanvas().style.cursor = 'crosshair'; return; }
    const handles = map.queryRenderedFeatures(e.point, { layers: ['fmO-handles', 'fmO-tangents'] });
    const hits = !handles.length ? hitFeatures(e.point) : [];
    map.getCanvas().style.cursor = (handles.length || hits.length) ? 'pointer' : '';
  }
};
