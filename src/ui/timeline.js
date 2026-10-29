// Таймлайн (день назад/вперёд/сейчас) и календарь.
import { currentDay, fmtDay, MONTHS_RU, shiftDay, todayDay } from '../core/days.js';
import { hooks } from '../core/hooks.js';
import { state } from '../core/store.js';
import { $, toast } from '../core/util.js';
import { updateHint } from './hint.js';

export function renderTimeline() {
  const el = $('#tl-date');
  if (el) el.textContent = fmtDay(currentDay());
  const now = $('#tl-now');
  if (now) now.classList.toggle('hist', state.date !== null);
}

/* переход на произвольный день (календарь) */

export async function setDay(day) {
  state.date = day || null;
  closeCalendar();
  renderTimeline();
  updateHint();
  try { await hooks.reload(); } catch (e) { toast('Ошибка: ' + e.message); }
}

/* сдвиг на соседний день */

export function stepDay(n) {
  setDay(shiftDay(currentDay(), n));
}

export function openCalendar() {
  const base = state.date ? new Date(state.date + 'T00:00:00') : new Date();
  state.calView = new Date(base.getFullYear(), base.getMonth(), 1);
  renderCalendar();
  $('#calendar').classList.remove('hidden');
}

export function closeCalendar() {
  const cal = $('#calendar');
  if (cal) cal.classList.add('hidden');
}

export function renderCalendar() {
  const cal = $('#calendar');
  if (!cal || !state.calView) return;
  const y = state.calView.getFullYear();
  const m = state.calView.getMonth();
  const sel = state.date;
  const today = todayDay();
  const startDow = (new Date(y, m, 1).getDay() + 6) % 7; // Пн = 0
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const dow = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  let html = `<div id="cal-head">
    <button class="icon-btn" data-cal="prev" title="Предыдущий месяц">‹</button>
    <span class="cal-title">${MONTHS_RU[m]} ${y}</span>
    <button class="icon-btn" data-cal="next" title="Следующий месяц">›</button>
  </div><div id="cal-grid">`;
  dow.forEach((d) => { html += `<span class="cal-dow">${d}</span>`; });
  for (let i = 0; i < startDow; i++) html += '<span></span>';
  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cls = ['cal-day'];
    if (dayStr === today) cls.push('today');
    if (dayStr === sel) cls.push('sel');
    html += `<button class="${cls.join(' ')}" data-day="${dayStr}">${day}</button>`;
  }
  html += '</div>';
  cal.innerHTML = html;

  cal.querySelectorAll('[data-cal]').forEach((b) => {
    b.onclick = () => {
      state.calView = new Date(y, m + (b.dataset.cal === 'next' ? 1 : -1), 1);
      renderCalendar();
    };
  });
  cal.querySelectorAll('[data-day]').forEach((b) => {
    b.onclick = () => setDay(b.dataset.day);
  });
}

// Таймлайн и календарь.
export function bindTimeline() {
  $('#tl-prev').onclick = () => stepDay(-1);
  $('#tl-next').onclick = () => stepDay(1);
  $('#tl-now').onclick = async () => {
    state.date = null;
    state.selectedId = null;
    closeCalendar();
    renderTimeline();
    updateHint();
    try { await hooks.reload(); } catch (e) { toast('Ошибка: ' + e.message); }
  };
  $('#tl-cal').onclick = (e) => {
    e.stopPropagation();
    if ($('#calendar').classList.contains('hidden')) openCalendar();
    else closeCalendar();
  };
  $('#tl-date').onclick = () => { if ($('#calendar').classList.contains('hidden')) openCalendar(); };
  $('#calendar').addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', (e) => {
    const cal = $('#calendar');
    if (!cal.classList.contains('hidden') && !cal.contains(e.target) && e.target.id !== 'tl-cal' && e.target.id !== 'tl-date') {
      closeCalendar();
    }
  });
}
