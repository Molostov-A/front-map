// DOM-маркеры текста: надписи и подписи точек; координаты курсора на канвасе.
import * as maplibregl from '../../vendor/maplibre-gl.mjs';
import { normalizeTextStyle } from '../../shared/feature-schema.mjs';
import { hooks } from '../core/hooks.js';
import { map, state } from '../core/store.js';

export const FONT_FAMILIES = {
  system: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  sans: 'Arial, Helvetica, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'Consolas, "Courier New", monospace',
  cursive: '"Comic Sans MS", cursive'
};

export function applyTextStyle(el, ls) {
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

export function syncMarkers() {
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
      el.addEventListener('click', (ev) => { ev.stopPropagation(); hooks.select(f.id); });
      el.addEventListener('mousedown', (ev) => {
        if (state.moveMode && state.selectedId === f.id && state.tool === 'select') {
          ev.preventDefault();
          hooks.beginMove(markerLngLat(ev));
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

export function canvasLngLat(clientX, clientY) {
  const rect = map.getCanvas().getBoundingClientRect();
  const p = map.unproject([clientX - rect.left, clientY - rect.top]);
  return [p.lng, p.lat];
}

export function markerLngLat(ev) { return canvasLngLat(ev.clientX, ev.clientY); }
