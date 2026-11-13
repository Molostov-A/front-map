// Окно выбранных полигонов: пересекающиеся пары, независимые настройки и предпросмотр.
import { bindDialogDrag } from './float-panels.js';
import { operate } from '../../polygon.mjs';
import { polygonPairs } from '../../polygon-pairs.mjs';
import { currentDay } from '../core/days.js';
import { hooks } from '../core/hooks.js';
import { canEdit } from '../core/session.js';
import { state } from '../core/store.js';
import { $ } from '../core/util.js';
import { clearPolygonPreview, setPolygonPreview } from '../map/polygon-preview.js';

let signature = '', pairs = [], pairIndex = 0, prepared = null, busy = false;
const choices = new Map();
const key = (c) => JSON.stringify(c);
const controls = ['polygon-operation-mode', 'polygon-result', 'polygon-consume'];
function remember() {
  const pair = pairs[pairIndex]; if (!pair) return;
  choices.set(pair.key, { operation: $('#polygon-operation-mode').value,
    result: $('#polygon-result').value, consume: $('#polygon-consume').checked });
}
function restore() {
  const choice = choices.get(pairs[pairIndex]?.key) || { operation: 'union', result: 'new', consume: false };
  $('#polygon-operation-mode').value = choice.operation;
  $('#polygon-result').value = choice.result; $('#polygon-consume').checked = choice.consume;
}
function context() {
  const pair = pairs[pairIndex]; if (!pair) return null;
  return { firstId: pair.a.id, secondId: pair.b.id, day: currentDay(), operation: $('#polygon-operation-mode').value,
    result: $('#polygon-result').value, consume: $('#polygon-consume').checked,
    expected: structuredClone([pair.a.geometry, pair.b.geometry]) };
}
function highlight() {
  prepared = null;
  const pair = pairs[pairIndex];
  if (pair) setPolygonPreview(pair.a.geometry, pair.b.geometry, null);
  else clearPolygonPreview();
}

export function renderPolygonOperations() {
  const box = $('#polygon-operations'); if (!box) return;
  const ids = state.selectedIds || [state.selectedId];
  const selected = state.features.filter((f) => ids.includes(f.id) && f.type === 'polygon'
    && state.layers.some((l) => l.id === f.layer_id && l.visible));
  box.hidden = selected.length < 2 || !canEdit() || state.tool !== 'select';
  if (box.hidden) { prepared = null; clearPolygonPreview(); signature = ''; return; }
  const nextSignature = key([currentDay(), selected.map((f) => [f.id, f.layer_id, f.geometry])]);
  if (signature !== nextSignature) {
    const previous = pairs[pairIndex]?.key; remember();
    try { pairs = polygonPairs(state.features, ids, state.layers); }
    catch (e) { pairs = []; $('#polygon-operation-status').textContent = 'Ошибка контуров: ' + e.message; }
    pairIndex = Math.max(0, pairs.findIndex((pair) => pair.key === previous));
    for (const id of choices.keys()) if (!pairs.some((pair) => pair.key === id)) choices.delete(id);
    signature = nextSignature; restore(); highlight();
  }
  const pair = pairs[pairIndex];
  $('#polygon-pair-label').textContent = pair ? `Пара ${pairIndex + 1} из ${pairs.length}` : 'Нет пересекающихся пар';
  $('#polygon-first').textContent = pair ? `A: полигон #${pair.a.id} · ${state.layers.find((l) => l.id === pair.a.layer_id)?.name}` : '';
  $('#polygon-second').textContent = pair ? `B: полигон #${pair.b.id} · ${state.layers.find((l) => l.id === pair.b.layer_id)?.name}` : '';
  $('#polygon-pair-prev').disabled = busy || pairs.length < 2;
  $('#polygon-pair-next').disabled = busy || pairs.length < 2;
  for (const id of controls) $('#' + id).disabled = busy || !pair;
  const c = context();
  if (prepared && key(c) !== prepared) { prepared = null; clearPolygonPreview(); }
  $('#polygon-preview').disabled = busy || !c;
  $('#polygon-apply').disabled = busy || !prepared;
  $('#polygon-preview-clear').disabled = busy;
  $('#polygon-operations-close').disabled = busy;
  if (!pair) $('#polygon-operation-status').textContent = 'Выделено полигонов: ' + selected.length + '. Общей площади нет.';
}

export function resetPolygonOperations() {
  const wasPrepared = !!prepared;
  prepared = null; clearPolygonPreview(); signature = '';
  const button = $('#polygon-apply'); if (button) button.disabled = true;
  if (wasPrepared && $('#polygon-operation-status')) $('#polygon-operation-status').textContent = 'Предпросмотр сброшен. Проверьте результат снова.';
}

export function bindPolygonOperations() {
  bindDialogDrag($('#polygon-operations'));
  const status = $('#polygon-operation-status');
  for (const id of controls) $('#' + id).addEventListener('change', () => {
    remember(); highlight(); status.textContent = ''; renderPolygonOperations();
  });
  for (const [id, direction] of [['polygon-pair-prev', -1], ['polygon-pair-next', 1]]) $('#' + id).onclick = () => {
    if (busy || !pairs.length) return;
    remember(); pairIndex = (pairIndex + Number(direction) + pairs.length) % pairs.length;
    restore(); highlight(); status.textContent = ''; renderPolygonOperations();
  };
  $('#polygon-operations-close').onclick = () => { if (!busy) { choices.clear(); hooks.select(null); } };
  $('#polygon-preview').onclick = () => {
    const c = context(); if (!c || !canEdit()) return;
    try {
      const [a, b] = c.expected;
      const result = c.operation === 'reverse-difference' ? operate('difference', b, a) : operate(c.operation, a, b);
      setPolygonPreview(a, b, result); prepared = result ? key(c) : null;
      status.textContent = result ? 'Синий — A, оранжевый — B, фиолетовый — результат. Проверьте область и выбранный объект результата.' : 'Результат пуст: область полностью вырезана.';
    } catch (e) { prepared = null; status.textContent = 'Ошибка контуров: ' + e.message; }
    renderPolygonOperations();
  };
  $('#polygon-preview-clear').onclick = () => { prepared = null; clearPolygonPreview(); status.textContent = ''; renderPolygonOperations(); };
  $('#polygon-apply').onclick = async () => {
    const c = context(); if (!c || busy || !canEdit()) return;
    if (key(c) !== prepared) { resetPolygonOperations(); status.textContent = 'Контуры изменились. Повторите предпросмотр.'; return; }
    const selection = [...state.selectedIds];
    busy = true; renderPolygonOperations(); status.textContent = 'Сохраняю результат…';
    try {
      const feature = await hooks.polygonOperation(c);
      prepared = null; clearPolygonPreview();
      if (feature) {
        const surviving = selection.filter((id) => state.features.some((f) => f.id === id));
        if (!surviving.includes(feature.id)) surviving.push(feature.id);
        hooks.select(null); for (const id of surviving) hooks.select(id, true);
      }
      status.textContent = feature ? `Сохранён полигон #${feature.id}. Пары пересчитаны.` : 'Операция отменена: изменились день или сессия.';
    } catch (e) { status.textContent = e.message; }
    finally { busy = false; renderPolygonOperations(); }
  };
}
