// Панель дат выбранного объекта: создание, удаление, даты изменений.
import { api } from '../core/api.js';
import { hooks } from '../core/hooks.js';
import { canEdit } from '../core/session.js';
import { state } from '../core/store.js';
import { $, toast } from '../core/util.js';
import { applyPanelVisibility } from './float-panels.js';
import { setDay } from './timeline.js';

export async function refreshDates() {
  if (!state.selectedId) { state.dates = null; updateDatesPanel(); return; }
  try { state.dates = await api.get(`/api/features/${state.selectedId}/dates`); }
  catch (e) { state.dates = null; }
  updateDatesPanel();
}

export function updateDatesPanel() {
  const f = state.features.find((x) => x.id === state.selectedId);
  applyPanelVisibility();
  if (!f) return;

  const d = state.dates && state.dates.id === f.id ? state.dates : null;
  $('#dates-created').value = (d && d.created_at) || f.created_at || '';
  $('#dates-deleted').value = (d && d.deleted_at) || '';

  const box = $('#dates-changes');
  box.innerHTML = '';
  const changes = (d && d.changes) || [];
  if (!changes.length) {
    const empty = document.createElement('div');
    empty.className = 'as-row';
    empty.style.color = '#8a93a2';
    empty.textContent = '—';
    box.appendChild(empty);
    return;
  }
  for (const c of changes) {
    const row = document.createElement('div');
    row.className = 'dates-row';
    const inp = document.createElement('input');
    inp.type = 'date';
    inp.value = c.valid_from;
    inp.addEventListener('change', async () => {
      if (!canEdit()) return;
      try {
        await api.send('PATCH', `/api/features/${f.id}/versions/${c.id}`, { valid_from: inp.value });
        await hooks.reload();
        await refreshDates();
      } catch (e) { toast('Ошибка: ' + e.message); refreshDates(); }
    });
    const go = document.createElement('button');
    go.className = 'icon-btn';
    go.textContent = '↧';
    go.title = 'Перейти к этой дате';
    go.onclick = () => setDay(c.valid_from);
    row.append(inp, go);
    box.appendChild(row);
  }
}

// Панель дат: создание/удаление объекта.
export function bindDatesPanel() {
  $('#dates-created').addEventListener('change', async () => {
    const id = state.selectedId; if (!id || !canEdit()) return;
    try { await api.send('PATCH', `/api/features/${id}`, { created_at: $('#dates-created').value }); await hooks.reload(); await refreshDates(); }
    catch (e) { toast('Ошибка: ' + e.message); refreshDates(); }
  });
  $('#dates-deleted').addEventListener('change', async () => {
    const id = state.selectedId; if (!id || !canEdit()) return;
    try { await api.send('PATCH', `/api/features/${id}`, { deleted_at: $('#dates-deleted').value || null }); await hooks.reload(); await refreshDates(); }
    catch (e) { toast('Ошибка: ' + e.message); refreshDates(); }
  });
  $('#dates-deleted-clear').onclick = async () => {
    const id = state.selectedId; if (!id || !canEdit()) return;
    try { await api.send('PATCH', `/api/features/${id}`, { deleted_at: null }); await hooks.reload(); await refreshDates(); }
    catch (e) { toast('Ошибка: ' + e.message); }
  };
}
