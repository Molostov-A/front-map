// Две даты, цветовая легенда и защита асинхронного сравнения от смены контекста.
import { compare } from '../../polygon.mjs';
import { formatArea, polygonAreaKm2 } from '../../measure.mjs';
import { api, getToken } from '../core/api.js';
import { currentDay, shiftDay } from '../core/days.js';
import { hooks } from '../core/hooks.js';
import { state } from '../core/store.js';
import { $ } from '../core/util.js';
import { clearComparison, comparisonDefaults, recolorComparison, setComparison } from '../map/date-comparison.js';
import { setDay } from './timeline.js';

let generation = 0, busy = false, ready = false;
const colorKeys = ['addedFill', 'addedLine', 'removedFill', 'removedLine'];
const inputId = (key) => '#compare-' + key;
const validDay = (day) => /^\d{4}-\d{2}-\d{2}$/.test(day)
  && Number.isFinite(Date.parse(day + 'T00:00:00Z')) && new Date(day + 'T00:00:00Z').toISOString().slice(0, 10) === day;

export function comparisonSettings() {
  const colors = { ...comparisonDefaults };
  for (const key of colorKeys) {
    const value = $(inputId(key)).value;
    if (/^#[0-9a-f]{6}$/i.test(value)) colors[key] = value;
  }
  colors.opacity = Math.max(0.1, Math.min(0.8, Number($('#compare-opacity').value) / 100 || 0.5));
  return colors;
}
export function resetDateComparison() {
  const wasActive = ready || busy;
  generation++; busy = false; clearComparison();
  if (wasActive) $('#compare-status').textContent = 'Карта изменилась. Запустите сравнение снова.';
  ready = false;
  const button = $('#compare-run'); if (button) button.disabled = false;
  for (const id of ['#compare-added-area', '#compare-removed-area']) if ($(id)) $(id).textContent = '—';
}
export function updateComparisonColors() {
  const colors = comparisonSettings(); recolorComparison(colors);
  for (const kind of ['added', 'removed']) {
    const swatch = $('#compare-' + kind + '-swatch');
    swatch.style.background = colors[kind + 'Fill']; swatch.style.borderColor = colors[kind + 'Line'];
  }
  try { localStorage.setItem('fm_comparison_colors', JSON.stringify(colors)); } catch (e) { /* browser storage optional */ }
}

export async function runDateComparison() {
  if (busy) return;
  const from = $('#compare-from').value, to = $('#compare-to').value, token = getToken();
  if (!validDay(from) || !validDay(to) || from > to) {
    $('#compare-status').textContent = 'Выберите корректные даты: «С» не позже «По».'; return;
  }
  let request = ++generation;
  const sameSession = () => token && token === getToken();
  const active = () => request === generation && sameSession() && currentDay() === to;
  busy = true; ready = false; clearComparison(); $('#compare-run').disabled = true;
  $('#compare-status').textContent = 'Загружаю состояния полигонов…';
  try {
    await hooks.flushSaves();
    if (request !== generation || !sameSession()) return;
    // reload синхронно инвалидирует старое сравнение; поколение нового берём после вызова.
    const loading = setDay(to);
    request = ++generation; busy = true; $('#compare-run').disabled = true;
    $('#compare-status').textContent = 'Загружаю состояния полигонов…';
    if ((await loading) === false) throw new Error('Не удалось загрузить основную карту');
    if (!active()) return;
    const [before, after] = await Promise.all([
      api.get('/api/map?date=' + encodeURIComponent(from)), api.get('/api/map?date=' + encodeURIComponent(to))
    ]);
    if (!active()) return;
    const visible = new Set(state.layers.filter((l) => l.visible).map((l) => l.id));
    const fc = compare(before.features, after.features, visible);
    setComparison(fc, comparisonSettings()); ready = true;
    for (const kind of ['added', 'removed']) {
      const area = fc.features.filter((f) => f.properties.kind === kind).reduce((sum, f) => sum + polygonAreaKm2(f.geometry), 0);
      $('#compare-' + kind + '-area').textContent = area ? formatArea(area) : '0 км²';
    }
    $('#compare-status').textContent = fc.features.length
      ? `Сравнение ${from} → ${to}. Цветом показаны изменения площади видимых полигонов.`
      : 'Изменений площади видимых полигонов нет.';
  } catch (e) {
    if (request === generation && sameSession()) { clearComparison(); $('#compare-status').textContent = 'Ошибка сравнения: ' + e.message; }
  } finally {
    if (request === generation) { busy = false; $('#compare-run').disabled = false; }
  }
}

export function bindDateComparison() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('fm_comparison_colors') || '{}') || {}; } catch (e) { /* defaults */ }
  for (const key of colorKeys) $(inputId(key)).value = /^#[0-9a-f]{6}$/i.test(saved[key]) ? saved[key] : comparisonDefaults[key];
  $('#compare-opacity').value = Math.round((typeof saved.opacity === 'number' && saved.opacity >= 0.1 && saved.opacity <= 0.8 ? saved.opacity : 0.5) * 100);
  updateComparisonColors();
  $('#btn-compare').onclick = () => {
    const panel = $('#date-comparison'); panel.hidden = !panel.hidden;
    if (!$('#compare-from').value) $('#compare-from').value = shiftDay(currentDay(), -1);
    if (!$('#compare-to').value) $('#compare-to').value = currentDay();
  };
  $('#compare-run').onclick = runDateComparison;
  $('#compare-close').onclick = () => { resetDateComparison(); $('#date-comparison').hidden = true; };
  $('#compare-off').onclick = () => { resetDateComparison(); $('#compare-status').textContent = 'Сравнение выключено.'; };
  for (const id of ['#compare-from', '#compare-to']) $(id).addEventListener('change', resetDateComparison);
  for (const key of colorKeys) $(inputId(key)).addEventListener('input', updateComparisonColors);
  $('#compare-opacity').addEventListener('input', updateComparisonColors);
}
