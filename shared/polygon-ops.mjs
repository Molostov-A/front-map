// Общий GeoJSON-адаптер: движок подставляется из npm (сервер) / vendor (браузер).
export const isPolygon = (g) => g && (g.type === 'Polygon' || g.type === 'MultiPolygon');
export const polygonParts = (g) => !isPolygon(g) ? [] : g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
export const polygonGeometry = (parts) => !parts.length ? null
  : parts.length === 1 ? { type: 'Polygon', coordinates: parts[0] } : { type: 'MultiPolygon', coordinates: parts };

export function createPolygonOps(engine) {
  function operate(operation, a, b) {
    if (!['union', 'difference', 'intersection'].includes(operation)) throw new Error('Неизвестная операция');
    if (!isPolygon(a) || !isPolygon(b)) throw new Error('Нужны два полигона');
    return polygonGeometry(engine[operation](polygonParts(a), polygonParts(b)));
  }
  function compare(before, after, visibleLayers, { includeUnchanged = false } = {}) {
    const index = (features) => new Map(features.filter((f) => f.type === 'polygon' && isPolygon(f.geometry)
      && (!visibleLayers || visibleLayers.has(f.layer_id))).map((f) => [f.id, f]));
    const old = index(before), next = index(after), result = [];
    for (const id of new Set([...old.keys(), ...next.keys()])) {
      const a = old.get(id), b = next.get(id);
      if (includeUnchanged && a && b) {
        const geometry = operate('intersection', a.geometry, b.geometry);
        if (geometry) result.push({ type: 'Feature', geometry,
          properties: { kind: 'unchanged', featureId: id, layerId: b.layer_id } });
      }
      for (const kind of ['added', 'removed']) {
        const subject = kind === 'added' ? b : a;
        const clip = kind === 'added' ? a : b;
        if (!subject) continue;
        const geometry = clip ? operate('difference', subject.geometry, clip.geometry) : structuredClone(subject.geometry);
        if (geometry) result.push({ type: 'Feature', geometry,
          properties: { kind, featureId: id, layerId: subject.layer_id } });
      }
    }
    return { type: 'FeatureCollection', features: result };
  }
  return { operate, compare };
}
