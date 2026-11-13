// Пипетка переносит оформление, сохраняя данные и параметры географической формы.
import { FEATURE_TYPES, normalizeStyle } from './shared/feature-schema.mjs';

const excluded = new Set(['text', 'caption', 'nodeMeta', 'smooth', 'smoothAmount',
  'baseWidth', 'headBaseWidth', 'headLength', 'headShape', 'earsEnabled', 'earSpread', 'earForward', 'stemMode']);

export function sampleAppearance(feature) {
  if (!FEATURE_TYPES.includes(feature.type)) throw new Error('Неизвестный тип объекта');
  const style = normalizeStyle(feature.type, feature.properties);
  for (const key of excluded) delete style[key];
  return { type: feature.type, style: structuredClone(style) };
}

export function transferAppearance(sample, target) {
  if (!FEATURE_TYPES.includes(target.type)) throw new Error('Неизвестный тип объекта');
  const current = normalizeStyle(target.type, target.properties), patch = {};
  for (const [key, value] of Object.entries(sample.style)) {
    if (!excluded.has(key) && Object.hasOwn(current, key)) patch[key] = structuredClone(value);
  }
  const color = sample.style.color || sample.style.label?.color;
  const opacity = sample.style.opacity ?? (sample.type === 'label' ? sample.style.label?.opacity : undefined);
  if (target.type === 'label' && !patch.label) {
    patch.label = { ...current.label, ...(color ? { color } : {}), ...(opacity !== undefined ? { opacity } : {}) };
  } else {
    if (color && Object.hasOwn(current, 'color') && !patch.color) patch.color = color;
    if (opacity !== undefined && Object.hasOwn(current, 'opacity') && patch.opacity === undefined) patch.opacity = opacity;
  }
  const normalized = normalizeStyle(target.type, { ...target.properties, ...patch });
  return { ...structuredClone(target.properties), ...Object.fromEntries(Object.keys(patch).map((key) => [key, normalized[key]])) };
}
