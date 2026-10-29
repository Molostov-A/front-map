// Запись правок на сервер: дебаунс PUT свойств по объекту, PUT геометрии, удаление.
import { api } from '../core/api.js';
import { currentDay } from '../core/days.js';
import { hooks } from '../core/hooks.js';
import { canEdit } from '../core/session.js';
import { state } from '../core/store.js';
import { toast } from '../core/util.js';
import { refreshSources } from '../map/render.js';
import { refreshDates, updateDatesPanel } from '../ui/dates-panel.js';
import { askDelete } from '../ui/modals.js';

// Дебаунс PUT свойств — отдельно для каждого объекта: правка другого объекта
// не должна отменять ещё не отправленную правку предыдущего.
export const pendingPuts = new Map(); // id -> { timer, props, date }

export function scheduleArrowPut(f) {
  if (!canEdit()) return;
  const prev = pendingPuts.get(f.id);
  if (prev) clearTimeout(prev.timer);
  const entry = { props: { ...f.properties }, date: currentDay() };
  entry.timer = setTimeout(() => sendPendingPut(f.id), 300);
  pendingPuts.set(f.id, entry);
}

export async function sendPendingPut(id) {
  const p = pendingPuts.get(id);
  if (!p) return;
  pendingPuts.delete(id);
  try {
    const upd = await api.send('PUT', `/api/features/${id}`, { properties: p.props, date: p.date });
    // Пока запрос летел, пользователь мог продолжить правку — тогда ответ уже устарел.
    if (pendingPuts.has(id)) return;
    const i = state.features.findIndex((x) => x.id === upd.id);
    if (i >= 0) state.features[i] = upd;
    refreshSources();
    if (id === state.selectedId) refreshDates();
  } catch (e) { toast('Ошибка: ' + e.message); }
}

export function cancelArrowPut(id) {
  const p = pendingPuts.get(id);
  if (p) { clearTimeout(p.timer); pendingPuts.delete(id); }
}

export async function deleteSelected() {
  if (!canEdit()) return;
  if (!state.selectedId) { toast('Ничего не выбрано'); return; }
  const id = state.selectedId;
  const day = currentDay();
  cancelArrowPut(id);
  const mode = await askDelete();
  if (!mode) return;
  try {
    if (mode === 'from') {
      await api.send('DELETE', `/api/features/${id}?mode=from&date=${encodeURIComponent(day)}`);
    } else {
      await api.send('DELETE', `/api/features/${id}`);
    }
    state.selectedId = null;
    state.dates = null;
    await hooks.reload();
    updateDatesPanel();
  } catch (e) { toast('Ошибка: ' + e.message); }
}

export function putArrowGeometry(f) {
  if (!canEdit()) return;
  cancelArrowPut(f.id); // свойства уходят в этом же запросе
  const body = { geometry: f.geometry, properties: { ...f.properties }, date: currentDay() };
  api.send('PUT', `/api/features/${f.id}`, body)
    .then((upd) => {
      const i = state.features.findIndex((x) => x.id === upd.id);
      if (i >= 0) state.features[i] = upd;
      refreshSources();
      refreshDates();
    })
    .catch((err) => { toast('Ошибка: ' + err.message); hooks.reload().catch(() => {}); });
}
