import { project, unproject, arrowPolygonLngLat, arrowOutline, arrowNearestSegment } from '../arrow.mjs';

let passed = 0, failed = 0;
const ok = (cond, name) => {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('  FAIL ' + name); }
};

// метры -> lng/lat
const M = (x, y) => unproject([x, y]);

function pointInRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const hit = ((yi > pt[1]) !== (yj > pt[1])) &&
      (pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi);
    if (hit) inside = !inside;
  }
  return inside;
}

// стрелка вверх по оси Y: узлы (0,0) -> (0,1000) -> (0,2000)
const coords = [M(0, 0), M(0, 1000), M(0, 2000)];
const style = {
  baseWidth: 200, headBaseWidth: 100, headLength: 400, headShape: 0,
  earsEnabled: true, earSpread: 300, earForward: 0,
  stemMode: 'sharp', smoothAmount: 0.6
};

console.log('project/unproject');
{
  const c = [34.5, 48.7];
  const back = unproject(project(c));
  ok(Math.abs(back[0] - c[0]) < 1e-9 && Math.abs(back[1] - c[1]) < 1e-9, 'roundtrip lng/lat');
}

console.log('полигон стрелки');
const poly = arrowPolygonLngLat(coords, style, null);
{
  ok(poly && poly.type === 'Polygon', 'возвращается Polygon');
  const ring = poly.coordinates[0].map((c) => project(c));
  ok(ring.length >= 8, `кольцо из ${ring.length} вершин`);
  const first = poly.coordinates[0][0], last = poly.coordinates[0][poly.coordinates[0].length - 1];
  ok(first[0] === last[0] && first[1] === last[1], 'кольцо замкнуто');

  const maxY = Math.max(...ring.map((p) => p[1]));
  ok(Math.abs(maxY - 2400) < 1, `остриё на 2400 м (получено ${maxY.toFixed(1)})`);

  ok(pointInRing(project(M(0, 1000)), ring), 'центр ствола внутри');
  ok(pointInRing(project(M(0, 2200)), ring), 'точка внутри наконечника');
  ok(!pointInRing(project(M(0, 2500)), ring), 'точка за остриём снаружи');

  // тапер: у основания шире, у горлышка уже
  ok(pointInRing(project(M(60, 0)), ring), 'у основания ширина >= 120 м');
  ok(!pointInRing(project(M(130, 0)), ring), 'у основания нет ширины 260 м');
  ok(!pointInRing(project(M(90, 1000)), ring), 'в середине ствол уже 180 м');
  ok(pointInRing(project(M(60, 1000)), ring), 'у середины ствола ширина >= 120 м');
}

console.log('ушки');
{
  const noEars = arrowPolygonLngLat(coords, { ...style, earsEnabled: false }, null);
  const r1 = poly.coordinates[0].length;
  const r2 = noEars.coordinates[0].length;
  ok(r2 < r1, `без ушек вершин меньше (${r2} < ${r1})`);
  const ring = poly.coordinates[0].map((c) => project(c));
  ok(pointInRing(project(M(-250, 2000)), ring), 'левое ухо внутри при разлёте 300');
  ok(!pointInRing(project(M(-350, 2000)), ring), 'за ухом (400 м) снаружи');
}

console.log('форма наконечника');
{
  const shaped = arrowPolygonLngLat(coords, { ...style, headShape: 0.8 }, null);
  const hasExtra = shaped.coordinates[0].length > poly.coordinates[0].length;
  ok(hasExtra, 'shape>0 добавляет плечи (больше вершин)');
}

console.log('сглаживание');
{
  const smooth = arrowPolygonLngLat(coords, { ...style, stemMode: 'smooth' }, null);
  ok(smooth && smooth.coordinates[0].length > poly.coordinates[0].length, 'сглаженный ствол содержит больше вершин');

  const out = arrowOutline(coords, { ...style, stemMode: 'smooth' }, null);
  ok(out.smooth === true && out.handles.length === 3, 'outline: 3 узла и ручки');
  ok(out.skeleton.length > 3, `скелет из ${out.skeleton.length} точек`);
}

console.log('ручки (meta)');
{
  const meta = [{ auto: true }, { auto: false, i: [0, -200], o: [0, 200] }, { auto: true }];
  const out = arrowOutline(coords, { ...style, stemMode: 'smooth' }, meta);
  ok(out.handles[1].auto === false, 'ручной узел сохраняет auto=false');
  const hp = project(out.handles[1].out);
  ok(Math.abs(hp[0] - 0) < 1 && Math.abs(hp[1] - 1200) < 1, `hOut смещён на +200 м (y=${hp[1].toFixed(1)})`);
  const hi = project(out.handles[1].in);
  ok(Math.abs(hi[1] - 800) < 1, `hIn смещён на -200 м (y=${hi[1].toFixed(1)})`);
}

console.log('ближайший сегмент');
{
  const seg = arrowNearestSegment(coords, style, null, M(0, 500), 50);
  ok(seg && seg.segIndex === 0, 'середина первого сегмента → segIndex 0');
  const seg2 = arrowNearestSegment(coords, style, null, M(0, 1500), 50);
  ok(seg2 && seg2.segIndex === 1, 'середина второго сегмента → segIndex 1');
  const far = arrowNearestSegment(coords, style, null, M(5000, 5000), 50);
  ok(far === null, 'далёкая точка → null');
}

console.log('ошибки входа');
{
  ok(arrowPolygonLngLat([M(0, 0)], style, null) === null, 'одна точка → null');
  ok(arrowPolygonLngLat([], style, null) === null, 'пустой массив → null');
  ok(arrowPolygonLngLat(coords, { ...style, baseWidth: 0 }, null) === null, 'нулевая ширина → null');
}

console.log(`\n${passed} ok, ${failed} fail`);
process.exit(failed === 0 ? 0 : 1);
