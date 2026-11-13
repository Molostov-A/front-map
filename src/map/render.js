// Перерисовка: объекты → GeoJSON по слоям, выделение, ручки, скелет/касательные, черновик (refreshSources).
import { arrowOutline, arrowPolygonLngLat } from '../../arrow.mjs';
import { createFrameScheduler } from '../core/frame.js';
import { canEdit } from '../core/session.js';
import { map, state } from '../core/store.js';
import { TOOLS } from '../core/tools-registry.js';
import { num } from '../core/util.js';
import { syncAreaLabels } from './area-labels.js';
import { syncMarkers } from './markers.js';
import { emptyFC, ensureOverlayImages, hexOfColor, updateHandleSizes } from './overlays.js';
import { drawRulers } from './ruler-canvas.js';

export function featureGeometry(f) {
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

export function toGeoJSON(f) {
  const props = Object.assign({}, f.properties, { id: f.id, type: f.type });
  if (f.type === 'polygon' && f.properties && f.properties.fill === 'hatched') {
    props.hatch = true;
    props.hatchImg = hexOfColor(f.properties.color);
  }
  return { type: 'Feature', geometry: featureGeometry(f), properties: props };
}

export function stemStyleOf(f) {
  const p = f.properties || {};
  const stemMode = f.type === 'line' ? (p.smooth ? 'smooth' : 'sharp') : (p.stemMode === 'smooth' ? 'smooth' : 'sharp');
  return { stemMode, smoothAmount: num(p.smoothAmount, 0.6) };
}

export function handlesFor(feat) {
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
  else if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
    const parts = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    parts.forEach((part, polygon) => part.forEach((ring, ri) => {
      const last = ring.length - 1;
      ring.forEach((c, i) => {
        if (i === last && c[0] === ring[0][0] && c[1] === ring[0][1]) return;
        out.push({ c, ring: ri, polygon, i });
      });
    }));
  }
  return out;
}

// Черновик рисует сам инструмент (tools/<type>.js → draft), здесь только сборка FeatureCollection.
export function draftFC() {
  const d = state.draft;
  const tool = d && TOOLS[d.type];
  return { type: 'FeatureCollection', features: tool && tool.draft ? tool.draft(d) : [] };
}

const scheduledRefresh = createFrameScheduler((afterRefresh) => {
  refreshSources();
  if (afterRefresh) afterRefresh();
});

/** Обновление движения мыши, не чаще одного раза на кадр. */
export function scheduleRefreshSources(afterRefresh = null) {
  scheduledRefresh.schedule(afterRefresh);
}

export function refreshSources() {
  scheduledRefresh.cancel();
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
  map.getSource('fmO-handles').setData(sel && sel.type !== 'label' && canEdit()
    ? { type: 'FeatureCollection', features: handlesFor(sel).map((h) => ({
        type: 'Feature', geometry: { type: 'Point', coordinates: h.c },
        properties: { index: h.i, ring: h.ring, polygon: h.polygon || 0 }
      })) }
    : emptyFC());

  // скелет и ручки сглаживания выбранной стрелки/линии
  let skel = emptyFC();
  let tangents = emptyFC();
  const isSmoothSkeleton = canEdit() && sel && sel.geometry && sel.geometry.type === 'LineString'
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
