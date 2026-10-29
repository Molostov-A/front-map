// Инструмент «Надпись»: клик — спросить текст и создать надпись.
import { state } from '../core/store.js';
import { promptModal } from '../ui/modals.js';
import { createFeature, defaultPropsFor } from './draw.js';

export const labelTool = {
  onClick({ lngLat }) {
    promptModal({ title: 'Текст надписи', name: '', showColor: false }).then((r) => {
      if (r && r.name.trim()) {
        createFeature({
          layer_id: state.activeLayerId,
          type: 'label',
          geometry: { type: 'Point', coordinates: lngLat },
          properties: { ...defaultPropsFor('label'), text: r.name.trim() }
        });
      }
    });
    return false;
  }
};
