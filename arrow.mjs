// Геометрия стрелок — порт arrow-example.html на географические координаты.
// Внутренние вычисления ведутся в метрах Меркатора (project/unproject),
// поэтому размеры (ширина, наконечник, ушки) задаются в метрах.

const R = 6378137;
const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

export function project(lngLat) {
  const [lng, lat] = lngLat;
  const x = R * lng * DEG;
  const y = R * Math.log(Math.tan(Math.PI / 4 + lat * DEG / 2));
  return [x, y];
}

export function unproject(xy) {
  const [x, y] = xy;
  const lng = x * RAD / R;
  const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * RAD;
  return [lng, lat];
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const fin = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const distance = (p, q) => Math.hypot(q.x - p.x, q.y - p.y);

function normalizeVector(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: 0, y: 0 };
  return { x: dx / len, y: dy / len };
}

function makeNode(x, y) {
  return { x, y, hInX: x, hInY: y, hOutX: x, hOutY: y, auto: true };
}

function recalcAutoHandles(points, tension) {
  const n = points.length;
  if (n < 2) return;
  for (let i = 0; i < n; i++) {
    if (!points[i].auto) continue;
    let tx, ty;
    if (i === 0) {
      tx = points[1].x - points[0].x;
      ty = points[1].y - points[0].y;
    } else if (i === n - 1) {
      tx = points[n - 1].x - points[n - 2].x;
      ty = points[n - 1].y - points[n - 2].y;
    } else {
      tx = points[i + 1].x - points[i - 1].x;
      ty = points[i + 1].y - points[i - 1].y;
    }
    const tlen = Math.hypot(tx, ty) || 1;
    const nx = tx / tlen, ny = ty / tlen;
    const dPrev = i > 0 ? distance(points[i], points[i - 1]) : 0;
    const dNext = i < n - 1 ? distance(points[i], points[i + 1]) : 0;
    let scale = (dPrev + dNext) / 2;
    if (scale < 1e-6) scale = 40;
    const handleLen = scale * 0.35 * tension;
    points[i].hOutX = points[i].x + nx * handleLen;
    points[i].hOutY = points[i].y + ny * handleLen;
    points[i].hInX = points[i].x - nx * handleLen;
    points[i].hInY = points[i].y - ny * handleLen;
  }
}

function bezier(p0, c1, c2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  const mt = 1 - t, mt2 = mt * mt, mt3 = mt2 * mt;
  return {
    x: mt3 * p0.x + 3 * mt2 * t * c1.x + 3 * mt * t2 * c2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * c1.y + 3 * mt * t2 * c2.y + t3 * p3.y,
    dx: 3 * mt2 * (c1.x - p0.x) + 6 * mt * t * (c2.x - c1.x) + 3 * t2 * (p3.x - c2.x),
    dy: 3 * mt2 * (c1.y - p0.y) + 6 * mt * t * (c2.y - c1.y) + 3 * t2 * (p3.y - c2.y)
  };
}

// Центральная линия: ломаная по узлам либо сглаженная кривая Безье.
function buildPath(pts, stemMode) {
  const n = pts.length;
  if (stemMode === 'smooth' && n >= 2) {
    const SAMPLES = 20;
    const path = [];
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[i], p3 = pts[i + 1];
      const c1 = { x: p0.hOutX, y: p0.hOutY };
      const c2 = { x: p3.hInX, y: p3.hInY };
      for (let s = 0; s < SAMPLES; s++) {
        const t = s / SAMPLES;
        const b = bezier(p0, c1, c2, p3, t);
        const dlen = Math.hypot(b.dx, b.dy) || 1;
        path.push({ x: b.x, y: b.y, dirX: b.dx / dlen, dirY: b.dy / dlen, globalT: (i + t) / (n - 1) });
      }
    }
    const last = pts[n - 1];
    const prevP = path[path.length - 1];
    path.push({
      x: last.x, y: last.y,
      dirX: prevP ? prevP.dirX : 1,
      dirY: prevP ? prevP.dirY : 0,
      globalT: 1
    });
    return path;
  }

  const path = [];
  for (let i = 0; i < n; i++) {
    let dirX, dirY;
    if (i === 0) {
      const d = normalizeVector(pts[0], pts[1]);
      dirX = d.x; dirY = d.y;
    } else if (i === n - 1) {
      const d = normalizeVector(pts[n - 2], pts[n - 1]);
      dirX = d.x; dirY = d.y;
    } else {
      const d1 = normalizeVector(pts[i - 1], pts[i]);
      const d2 = normalizeVector(pts[i], pts[i + 1]);
      const sumX = d1.x + d2.x, sumY = d1.y + d2.y;
      const len = Math.hypot(sumX, sumY);
      if (len < 0.001) { dirX = d1.x; dirY = d1.y; }
      else { dirX = sumX / len; dirY = sumY / len; }
    }
    path.push({ x: pts[i].x, y: pts[i].y, dirX, dirY, globalT: i / (n - 1) });
  }
  return path;
}

// Тело стрелки (в метрах) по узлам и стилю.
function buildArrowPolygon(points, style) {
  const n = points.length;
  if (n < 2) return null;

  const st = style || {};
  const baseW = fin(st.baseWidth, 600);
  const headBaseW = fin(st.headBaseWidth, baseW / 2);
  const headLen = fin(st.headLength, baseW * 1.5);
  const shape = clamp(fin(st.headShape, 0), 0, 1);
  const earsEnabled = st.earsEnabled !== false;
  const earSpread = fin(st.earSpread, baseW * 2);
  const earForward = fin(st.earForward, 0);
  const stemMode = st.stemMode === 'smooth' ? 'smooth' : 'sharp';
  const smoothAmount = clamp(fin(st.smoothAmount, 0.6), 0, 1);

  if (!(baseW > 0)) return null;

  if (stemMode === 'smooth') {
    recalcAutoHandles(points, 0.6 + 0.4 * smoothAmount);
  }

  const path = buildPath(points, stemMode);
  if (path.length < 2) return null;

  const widthAt = (t) => baseW + (headBaseW - baseW) * t;
  const leftPts = [], rightPts = [];
  for (let i = 0; i < path.length; i++) {
    const pt = path[i];
    const halfW = widthAt(pt.globalT) / 2;
    const perpX = -pt.dirY, perpY = pt.dirX;
    leftPts.push({ x: pt.x + perpX * halfW, y: pt.y + perpY * halfW });
    rightPts.push({ x: pt.x - perpX * halfW, y: pt.y - perpY * halfW });
  }

  const lastPt = path[path.length - 1];
  const neckPoint = { x: lastPt.x, y: lastPt.y };
  const neckDir = { x: lastPt.dirX, y: lastPt.dirY };
  const neckPerpX = -neckDir.y, neckPerpY = neckDir.x;
  const halfNeck = headBaseW / 2;

  const tipPoint = {
    x: neckPoint.x + neckDir.x * headLen,
    y: neckPoint.y + neckDir.y * headLen
  };
  const midPoint = {
    x: neckPoint.x + neckDir.x * headLen * 0.5,
    y: neckPoint.y + neckDir.y * headLen * 0.5
  };
  const shoulderExtra = headBaseW * 0.6 * shape;
  const leftShoulder = {
    x: midPoint.x + neckPerpX * (halfNeck + shoulderExtra),
    y: midPoint.y + neckPerpY * (halfNeck + shoulderExtra)
  };
  const rightShoulder = {
    x: midPoint.x - neckPerpX * (halfNeck + shoulderExtra),
    y: midPoint.y - neckPerpY * (halfNeck + shoulderExtra)
  };

  const earBase = {
    x: neckPoint.x + neckDir.x * earForward,
    y: neckPoint.y + neckDir.y * earForward
  };
  const leftEar = {
    x: earBase.x + neckPerpX * earSpread,
    y: earBase.y + neckPerpY * earSpread
  };
  const rightEar = {
    x: earBase.x - neckPerpX * earSpread,
    y: earBase.y - neckPerpY * earSpread
  };

  const poly = [];
  for (let i = 0; i < leftPts.length; i++) poly.push(leftPts[i]);
  if (earsEnabled) poly.push(leftEar);
  if (shape > 0.01) poly.push(leftShoulder);
  poly.push(tipPoint);
  if (shape > 0.01) poly.push(rightShoulder);
  if (earsEnabled) poly.push(rightEar);
  for (let i = rightPts.length - 1; i >= 0; i--) poly.push(rightPts[i]);

  return poly;
}

// Узлы во внутреннем представлении (метры) с учётом сохранённых ручек.
function nodesFromGeometry(coords, meta) {
  const m = Array.isArray(meta) ? meta : [];
  return coords.map((c, i) => {
    const [x, y] = project(c);
    const nd = makeNode(x, y);
    const mm = m[i];
    if (mm && mm.auto === false) {
      nd.auto = false;
      if (Array.isArray(mm.i)) { nd.hInX = x + fin(mm.i[0], 0); nd.hInY = y + fin(mm.i[1], 0); }
      if (Array.isArray(mm.o)) { nd.hOutX = x + fin(mm.o[0], 0); nd.hOutY = y + fin(mm.o[1], 0); }
    }
    return nd;
  });
}

function tensionOf(style) {
  return 0.6 + 0.4 * clamp(fin(style && style.smoothAmount, 0.6), 0, 1);
}

// Полигон стрелки из географических координат узлов.
// coords: [[lng,lat], ...] (>= 2), style: размеры в метрах, meta: ручки по узлам.
export function arrowPolygonLngLat(coords, style, meta) {
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const pts = nodesFromGeometry(coords, meta);
  const poly = buildArrowPolygon(pts, style);
  if (!poly || poly.length < 3) return null;
  const ring = poly.map((p) => unproject([p.x, p.y]));
  ring.push(ring[0]);
  return { type: 'Polygon', coordinates: [ring] };
}

// Вспомогательные данные для редактирования: узлы, скелет и ручки (в lng/lat).
export function arrowOutline(coords, style, meta) {
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const pts = nodesFromGeometry(coords, meta);
  const stemMode = style && style.stemMode === 'smooth' ? 'smooth' : 'sharp';
  if (stemMode === 'smooth') recalcAutoHandles(pts, tensionOf(style));
  const path = buildPath(pts, stemMode);
  return {
    nodes: coords,
    smooth: stemMode === 'smooth',
    skeleton: path.map((p) => unproject([p.x, p.y])),
    handles: pts.map((p) => ({
      auto: p.auto,
      in: unproject([p.hInX, p.hInY]),
      out: unproject([p.hOutX, p.hOutY])
    }))
  };
}

// Ближайший сегмент центральной линии (для вставки узла двойным кликом).
// Возвращает { segIndex, point:[lng,lat] } или null, если дальше tolerance (метры).
export function arrowNearestSegment(coords, style, meta, lngLat, tolerance = 0) {
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const pts = nodesFromGeometry(coords, meta);
  const stemMode = style && style.stemMode === 'smooth' ? 'smooth' : 'sharp';
  if (stemMode === 'smooth') recalcAutoHandles(pts, tensionOf(style));
  const target = project(lngLat);
  const n = pts.length;
  const SAMPLES = 40;
  let best = null;
  let bestDist = tolerance;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i], p3 = pts[i + 1];
    for (let s = 0; s <= SAMPLES; s++) {
      const t = s / SAMPLES;
      let px, py;
      if (stemMode === 'smooth') {
        const b = bezier(p0, { x: p0.hOutX, y: p0.hOutY }, { x: p3.hInX, y: p3.hInY }, p3, t);
        px = b.x; py = b.y;
      } else {
        px = p0.x + (p3.x - p0.x) * t;
        py = p0.y + (p3.y - p0.y) * t;
      }
      const d = Math.hypot(target[0] - px, target[1] - py);
      if (d <= bestDist) {
        bestDist = d;
        best = { segIndex: i, point: unproject([px, py]) };
      }
    }
  }
  return best;
}
