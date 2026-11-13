// Запись правок на сервер: дебаунс PUT свойств по объекту, PUT геометрии, удаление.
import { api, getToken } from '../core/api.js';
import { currentDay } from '../core/days.js';
import { hooks } from '../core/hooks.js';
import { canEdit } from '../core/session.js';
import { state } from '../core/store.js';
import { toast } from '../core/util.js';
import { refreshSources } from '../map/render.js';
import { refreshDates, updateDatesPanel } from '../ui/dates-panel.js';
import { askDelete } from '../ui/modals.js';

// Ожидающие правки разделены по объекту и дню; запросы одного объекта последовательны.
export const pendingPuts = new Map();
const inFlight = new Map();
const revisions = new Map();
const nextRevision = (id) => { const n = (revisions.get(id) || 0) + 1; revisions.set(id, n); return n; };
const putKey = (id, day) => `${id}:${day}`;

function queuePut(f, body, revision, token) {
  const previous = inFlight.get(f.id) || Promise.resolve();
  const task = previous.catch(() => {}).then(async () => {
    if (!token || token !== getToken() || !canEdit()) return;
    const upd = await api.send('PUT', `/api/features/${f.id}`, body);
    if (token !== getToken() || revisions.get(f.id) !== revision || currentDay() !== body.date) return;
    const i = state.features.findIndex((x) => x.id === f.id);
    // reload мог заменить объект даже на том же дне: не трогаем новый снимок карты.
    if (i < 0 || state.features[i] !== f) return;
    if (state.drag?.featureId === f.id || state.move?.featureId === f.id) return;
    state.features[i] = upd;
    refreshSources();
    if (f.id === state.selectedId) refreshDates();
  });
  inFlight.set(f.id, task);
  const cleanup = () => { if (inFlight.get(f.id) === task) inFlight.delete(f.id); };
  task.then(cleanup, cleanup);
  return task;
}

export function scheduleArrowPut(f) {
  if (!canEdit()) return;
  hooks.mapChanged();
  const day = currentDay();
  const key = putKey(f.id, day);
  const prev = pendingPuts.get(key);
  if (prev) clearTimeout(prev.timer);
  const entry = { f, props: structuredClone(f.properties), date: day, revision: nextRevision(f.id), token: getToken(), timer: null };
  entry.timer = setTimeout(() => sendPendingPut(f.id, day), 300);
  pendingPuts.set(key, entry);
}

function takePendingPut(id, day) {
  const key = putKey(id, day), p = pendingPuts.get(key);
  if (!p) return Promise.resolve();
  clearTimeout(p.timer); pendingPuts.delete(key);
  return queuePut(p.f, { properties: p.props, date: p.date }, p.revision, p.token);
}

export async function sendPendingPut(id, day = currentDay()) {
  try { await takePendingPut(id, day); }
  catch (e) { toast('Ошибка: ' + e.message); }
}

// Операции над несколькими объектами не начинаются после неудавшегося PUT.
export async function flushFeaturePuts(ids) {
  const work = [];
  for (const p of [...pendingPuts.values()]) if (ids.includes(p.f.id)) work.push(takePendingPut(p.f.id, p.date));
  for (const id of ids) if (inFlight.has(id)) work.push(inFlight.get(id));
  await Promise.all(work);
}

export function cancelArrowPut(id, day) {
  for (const [key, p] of pendingPuts) {
    if (p.f.id !== id || (day !== undefined && p.date !== day)) continue;
    clearTimeout(p.timer);
    pendingPuts.delete(key);
  }
}

// Немедленный PUT текста/геометрии проходит через ту же очередь, что и стиль.
export async function saveFeature(f, patch, day = currentDay()) {
  if (!canEdit()) return;
  hooks.mapChanged();
  cancelArrowPut(f.id, day);
  const body = structuredClone({ properties: f.properties, ...patch, date: day });
  try { await queuePut(f, body, nextRevision(f.id), getToken()); }
  catch (e) { toast('Ошибка: ' + e.message); }
}

export async function deleteSelected() {
  if (!canEdit()) return;
  if (!state.selectedId) { toast('Ничего не выбрано'); return; }
  const id = state.selectedId;
  const token = getToken();
  const day = currentDay();
  const mode = await askDelete();
  if (!mode || token !== getToken() || !canEdit()) return;
  // Сначала сохраняем все правки объекта: отмена/ошибка удаления не теряет стиль.
  for (const p of [...pendingPuts.values()]) {
    if (p.f.id === id) await sendPendingPut(id, p.date);
  }
  await (inFlight.get(id) || Promise.resolve()).catch(() => {});
  if (token !== getToken() || !canEdit()) return;
  try {
    if (mode === 'from') {
      await api.send('DELETE', `/api/features/${id}?mode=from&date=${encodeURIComponent(day)}`);
    } else {
      await api.send('DELETE', `/api/features/${id}`);
    }
    if (token !== getToken()) return;
    state.selectedId = null;
    state.dates = null;
    await hooks.reload();
    updateDatesPanel();
  } catch (e) { toast('Ошибка: ' + e.message); }
}

export function putArrowGeometry(f) {
  return saveFeature(f, { geometry: f.geometry });
}
