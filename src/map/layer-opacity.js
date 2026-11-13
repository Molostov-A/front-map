// Общая прозрачность слоя умножается на собственную прозрачность каждой части объекта.
import { map } from '../core/store.js';

export function opacityPaint(paint, type, opacity) {
  const result = { ...paint };
  const keys = type === 'fill' ? ['fill-opacity'] : type === 'line' ? ['line-opacity']
    : type === 'circle' ? ['circle-opacity', 'circle-stroke-opacity'] : [];
  for (const key of keys) result[key] = ['*', paint[key] ?? 1, opacity ?? 1];
  return result;
}

// Исходные paint сохраняются в metadata, чтобы ползунок не умножал прозрачность повторно.
export function applyLayerOpacity(layer) {
  for (const item of map.getStyle().layers) {
    if (item.source !== `fmS-${layer.id}` || !item.metadata?.baseOpacityPaint) continue;
    const paint = opacityPaint(item.metadata.baseOpacityPaint, item.type, layer.opacity);
    for (const [key, value] of Object.entries(paint)) if (key.endsWith('-opacity')) map.setPaintProperty(item.id, key, value);
  }
}
