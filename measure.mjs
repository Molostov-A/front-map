export const EARTH_R_KM = 6371.0088;

export function toRad(deg) { return deg * Math.PI / 180; }

export function haversineKm(a, b) {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function lineLengthKm(coords) {
  let sum = 0;
  for (let i = 1; i < coords.length; i++) sum += haversineKm(coords[i - 1], coords[i]);
  return sum;
}

export function ringAreaKm2(ring) {
  const n = ring.length;
  if (n < 3) return 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n];
    total += toRad(b[0] - a[0]) * (2 + Math.sin(toRad(a[1])) + Math.sin(toRad(b[1])));
  }
  return Math.abs(total * EARTH_R_KM * EARTH_R_KM / 2);
}

export function polygonAreaKm2(geom) {
  if (!geom) return 0;
  if (geom.type === 'Polygon') {
    return geom.coordinates.reduce((acc, ring, i) => acc + (i === 0 ? 1 : -1) * ringAreaKm2(ring), 0);
  }
  if (geom.type === 'MultiPolygon') {
    return geom.coordinates.reduce((acc, poly) => acc
      + poly.reduce((a, ring, i) => a + (i === 0 ? 1 : -1) * ringAreaKm2(ring), 0), 0);
  }
  return 0;
}

export function formatLength(km) {
  if (!isFinite(km) || km <= 0) return '—';
  if (km < 1) return Math.round(km * 1000) + ' м';
  return km.toFixed(2) + ' км';
}

export function formatArea(km2) {
  if (!isFinite(km2) || km2 <= 0) return '—';
  if (km2 >= 1000) return (km2 / 1000).toFixed(2) + ' тыс. км²';
  if (km2 >= 1) return km2.toFixed(2) + ' км²';
  if (km2 >= 0.001) return km2.toFixed(3) + ' км²';
  return km2.toExponential(2) + ' км²';
}

// Шаг делений линейки (в метрах) подбирается под масштаб: small = major / 10.
export const RULER_UNITS = [
  10, 20, 50, 100, 200, 500,
  1000, 2000, 5000, 10000, 20000, 50000,
  100000, 200000, 500000, 1000000, 2000000, 5000000,
  10000000, 20000000, 50000000
];
const RULER_MAX_SMALL_STEPS = 30;
const RULER_NEXT_MAX_MAJOR = 4;

// Выбирает «крупный» шаг так, чтобы мелких делений было не больше лимита,
// а следующая ступень не давала слишком мало крупных отрезков.
export function pickRulerMajorUnit(lenPx, metersPerScreenPx) {
  let majorMeters = RULER_UNITS[0];
  for (let idx = 0; idx < RULER_UNITS.length; idx++) {
    const u = RULER_UNITS[idx];
    const majorPx = u / metersPerScreenPx;
    const smallPx = majorPx / 10;
    const smallOk = (lenPx / smallPx) <= RULER_MAX_SMALL_STEPS;
    let nextTooMany = false;
    if (idx + 1 < RULER_UNITS.length) {
      const nextPx = RULER_UNITS[idx + 1] / metersPerScreenPx;
      if (lenPx / nextPx > RULER_NEXT_MAX_MAJOR) nextTooMany = true;
    }
    majorMeters = u;
    if (smallOk && !nextTooMany) break;
  }
  return majorMeters;
}

// Подпись деления линейки (в метрах): «500 м», «1.5 км», «2 тыс. км».
export function formatUnit(meters) {
  if (!isFinite(meters)) return '';
  const trim = (v, d) => {
    const s = v.toFixed(d);
    return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
  };
  if (meters >= 1000000) return trim(meters / 1000000, 2) + ' тыс. км';
  if (meters >= 1000) return trim(meters / 1000, 2) + ' км';
  return trim(meters, 1) + ' м';
}

export function ringCentroid(ring) {
  let A = 0, cx = 0, cy = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n];
    const cross = a[0] * b[1] - b[0] * a[1];
    A += cross;
    cx += (a[0] + b[0]) * cross;
    cy += (a[1] + b[1]) * cross;
  }
  A *= 0.5;
  if (Math.abs(A) < 1e-12) {
    let sx = 0, sy = 0;
    for (const p of ring) { sx += p[0]; sy += p[1]; }
    return { x: sx / n, y: sy / n, area: 0 };
  }
  return { x: cx / (6 * A), y: cy / (6 * A), area: A };
}

export function polygonLabelPoint(geom) {
  const rings = geom.type === 'Polygon' ? [geom.coordinates[0]]
    : geom.coordinates.map((p) => p[0]);
  let best = null;
  for (const ring of rings) {
    if (!ring || ring.length < 3) continue;
    const c = ringCentroid(ring);
    if (!best || Math.abs(c.area) > Math.abs(best.area)) best = c;
  }
  return best ? [best.x, best.y] : null;
}
