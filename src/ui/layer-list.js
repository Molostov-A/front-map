// Список слоёв: видимость, порядок, переименование, удаление, число объектов и площадь.
import { formatArea, polygonAreaKm2 } from '../../measure.mjs';
import { api } from '../core/api.js';
import { hooks } from '../core/hooks.js';
import { canEdit, viewerVisibility } from '../core/session.js';
import { state } from '../core/store.js';
import { $, toast } from '../core/util.js';
import { refreshSources } from '../map/render.js';
import { promptModal } from './modals.js';

export function countFeatures(layerId) {
  return state.features.filter((f) => f.layer_id === layerId).length;
}

// Суммарная площадь всех полигонов слоя (км²).
export function layerAreaKm2(layerId) {
  let sum = 0;
  for (const f of state.features) {
    if (f.layer_id !== layerId || f.type !== 'polygon' || !f.geometry) continue;
    sum += polygonAreaKm2(f.geometry);
  }
  return sum;
}

export function renderLayerList() {
  const box = $('#layer-list');
  box.innerHTML = '';
  for (const L of state.layers) {
    const item = document.createElement('div');
    item.className = 'layer-item' + (L.id === state.activeLayerId ? ' active' : '') + (L.visible ? '' : ' hidden-layer');

    const sw = document.createElement('span');
    sw.className = 'swatch';
    sw.style.background = L.color;

    const nm = document.createElement('span');
    nm.className = 'lname';
    nm.textContent = L.name;
    nm.title = L.name;

    const cnt = countFeatures(L.id);
    const areaKm2 = layerAreaKm2(L.id);
    const metaText = areaKm2 > 0 ? `${cnt} · ${formatArea(areaKm2)}` : String(cnt);

    const main = document.createElement('div');
    main.className = 'lmain';
    const row1 = document.createElement('div');
    row1.className = 'lrow1';
    row1.appendChild(sw);
    row1.appendChild(nm);
    const meta = document.createElement('span');
    meta.className = 'lmeta';
    meta.textContent = metaText;
    meta.title = areaKm2 > 0
      ? `Объектов: ${cnt}; суммарная площадь полигонов: ${formatArea(areaKm2)}`
      : `Объектов: ${cnt}`;
    main.appendChild(row1);
    main.appendChild(meta);

    const mk = (txt, title, fn) => {
      const b = document.createElement('button');
      b.className = 'icon-btn';
      b.textContent = txt;
      b.title = title;
      b.onclick = (e) => { e.stopPropagation(); fn(); };
      return b;
    };

    const visBtn = mk(L.visible ? '👁' : '🚫', 'Показать/скрыть', async () => {
      if (!canEdit()) { // viewer: видимость только локально, на сервер не пишем
        viewerVisibility.set(L.id, !L.visible);
        hooks.mapChanged();
        L.visible = !L.visible;
        refreshSources();
        renderLayerList();
        return;
      }
      try { await api.send('PATCH', `/api/layers/${L.id}`, { visible: !L.visible }); await hooks.reload(); }
      catch (e) { toast('Ошибка: ' + e.message); }
    });
    if (!canEdit()) {
      item.append(main, visBtn);
      box.appendChild(item);
      continue;
    }
    item.append(main,
      visBtn,
      mk('↑', 'Выше', () => moveLayer(L, -1)),
      mk('✎', 'Переименовать / цвет', async () => {
        const r = await promptModal({ title: 'Слой', name: L.name, color: L.color });
        if (!r || !r.name.trim()) return;
        try { await api.send('PATCH', `/api/layers/${L.id}`, { name: r.name.trim(), color: r.color.trim() || L.color }); await hooks.reload(); }
        catch (e) { toast('Ошибка: ' + e.message); }
      }),
      mk('🗑', 'Удалить слой', async () => {
        if (!confirm(`Удалить слой «${L.name}» со всеми элементами?`)) return;
        try { await api.send('DELETE', `/api/layers/${L.id}`); if (state.activeLayerId === L.id) state.activeLayerId = null; await hooks.reload(); }
        catch (e) { toast('Ошибка: ' + e.message); }
      })
    );
    item.onclick = () => {
      state.activeLayerId = L.id;
      $('#active-layer-name').textContent = L.name;
      renderLayerList();
    };
    box.appendChild(item);
  }
  const active = state.layers.find((l) => l.id === state.activeLayerId);
  $('#active-layer-name').textContent = active ? active.name : '—';
}

export async function moveLayer(L, dir) {
  const idx = state.layers.findIndex((l) => l.id === L.id);
  const other = state.layers[idx + dir]; // список в порядке DESC: idx-1 выше по z
  if (!other) return;
  try {
    await api.send('PATCH', `/api/layers/${L.id}`, { z_order: other.z_order });
    await api.send('PATCH', `/api/layers/${other.id}`, { z_order: L.z_order });
    await hooks.reload();
  } catch (e) { toast('Ошибка: ' + e.message); }
}

export async function addLayer() {
  const r = await promptModal({ title: 'Новый слой', name: '', color: '#e63946' });
  if (!r || !r.name.trim()) return;
  try {
    const created = await api.send('POST', '/api/layers', { name: r.name.trim(), color: r.color.trim() || '#e63946' });
    state.activeLayerId = created.id;
    await hooks.reload();
  } catch (e) { toast('Ошибка: ' + e.message); }
}
