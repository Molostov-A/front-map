// Выбор пары, направления, сохраняемого объекта и явный предварительный просмотр.
import { operate } from '../../polygon.mjs';
import { currentDay } from '../core/days.js';
import { hooks } from '../core/hooks.js';
import { canEdit } from '../core/session.js';
import { state } from '../core/store.js';
import { $ } from '../core/util.js';
import { clearPolygonPreview, setPolygonPreview } from '../map/polygon-preview.js';

let signature = '', prepared = null, busy = false;
function context() {
  const a = state.features.find((f) => f.id === state.selectedId && f.type === 'polygon');
  const b = state.features.find((f) => f.id === Number($('#polygon-other').value) && f.type === 'polygon');
  if (!a || !b || a.id === b.id) return null;
  return { firstId: a.id, secondId: b.id, day: currentDay(), operation: $('#polygon-operation-mode').value,
    result: $('#polygon-result').value, consume: $('#polygon-consume').checked,
    expected: structuredClone([a.geometry, b.geometry]) };
}
const key = (c) => JSON.stringify(c);

export function renderPolygonOperations() {
  const box = $('#polygon-operations');
  if (!box) return;
  const a = state.features.find((f) => f.id === state.selectedId && f.type === 'polygon');
  box.hidden = !a || !canEdit() || state.tool !== 'select';
  if (box.hidden) { prepared = null; clearPolygonPreview(); return; }
  const visible = new Set(state.layers.filter((l) => l.visible).map((l) => l.id));
  const others = state.features.filter((f) => f.type === 'polygon' && f.id !== a.id && visible.has(f.layer_id));
  const nextSignature = JSON.stringify([a.id, others.map((f) => [f.id, f.layer_id])]);
  if (signature !== nextSignature) {
    const select = $('#polygon-other'), old = select.value;
    select.replaceChildren();
    for (const f of others) {
      const option = document.createElement('option'); option.value = String(f.id);
      option.textContent = `#${f.id} — ${state.layers.find((l) => l.id === f.layer_id)?.name || 'слой'}`;
      select.appendChild(option);
    }
    if (others.some((f) => String(f.id) === old)) select.value = old;
    signature = nextSignature;
  }
  $('#polygon-first').textContent = `A: полигон #${a.id}`;
  const c = context();
  if (prepared && key(c) !== prepared) { prepared = null; clearPolygonPreview(); }
  $('#polygon-preview').disabled = busy || !c;
  $('#polygon-apply').disabled = busy || !prepared;
}

export function resetPolygonOperations() {
  const wasPrepared = !!prepared;
  prepared = null; clearPolygonPreview();
  const button = $('#polygon-apply'); if (button) button.disabled = true;
  if (wasPrepared && $('#polygon-operation-status')) $('#polygon-operation-status').textContent = 'Предпросмотр сброшен. Проверьте результат снова.';
}

export function bindPolygonOperations() {
  const status = $('#polygon-operation-status');
  for (const id of ['polygon-other', 'polygon-operation-mode', 'polygon-result', 'polygon-consume']) {
    $('#' + id).addEventListener('change', () => { prepared = null; clearPolygonPreview(); status.textContent = ''; renderPolygonOperations(); });
  }
  $('#polygon-preview').onclick = () => {
    const c = context(); if (!c || !canEdit()) return;
    try {
      const [a, b] = c.expected;
      const result = c.operation === 'reverse-difference' ? operate('difference', b, a) : operate(c.operation, a, b);
      setPolygonPreview(a, b, result);
      prepared = result ? key(c) : null;
      status.textContent = result ? 'Синий — A, оранжевый — B, фиолетовый — результат. Проверьте область и выбранный объект результата.' : 'Результат пуст: область полностью вырезана.';
    } catch (e) { prepared = null; status.textContent = 'Ошибка контуров: ' + e.message; }
    renderPolygonOperations();
  };
  $('#polygon-preview-clear').onclick = () => { prepared = null; clearPolygonPreview(); status.textContent = ''; renderPolygonOperations(); };
  $('#polygon-apply').onclick = async () => {
    const c = context(); if (!c || busy || !canEdit()) return;
    if (key(c) !== prepared) { resetPolygonOperations(); status.textContent = 'Контуры изменились. Повторите предпросмотр.'; return; }
    busy = true; renderPolygonOperations(); status.textContent = 'Сохраняю результат…';
    try {
      const feature = await hooks.polygonOperation(c);
      prepared = null; clearPolygonPreview();
      status.textContent = feature ? `Сохранён полигон #${feature.id}` : 'Операция отменена: изменились день или сессия.';
    } catch (e) { status.textContent = e.message; }
    finally { busy = false; renderPolygonOperations(); }
  };
}
