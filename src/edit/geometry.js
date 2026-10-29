// Правка координат: перенос геометрии целиком, запись вершины/касательной.
import { project } from '../../arrow.mjs';

export function translateGeom(geom, orig, dx, dy) {
  if (!geom || !orig) return;
  if (geom.type === 'Point') geom.coordinates = [orig.coordinates[0] + dx, orig.coordinates[1] + dy];
  else if (geom.type === 'LineString') geom.coordinates = orig.coordinates.map((c) => [c[0] + dx, c[1] + dy]);
  else if (geom.type === 'MultiLineString') geom.coordinates = orig.coordinates.map((l) => l.map((c) => [c[0] + dx, c[1] + dy]));
  else if (geom.type === 'Polygon') geom.coordinates = orig.coordinates.map((r) => r.map((c) => [c[0] + dx, c[1] + dy]));
  else if (geom.type === 'MultiPolygon') geom.coordinates = orig.coordinates.map((p) => p.map((r) => r.map((c) => [c[0] + dx, c[1] + dy])));
}

export function applyCoord(feat, g, c) {
  const geo = feat.geometry;
  if (g.type === 'tangent') {
    const p = feat.properties || (feat.properties = {});
    const meta = Array.isArray(p.nodeMeta) ? [...p.nodeMeta] : [];
    while (meta.length < geo.coordinates.length) meta.push({ auto: true });
    const node = project(geo.coordinates[g.index]);
    const off = project(c);
    const prev = meta[g.index] && meta[g.index].auto === false ? meta[g.index] : {};
    const m = { ...prev, auto: false };
    if (g.which === 'in') m.i = [off[0] - node[0], off[1] - node[1]];
    else m.o = [off[0] - node[0], off[1] - node[1]];
    meta[g.index] = m;
    p.nodeMeta = meta;
    return;
  }
  if (geo.type === 'Point') geo.coordinates = c;
  else if (geo.type === 'LineString') geo.coordinates[g.index] = c;
  else if (geo.type === 'MultiLineString') {
    geo.coordinates[g.ring][g.index] = c;
    if (g.ring === 0) { // середина основания следует за хвостом
      const [a, b] = geo.coordinates[0];
      geo.coordinates[1][0] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    }
  }
  else if (geo.type === 'Polygon') {
    const ring = geo.coordinates[g.ring];
    ring[g.index] = c;
    if (g.index === 0) ring[ring.length - 1] = c;
  }
}
