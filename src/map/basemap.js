// Базовые карты: стиль liberty (с запасным растром), список, переключение (пересобирает слои).
import { basemapById, BASEMAPS, DEFAULT_BASEMAP_ID } from '../../basemaps.mjs';
import { map } from '../core/store.js';
import { $, toast } from '../core/util.js';
import { rebuildStyle } from './style-layers.js';

export async function loadBaseStyle() {
  try {
    const r = await fetch('https://tiles.openfreemap.org/styles/liberty');
    if (!r.ok) throw new Error('style');
    const s = await r.json();
    s.glyphs = s.glyphs || 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.utf8';
    return s;
  } catch (e) {
    return {
      version: 8,
      glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.utf8',
      sources: {
        osm: {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
            'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
            'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
          ],
          tileSize: 256,
          attribution: '© OpenStreetMap, © CARTO'
        }
      },
      layers: [
        { id: 'bg', type: 'background', paint: { 'background-color': '#f4f4f4' } },
        { id: 'osm', type: 'raster', source: 'osm' }
      ]
    };
  }
}

export let currentBasemapId = DEFAULT_BASEMAP_ID;

export async function basemapStyle(id) {
  const bm = basemapById(id);
  if (!bm) return null;
  return bm.kind === 'liberty' ? await loadBaseStyle() : bm.style;
}

export function buildBasemapSelect() {
  const sel = $('#basemap');
  if (!sel) return;
  const groups = new Map();
  for (const b of BASEMAPS) {
    let g = groups.get(b.group);
    if (!g) {
      g = document.createElement('optgroup');
      g.label = b.group;
      groups.set(b.group, g);
      sel.appendChild(g);
    }
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = b.label;
    g.appendChild(opt);
  }
  sel.value = currentBasemapId;
}

export async function applyBasemap(id) {
  if (!basemapById(id) || id === currentBasemapId) return;
  const style = await basemapStyle(id);
  if (!style) return;
  await new Promise((resolve, reject) => {
    map.once('style.load', () => resolve());
    try { map.setStyle(style, { diff: false }); } catch (e) { reject(e); }
  });
  currentBasemapId = id;
  rebuildStyle();
  try { localStorage.setItem('basemap', id); } catch (e) { /* ignore */ }
}

// Выпадающий список базовых карт.
export function bindBasemapSelect() {
  buildBasemapSelect();
  $('#basemap').addEventListener('change', async (e) => {
    try { await applyBasemap(e.target.value); }
    catch (err) { toast('Ошибка карты: ' + err.message); e.target.value = currentBasemapId; }
  });
}
