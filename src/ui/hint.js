// Подсказка внизу экрана для текущего инструмента/режима.
import { state } from '../core/store.js';
import { $ } from '../core/util.js';

export function updateHint() {
  const h = $('#hint');
  if (state.appendArrow) {
    h.style.display = 'block';
    h.textContent = 'Дорисовка стрелки: клик — добавить узел · ПКМ / Esc — завершить';
    return;
  }
  if (state.tool === 'arrow') {
    h.style.display = 'block';
    const n = state.draft && state.draft.nodes ? state.draft.nodes.length : 0;
    h.textContent = n
      ? 'Shift+клик — добавить узел · ПКМ / Enter / двойной клик — завершить · Esc — отмена'
      : 'Клик — начало стрелки · Shift+клик — несколько узлов · ПКМ / Enter — завершить';
    return;
  }
  if (state.tool === 'ruler') {
    h.style.display = 'block';
    const n = state.draft && state.draft.coords ? state.draft.coords.length : 0;
    h.textContent = n >= 2
      ? 'Shift+клик — добавить точку · клик по первой точке / ПКМ / Enter / двойной клик — завершить · Esc — отмена'
      : (n === 1
        ? 'Клик — вторая точка (фиксация) · Shift+клик — добавить точку (ломаная) · Esc — отмена'
        : 'Клик — начало линейки · Shift+клик — ломаная из нескольких точек · Esc — отмена');
    return;
  }
  const msgs = {
    line: 'Клик — линия · Shift+клик — добавить точку · Enter / двойной клик — завершить · Esc — отмена',
    polygon: 'Клик — добавить точку · клик по первой точке / Enter — закрыть · Esc — отмена',
    point: 'Клик по карте — поставить точку',
    label: 'Клик по карте — создать надпись',
    ruler: 'Клик — начало линейки · клик — вторая точка (фиксация) · Esc — отмена',
    select: 'Клик — выбрать элемент · тяните синие точки · Del — удалить'
  };
  if (msgs[state.tool]) { h.style.display = 'block'; h.textContent = msgs[state.tool]; }
  else h.style.display = 'none';
}
