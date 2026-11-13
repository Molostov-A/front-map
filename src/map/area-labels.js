// Подписи площади полигонов (DOM-маркеры): стиль, скрытие, если не помещаются.
import * as maplibregl from '../../vendor/maplibre-gl.mjs';
import { formatArea, polygonAreaKm2, polygonLabelPoint } from '../../measure.mjs';
import { normalizeStyle } from '../../shared/feature-schema.mjs';
import { map, state } from '../core/store.js';

export function syncAreaLabels() {
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
    marker.setOpacity(layer?.opacity ?? 1, (layer?.opacity ?? 1) * 0.2);
    el.style.zIndex = String(state.layers.length - state.layers.findIndex((l) => l.id === f.layer_id));
    applyAreaLabelFit(el, g);
    marker.setLngLat(pt);
  }
  for (const [id, marker] of state.areaMarkers) {
    if (!keep.has(id)) { marker.remove(); state.areaMarkers.delete(id); }
  }
}

// Скрывает подпись площади, если её размер не помещается в экранные габариты полигона.
export function applyAreaLabelFit(el, geom) {
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

export function updateAreaLabelVisibility() {
  if (!map) return;
  for (const f of state.features) {
    if (f.type !== 'polygon' || !f.geometry) continue;
    const marker = state.areaMarkers.get(f.id);
    if (marker) applyAreaLabelFit(marker.getElement(), f.geometry);
  }
}

export function applyAreaLabelStyle(el, props) {
  const s = normalizeStyle('polygon', props);
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
