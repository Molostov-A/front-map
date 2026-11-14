// Одноразовый выбор получателя импорта по клику на карте.
import { map, state } from '../core/store.js';
import { setMoveMode } from '../edit/move-mode.js';
import { select } from '../edit/selection.js';
import { fmLIds } from '../map/style-layers.js';
import { applyDeepStateTarget, disarmDeepStateImport } from '../ui/deepstate-import.js';

export const deepStateImportTool = {
  hint: () => 'Импорт DeepState: клик по полигону слоя DeepState заменяет его контур · Esc — выключить',
  onEnter() { state.draft = null; setMoveMode(false); select(null); },
  onLeave() { disarmDeepStateImport(); },
  onClick(e) {
    const layers = fmLIds();
    const hit = layers.length ? map.queryRenderedFeatures(e.point, { layers })[0] : null;
    if (hit) applyDeepStateTarget(Number(hit.properties.id));
  },
  onHover() { map.getCanvas().style.cursor = 'copy'; }
};
