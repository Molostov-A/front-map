// Выбор объекта и применение стиля из панели к выбранному объекту.
import { normalizeStyle } from '../../shared/feature-schema.mjs';
import { activeSelected, map, state, STYLE_KEY, styleStateOf } from '../core/store.js';
import { setMoveMode } from './move-mode.js';
import { scheduleArrowPut } from './sync.js';
import { refreshSources } from '../map/render.js';
import { refreshDates } from '../ui/dates-panel.js';
import { updateStylePanels } from '../ui/style-panels.js';

export function select(id) {
  if (state.moveMode && id !== state.selectedId) setMoveMode(false);
  state.selectedId = id;
  state.appendArrow = false;
  const f = state.features.find((x) => x.id === id);
  // стиль панели всегда отражает выбранный элемент (иначе правка одного поля затирала бы остальные)
  if (f && STYLE_KEY[f.type]) state[STYLE_KEY[f.type]] = normalizeStyle(f.type, f.properties);
  refreshSources();
  updateStylePanels();
  refreshDates();
}

// Применить стиль из панели: нормализовать state.<type>Style, перенести в выбранный объект (PUT с дебаунсом),
// перерисовать. Для стрелки — ещё цвет/прозрачность предпросмотра черновика.
export function syncStyle(type) {
  const normalized = state[STYLE_KEY[type]] = normalizeStyle(type, styleStateOf(type));
  if (type === 'arrow' && map) {
    try {
      map.setPaintProperty('fmO-arrow-preview', 'fill-color', normalized.color);
      map.setPaintProperty('fmO-arrow-preview', 'fill-opacity', normalized.opacity);
    } catch (e) { /* стиль ещё строится */ }
  }
  const sel = activeSelected(type);
  if (sel) {
    sel.properties = { ...sel.properties, ...normalized };
    scheduleArrowPut(sel);
  }
  refreshSources();
  updateStylePanels();
}
