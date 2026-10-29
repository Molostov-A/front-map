// Дни YYYY-MM-DD: сегодня (локально), формат, сдвиг; currentDay — выбранный день или сегодня.
import { state } from './store.js';

export const todayDay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const fmtDay = (day) => {
  if (!day) return '—';
  const [y, m, d] = String(day).slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
};

export const shiftDay = (day, n) => {
  const d = new Date(String(day).slice(0, 10) + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const MONTHS_RU =  ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

// День, к которому относятся запросы. Клиент всегда передаёт его серверу явно:
// сервер считает «сегодня» по UTC, а пользователь — по местному времени.
export const currentDay = () => state.date || todayDay();
