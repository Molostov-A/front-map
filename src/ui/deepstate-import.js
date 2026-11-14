// Загрузка GeoJSON, предпросмотр, новый объект или одноразовое применение кликом.
import { geometryHash } from '../../geometry-hash.mjs';
import { formatArea, polygonAreaKm2 } from '../../measure.mjs';
import { api, getToken } from '../core/api.js';
import { currentDay } from '../core/days.js';
import { hooks } from '../core/hooks.js';
import { canEdit } from '../core/session.js';
import { map, state } from '../core/store.js';
import { $ } from '../core/util.js';
import { clearDeepStatePreview, setDeepStatePreview } from '../map/deepstate-preview.js';
import { bindDialogDrag } from './float-panels.js';

let candidates = [], layerId = null, fileName = '', generation = 0, busy = false, ready = false, pending = null;
const status = (text) => { $('#ds-status').textContent = text; };
const candidate = () => candidates[Number($('#ds-contour').value)];
const sessionActive = (token, day) => token && token === getToken() && canEdit() && day === currentDay();
export function disarmDeepStateImport() { $('#ds-click-apply').checked = false; }
function disarm() {
  disarmDeepStateImport();
  if (state.tool === 'deepstate-import') hooks.importMode(false);
}
export function resetDeepStateImport() {
  generation++; busy = false; ready = false; pending = null;
  disarm(); clearDeepStatePreview();
  if ($('#ds-record-day')) $('#ds-record-day').textContent = currentDay();
  if (candidates.length && !$('#deepstate-import').hidden) status('Карта изменилась. Проверьте день записи и повторите предпросмотр.');
  renderControls();
}
function renderControls() {
  if (!$('#ds-create')) return;
  const update = $('#ds-mode').value === 'update', has = !!candidate();
  $('#ds-create').hidden = update; $('#ds-click-row').hidden = !update;
  $('#ds-create').disabled = busy || !has || !ready || !$('#ds-source-day').value;
  $('#ds-click-apply').disabled = busy || !has || !ready || !$('#ds-source-day').value;
  for (const id of ['ds-file', 'ds-contour', 'ds-mode', 'ds-source-day', 'ds-close']) $('#' + id).disabled = busy;
  $('#ds-preview').disabled = busy || !has; $('#ds-fit').disabled = busy || !has;
  $('#btn-deepstate').disabled = busy;
}
function showCandidate() {
  disarm(); pending = null; ready = false; clearDeepStatePreview();
  const item = candidate();
  if (item) {
    $('#ds-source-day').value = item.sourceDay || '';
    $('#ds-details').textContent = `${item.name} · ${item.geometry.type} · ${formatArea(polygonAreaKm2(item.geometry))}`;
    setDeepStatePreview(item.geometry); ready = true;
  }
  renderControls();
}
export async function loadDeepStateFile(file) {
  if (!file || !canEdit()) return;
  resetDeepStateImport(); candidates = []; $('#ds-contour').replaceChildren(); $('#ds-details').textContent = '';
  const request = ++generation, token = getToken(), day = currentDay();
  const active = () => request === generation && sessionActive(token, day);
  busy = true; renderControls(); status('Проверяю GeoJSON…');
  try {
    if (file.size > 8 * 1024 * 1024) throw new Error('Файл больше 8 МБ');
    const text = await file.text(); if (!active()) return;
    let geojson;
    try { geojson = JSON.parse(text.replace(/^\uFEFF/, '')); } catch (e) { throw new Error('Файл не является корректным JSON'); }
    const result = await api.send('POST', '/api/imports/deepstate/preview', { geojson });
    if (!active()) return;
    candidates = result.candidates; fileName = file.name;
    candidates.forEach((item, index) => {
      const option = document.createElement('option'); option.value = String(index);
      option.textContent = `${item.name} · id ${item.sourceId}${item.sourceDay ? ' · ' + item.sourceDay : ''}`;
      $('#ds-contour').appendChild(option);
    });
    $('#ds-contour').value = '0'; showCandidate();
    status(`Контуров: ${candidates.length}. Пропущено неполигональных объектов: ${result.skipped}. Проверьте дату источника и предпросмотр.`);
  } catch (e) { if (active()) status('Ошибка: ' + e.message); }
  finally { if (active()) { busy = false; renderControls(); } }
}

export async function applyDeepStateTarget(targetId = null) {
  const item = candidate(), update = $('#ds-mode').value === 'update';
  if (busy || !canEdit() || !ready || !item || !$('#ds-source-day').value) return;
  if (update && (!$('#ds-click-apply').checked || state.tool !== 'deepstate-import')) return;
  if (!update && targetId != null) return;
  const target = update ? state.features.find((f) => f.id === targetId && f.type === 'polygon' && f.layer_id === layerId) : null;
  if (update && !target) { status('Выберите полигон слоя DeepState. Объекты других слоёв не изменяются.'); return; }
  const token = getToken(), day = currentDay(), request = generation;
  let finalGeneration = request;
  const body = { mode: update ? 'update' : 'new', geometry: item.geometry, date: day,
    target_id: target?.id, expected_hash: target ? '' : undefined,
    source_day: $('#ds-source-day').value, file_name: fileName, source_feature_id: item.sourceId };
  const expected = target ? structuredClone(target.geometry) : null;
  busy = true; renderControls(); status('Сохраняю импорт…');
  const active = () => request === generation && sessionActive(token, day);
  try {
    await hooks.flushSaves(); if (!active()) return;
    if (expected) body.expected_hash = await geometryHash(expected);
    if (!active()) return;
    const signature = JSON.stringify(body);
    if (pending?.signature !== signature) pending = { signature, id: crypto.randomUUID() };
    const result = await api.send('POST', '/api/imports/deepstate/apply', { ...body, request_id: pending.id });
    if (!active()) return;
    disarm(); clearDeepStatePreview(); ready = false; pending = null;
    const reload = hooks.reload(); finalGeneration = generation;
    await reload;
    if (finalGeneration !== generation || !sessionActive(token, day)) return;
    hooks.select(result.feature.id);
    status(`${update ? 'Обновлён' : 'Создан'} полигон #${result.feature.id} на ${day}. Дата DeepState: ${body.source_day}. Применение кликом выключено.`);
  } catch (e) { if (active()) { disarm(); status('Ошибка: ' + e.message); } }
  finally { if (finalGeneration === generation && sessionActive(token, day)) { busy = false; renderControls(); } }
}

export function bindDeepStateImport() {
  bindDialogDrag($('#deepstate-import'));
  $('#btn-deepstate').onclick = async () => {
    if (!canEdit() || busy) return;
    resetDeepStateImport(); $('#deepstate-import').hidden = false;
    const token = getToken(), day = currentDay();
    let task = generation;
    const active = () => task === generation && sessionActive(token, day);
    $('#ds-last-import').textContent = '';
    busy = true; renderControls(); status('Открываю слой DeepState…');
    try {
      await hooks.flushSaves(); if (!active()) return;
      const layer = await api.send('POST', '/api/imports/deepstate/layer', {});
      if (!active()) return;
      layerId = layer.id; state.activeLayerId = layer.id;
      const reload = hooks.reload(); task = generation;
      await reload;
      if (!active()) return;
      status('Слой готов. Выберите GeoJSON-файл, затем контур и дату данных.');
      const info = await api.get('/api/imports/deepstate');
      if (active() && info.imports[0]) {
        const last = info.imports[0];
        $('#ds-last-import').textContent = `Последний импорт: #${last.feature_id} · данные ${last.source_day} · запись ${last.valid_from} · ${last.file_name}`;
      }
    } catch (e) { if (active()) status('Ошибка: ' + e.message); }
    finally { if (active()) { busy = false; renderControls(); } }
  };
  $('#ds-close').onclick = () => { resetDeepStateImport(); $('#deepstate-import').hidden = true; };
  $('#ds-file').onchange = () => loadDeepStateFile($('#ds-file').files[0]);
  $('#ds-contour').onchange = showCandidate;
  $('#ds-mode').onchange = () => { disarm(); pending = null; renderControls(); };
  $('#ds-source-day').onchange = () => { disarm(); pending = null; renderControls(); };
  $('#ds-preview').onclick = () => {
    const item = candidate(); if (!item) return;
    setDeepStatePreview(item.geometry); ready = true; renderControls();
    status('Голубая заливка и пунктир — импортируемый контур. При обновлении он полностью заменит геометрию получателя.');
  };
  $('#ds-fit').onclick = () => {
    const b = candidate()?.bbox;
    if (b) map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 70, maxZoom: 11, duration: 0 });
  };
  $('#ds-click-apply').onchange = () => {
    if (!$('#ds-click-apply').checked) { disarm(); return; }
    const layer = state.layers.find((l) => l.id === layerId);
    if (!layer?.visible) { disarm(); status('Включите видимость слоя DeepState, чтобы выбрать полигон.'); return; }
    hooks.importMode(true);
    status('Кликните полигон слоя DeepState: его геометрия будет заменена загруженным контуром. Esc отключает режим.');
  };
  $('#ds-create').onclick = () => applyDeepStateTarget();
  renderControls();
}
