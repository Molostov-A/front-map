// Инструмент «Точка»: клик — сразу создаёт точку.
import { state } from '../core/store.js';
import { createFeature, defaultPropsFor } from './draw.js';

export const pointTool = {
  hint: () => 'Клик по карте — поставить точку',
  onClick({ lngLat }) {
    createFeature({ layer_id: state.activeLayerId, type: 'point', geometry: { type: 'Point', coordinates: lngLat }, properties: defaultPropsFor('point') });
    return false;
  }
};
