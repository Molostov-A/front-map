// Линейка на оверлей-канве: деления, подписи, итоговая длина, площадь ломаной.
// Механика портирована из examples/polygon-and-ruler-example.html.
import { formatArea, formatLength, formatUnit, lineLengthKm, pickRulerMajorUnit, polygonAreaKm2, ringCentroid } from '../../measure.mjs';
import { normalizeStyle } from '../../shared/feature-schema.mjs';
import { map, state } from '../core/store.js';
import { metersPerPixel } from './overlays.js';

export let rulerCanvas = null;

export let rulerCtx = null;

export let rulerDpr = 1;

export const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));

export function initRulerCanvas() {
  rulerCanvas = document.getElementById('ruler-layer');
  if (!rulerCanvas) return;
  rulerCtx = rulerCanvas.getContext('2d');
  resizeRulerCanvas();
}

export function resizeRulerCanvas() {
  if (!rulerCanvas || !map) return;
  const el = map.getContainer();
  const w = Math.max(1, el.clientWidth || 1);
  const h = Math.max(1, el.clientHeight || 1);
  rulerDpr = window.devicePixelRatio || 1;
  rulerCanvas.width = Math.round(w * rulerDpr);
  rulerCanvas.height = Math.round(h * rulerDpr);
  rulerCanvas.style.width = w + 'px';
  rulerCanvas.style.height = h + 'px';
  drawRulers();
}

export function drawRulers() {
  if (!rulerCtx || !map) return;
  const w = rulerCanvas.width / rulerDpr;
  const h = rulerCanvas.height / rulerDpr;
  rulerCtx.setTransform(rulerDpr, 0, 0, rulerDpr, 0, 0);
  rulerCtx.clearRect(0, 0, w, h);

  const ordered = [...state.features].sort((a, b) => state.layers.findIndex((l) => l.id === b.layer_id)
    - state.layers.findIndex((l) => l.id === a.layer_id));
  for (const f of ordered) {
    if (f.type !== 'ruler' || !f.geometry || f.geometry.type !== 'LineString') continue;
    const coords = f.geometry.coordinates;
    if (coords.length < 2) continue;
    const layer = state.layers.find((l) => l.id === f.layer_id);
    if (layer && !layer.visible) continue;
    drawRulerPath(rulerCtx, coords, f.properties, { drawBody: false, preview: false, layerOpacity: layer?.opacity ?? 1 });
  }

  const d = state.draft;
  if (d && d.type === 'ruler' && d.coords && d.coords.length >= 1) {
    const pts = d.coords.slice();
    if (d.cursor) pts.push(d.cursor);
    drawRulerPath(rulerCtx, pts, state.rulerStyle, { drawBody: true, preview: true });
  }
}

// Ломаная линейка: тело (если черновик), деления/подписи по сегментам с накоплением
// метража, заливка полигона и подпись площади для ≥3 точек, итоговая длина.
export function drawRulerPath(ctx, ptsLL, props, opts) {
  const o = opts || {};
  if (!ptsLL || ptsLL.length < 2) return;
  const p = normalizeStyle('ruler', props);

  const layerOpacity = o.layerOpacity ?? 1;
  ctx.save(); ctx.globalAlpha = layerOpacity;
  const multi = ptsLL.length >= 3;
  if (multi) drawRulerPolygon(ctx, ptsLL, p, layerOpacity);

  if (o.drawBody) {
    const first = map.project(ptsLL[0]);
    ctx.save();
    ctx.globalAlpha = clamp01(p.opacity) * layerOpacity;
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < ptsLL.length; i++) { const q = map.project(ptsLL[i]); ctx.lineTo(q.x, q.y); }
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = p.color;
    ctx.lineWidth = p.width;
    ctx.setLineDash(o.preview ? [8, 6] : []);
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.restore();
  }

  let acc = 0;
  for (let i = 0; i < ptsLL.length - 1; i++) {
    const a = ptsLL[i], b = ptsLL[i + 1];
    const isLast = i === ptsLL.length - 2;
    drawRulerOverlay(ctx, a, b, p, {
      drawBody: false,
      preview: o.preview,
      layerOpacity,
      startMeters: acc,
      drawTotal: !multi && isLast
    });
    acc += lineLengthKm([a, b]) * 1000;
  }

  if (multi && p.showLabels) {
    const totalMeters = lineLengthKm(ptsLL) * 1000;
    const mid = pathMidpoint(ptsLL);
    const midS = map.project(mid);
    drawRotatedText(ctx, formatLength(totalMeters / 1000), midS.x, midS.y, 0, p.labelColor || p.color, p.fontSize + 2);
    const area = polygonAreaKm2({ type: 'Polygon', coordinates: [ptsLL] });
    if (area > 0) {
      const c = ringCentroid(ptsLL);
      const cp = map.project([c.x, c.y]);
      drawRotatedText(ctx, formatArea(area), cp.x, cp.y, 0, p.labelColor || p.color, p.fontSize + 1);
    }
  }
  ctx.restore();
}

export function pathMidpoint(ptsLL) {
  let total = 0;
  const segs = [];
  for (let i = 0; i < ptsLL.length - 1; i++) {
    const m = lineLengthKm([ptsLL[i], ptsLL[i + 1]]);
    segs.push(m);
    total += m;
  }
  let acc = 0;
  const target = total / 2;
  for (let i = 0; i < segs.length; i++) {
    if (acc + segs[i] >= target) {
      const t = segs[i] > 0 ? (target - acc) / segs[i] : 0;
      const a = ptsLL[i], b = ptsLL[i + 1];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    acc += segs[i];
  }
  return ptsLL[Math.floor(ptsLL.length / 2)];
}

export function hexToRgba(hex, a) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return `rgba(224,176,80,${a})`;
  let s = m[1];
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  const n = parseInt(s, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function drawRulerPolygon(ctx, ptsLL, p, layerOpacity = 1) {
  if (ptsLL.length < 3) return;
  ctx.save();
  ctx.globalAlpha = clamp01(p.opacity) * layerOpacity;
  const first = map.project(ptsLL[0]);
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < ptsLL.length; i++) { const q = map.project(ptsLL[i]); ctx.lineTo(q.x, q.y); }
  ctx.closePath();
  ctx.fillStyle = hexToRgba(p.color, 0.16);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(p.color, 0.55);
  ctx.lineWidth = 1.25;
  ctx.setLineDash([6, 5]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

export function drawRotatedText(ctx, text, x, y, angle, color, fontSize, weight) {
  let ta = angle;
  if (ta > Math.PI / 2) ta -= Math.PI;
  if (ta < -Math.PI / 2) ta += Math.PI;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ta);
  ctx.font = `${weight || 'bold'} ${fontSize}px "Segoe UI", Roboto, system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.shadowColor = 'rgba(0,0,0,0.75)';
  ctx.shadowBlur = 5;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// Механика отрисовки линейки портирована из examples/polygon-and-ruler-example.html.
export function drawRulerOverlay(ctx, startLL, endLL, props, opts) {
  const p = normalizeStyle('ruler', props);

  const o = opts || {};
  const sS = map.project(startLL);
  const eS = map.project(endLL);
  const dxS = eS.x - sS.x, dyS = eS.y - sS.y;
  const lenS = Math.hypot(dxS, dyS);
  if (lenS < 1) return;

  const angle = Math.atan2(dyS, dxS);
  const lat = (startLL[1] + endLL[1]) / 2;
  const mpp = metersPerPixel(lat) || 1;
  const totalMeters = lenS * mpp;
  const baseAlpha = clamp01(p.opacity) * (o.layerOpacity ?? 1);

  const nx = dxS / lenS, ny = dyS / lenS;
  const perpX = -ny, perpY = nx;
  const color = p.color;

  ctx.save();
  ctx.globalAlpha = baseAlpha;

  // тело рисуем только для черновика (у сохранённых — слой MapLibre)
  if (o.drawBody) {
    ctx.beginPath();
    ctx.moveTo(sS.x, sS.y);
    ctx.lineTo(eS.x, eS.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = p.width;
    ctx.setLineDash(o.preview ? [8, 6] : []);
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
  }

  const majorMeters = pickRulerMajorUnit(lenS, mpp);
  const majorPxS = majorMeters / mpp;
  const mediumPxS = majorPxS / 2;
  const smallPxS = majorPxS / 10;

  let baseTick;
  if (lenS < 60) baseTick = 5;
  else if (lenS < 120) baseTick = 7;
  else if (lenS < 250) baseTick = 9;
  else if (lenS < 450) baseTick = 11;
  else baseTick = 13;

  const majorTick = Math.max(4, Math.min(baseTick, majorPxS / 3));
  const mediumTick = Math.max(3.5, majorTick * 0.7);
  const smallTick = Math.max(3, majorTick * 0.55);

  if (p.showTicks) {
    const drawSmall = smallPxS >= 2;
    const drawMedium = mediumPxS >= 3;
    const numSteps = Math.min(6000, Math.floor(lenS / smallPxS));
    for (let i = 0; i <= numSteps; i++) {
      const dS = i * smallPxS;
      if (dS > lenS + 0.01) break;
      const px = sS.x + nx * dS;
      const py = sS.y + ny * dS;
      const isMajor = (i % 10 === 0);
      const isMedium = (i % 5 === 0) && !isMajor;
      if (!isMajor && !isMedium && !drawSmall) continue;
      if (isMedium && !drawMedium) continue;
      let tl, lw, alpha;
      if (isMajor) { tl = majorTick; lw = 2.2; alpha = 1; }
      else if (isMedium) { tl = mediumTick; lw = 1.6; alpha = 0.85; }
      else { tl = smallTick; lw = 1.1; alpha = 0.65; }
      ctx.globalAlpha = baseAlpha * alpha;
      ctx.beginPath();
      ctx.moveTo(px - perpX * tl, py - perpY * tl);
      ctx.lineTo(px + perpX * tl, py + perpY * tl);
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
    ctx.globalAlpha = baseAlpha;
  }

  if (p.showLabels) {
    const MIN_LABEL_DIST = 48;
    let labelStep = majorPxS < MIN_LABEL_DIST ? 2 : 1;
    if (majorPxS * labelStep >= MIN_LABEL_DIST) {
      const numMajor = Math.floor(lenS / majorPxS);
      for (let i = 0; i <= numMajor; i += labelStep) {
        const dS = i * majorPxS;
        if (dS > lenS + 0.01) break;
        const px = sS.x + nx * dS;
        const py = sS.y + ny * dS;
        const off = majorTick + 9;
        drawRotatedText(ctx, formatUnit((o.startMeters || 0) + i * majorMeters), px - perpX * off, py - perpY * off,
          angle, p.labelColor, p.fontSize);
      }
    }
  }

  // итоговая длина — по центру, с другой стороны от делений
  if (p.showLabels && o.drawTotal !== false) {
    const midX = (sS.x + eS.x) / 2, midY = (sS.y + eS.y) / 2;
    const totalOff = majorTick + 14;
    drawRotatedText(ctx, formatLength(totalMeters / 1000), midX + perpX * totalOff, midY + perpY * totalOff,
      angle, p.labelColor, p.fontSize + 2);
  }

  if (o.preview) {
    ctx.globalAlpha = baseAlpha;
    ctx.beginPath();
    ctx.arc(sS.x, sS.y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = '#0f1a24'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath();
    ctx.arc(eS.x, eS.y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = '#101b24'; ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.stroke();
  }

  ctx.restore();
}
