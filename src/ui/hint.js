// Подсказка внизу экрана: режим «Дорисовать» стрелки или текст текущего инструмента (tools/<type>.js → hint).
import { state } from '../core/store.js';
import { TOOLS } from '../core/tools-registry.js';
import { $ } from '../core/util.js';

export function updateHint() {
  const h = $('#hint');
  const tool = TOOLS[state.tool];
  const text = state.appendArrow
    ? 'Дорисовка стрелки: клик — добавить узел · ПКМ / Esc — завершить'
    : (tool && tool.hint ? tool.hint(state.draft) : '');
  h.style.display = text ? 'block' : 'none';
  if (text) h.textContent = text;
}
