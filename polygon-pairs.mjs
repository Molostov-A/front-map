// Стабильные пары выделенных полигонов с пересечением ненулевой площади.
import { operate } from './polygon.mjs';

export function polygonPairs(features, selectedIds, layers) {
  const visible = new Set(layers.filter((l) => l.visible).map((l) => l.id));
  const selected = [...new Set(selectedIds)].map((id) => features.find((f) => f.id === id))
    .filter((f) => f?.type === 'polygon' && f.geometry && visible.has(f.layer_id));
  const pairs = [];
  for (let i = 0; i < selected.length; i++) for (let j = i + 1; j < selected.length; j++) {
    const a = selected[i], b = selected[j];
    if (operate('intersection', a.geometry, b.geometry)) pairs.push({ a, b, key: `${a.id}:${b.id}` });
  }
  return pairs;
}

export function nextSelection(ids, id, additive) {
  if (id == null) return [];
  if (!additive) return [id];
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}
