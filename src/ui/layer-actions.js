// Прозрачность слоя, атомарный порядок и копирование объектов между слоями.
import { bindDialogDrag } from './float-panels.js';
import { api, getToken } from '../core/api.js';
import { currentDay } from '../core/days.js';
import { hooks } from '../core/hooks.js';
import { canEdit } from '../core/session.js';
import { state } from '../core/store.js';
import { $, toast } from '../core/util.js';
import { applyLayerOpacity } from '../map/layer-opacity.js';
import { refreshSources } from '../map/render.js';

let ordering = false, copySource = null, copyDay = null, copyToken = null, copySelection = [];
const opacityJobs = new Map();

export function previewLayerOpacity(layer, value) {
  layer.opacity = Number(value) / 100;
  hooks.mapChanged(); applyLayerOpacity(layer); refreshSources();
}

export async function saveLayerOpacity(layer) {
  // Быстрые отпускания ползунка не могут записаться в обратном порядке.
  const opacity = layer.opacity, token = getToken();
  const previous = opacityJobs.get(layer.id) || Promise.resolve();
  const job = previous.catch(() => {}).then(async () => {
    if (token !== getToken() || !canEdit()) return;
    await api.send('PATCH', `/api/layers/${layer.id}`, { opacity });
  });
  opacityJobs.set(layer.id, job);
  try { await job; } catch (e) { toast('Ошибка сохранения прозрачности: ' + e.message); }
  finally { if (opacityJobs.get(layer.id) === job) opacityJobs.delete(layer.id); }
}

export async function moveLayer(layer, direction) {
  if (ordering || !canEdit()) return;
  const ids = state.layers.map((l) => l.id), index = ids.indexOf(layer.id), next = index + direction;
  if (next < 0 || next >= ids.length) return;
  [ids[index], ids[next]] = [ids[next], ids[index]];
  ordering = true;
  try { await api.send('POST', '/api/layers/reorder', { ids }); await hooks.reload(); }
  catch (e) { toast('Ошибка порядка слоёв: ' + e.message); }
  finally { ordering = false; }
}

export function openLayerCopy(layer) {
  copySource = layer.id; copyDay = currentDay(); copyToken = getToken();
  $('#layer-copy-name').textContent = layer.name;
  $('#layer-copy-day').textContent = currentDay();
  const select = $('#layer-copy-target'); select.replaceChildren();
  for (const other of state.layers.filter((l) => l.id !== layer.id)) {
    const option = document.createElement('option'); option.value = String(other.id); option.textContent = other.name;
    select.appendChild(option);
  }
  const selected = state.features.filter((f) => f.layer_id === layer.id
    && (state.selectedIds?.length ? state.selectedIds : [state.selectedId]).includes(f.id));
  copySelection = selected.map((f) => f.id);
  $('#layer-copy-selected').disabled = !selected.length;
  $('#layer-copy-selected').textContent = `Выбранные (${selected.length})`;
  $('#layer-copy-scope').value = 'all';
  $('#layer-copy-status').textContent = select.options.length ? '' : 'Сначала создайте другой слой.';
  $('#layer-copy-apply').disabled = !select.options.length;
  $('#layer-copy').hidden = false;
}

export function bindLayerActions() {
  bindDialogDrag($('#layer-copy'));
  $('#layer-copy-close').onclick = () => { $('#layer-copy').hidden = true; };
  $('#layer-copy-apply').onclick = async () => {
    if (!canEdit()) return;
    const source = copySource, day = copyDay, token = copyToken, target = Number($('#layer-copy-target').value);
    const selected = $('#layer-copy-scope').value === 'selected' ? copySelection : undefined;
    const active = () => day === currentDay() && token === getToken() && canEdit();
    $('#layer-copy-apply').disabled = true;
    try {
      await hooks.flushSaves();
      if (!active()) throw new Error('День или сессия изменились. Откройте окно снова.');
      const result = await api.send('POST', `/api/layers/${source}/copy`, { target_id: target, date: day, feature_ids: selected });
      if (!active()) return;
      await hooks.reload();
      $('#layer-copy-status').textContent = `Скопировано объектов: ${result.features.length}. Оригиналы сохранены.`;
    } catch (e) { $('#layer-copy-status').textContent = 'Ошибка: ' + e.message; }
    finally { $('#layer-copy-apply').disabled = false; }
  };
}
