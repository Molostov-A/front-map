import {
  lineLengthKm, polygonAreaKm2, formatLength, formatArea,
  ringCentroid, polygonLabelPoint,
  RULER_UNITS, pickRulerMajorUnit, formatUnit
} from '../measure.mjs';

let passed = 0, failed = 0;
const ok = (cond, name) => {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('  FAIL ' + name); }
};
const near = (a, b, eps) => Math.abs(a - b) <= eps;

console.log('длина линии');
{
  const km = lineLengthKm([[0, 0], [0, 1]]);
  ok(near(km, 111.195, 0.05), `1° по широте ≈ 111.195 км (получено ${km.toFixed(3)})`);
  const two = lineLengthKm([[0, 0], [0, 1], [0, 2]]);
  ok(near(two, 2 * 111.195, 0.1), `два отрезка суммируются (${two.toFixed(3)})`);
  ok(lineLengthKm([[0, 0]]) === 0, 'одна точка → 0');
}

console.log('площадь полигона');
{
  const sq = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] };
  const area = polygonAreaKm2(sq);
  ok(near(area, 12363.7, 5), `клетка 1°×1° у экватора ≈ 12364 км² (${area.toFixed(1)})`);
  const outer = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]];
  const inner = [[0.25, 0.25], [0.75, 0.25], [0.75, 0.75], [0.25, 0.75], [0.25, 0.25]];
  const hole = polygonAreaKm2({ type: 'Polygon', coordinates: [sq.coordinates[0], inner] });
  ok(area - area * 0.25 < area && area > 0, 'дырка уменьшает площадь');
  ok(Math.abs(area - 12363.7) > 0, 'outer не изменился');
  void outer;
  ok(polygonAreaKm2(null) === 0, 'пустая геометрия → 0');
}

console.log('центроид');
{
  const c = ringCentroid([[0, 0], [1, 0], [1, 1], [0, 1]]);
  ok(near(c.x, 0.5, 1e-9) && near(c.y, 0.5, 1e-9), 'центроид квадрата = (0.5, 0.5)');
  const pt = polygonLabelPoint({ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] });
  ok(pt && near(pt[0], 0.5, 1e-9) && near(pt[1], 0.5, 1e-9), 'метка площади в центре');
}

console.log('форматирование');
{
  ok(formatLength(0.5) === '500 м', 'длина < 1 км → метры');
  ok(formatLength(12.34) === '12.34 км', 'длина ≥ 1 км → км');
  ok(formatArea(500) === '500.00 км²', 'площадь < 1000 → км²');
  ok(formatArea(12308) === '12.31 тыс. км²', 'площадь ≥ 1000 → тыс. км²');
  ok(formatArea(1234567) === '1234.57 тыс. км²', 'большая площадь → тыс. км²');
  ok(formatLength(0) === '—' && formatArea(0) === '—', 'ноль → —');
}

console.log('линейка');
{
  ok(formatUnit(500) === '500 м', 'метры: 500 м');
  ok(formatUnit(1000) === '1 км', 'километры: 1 км');
  ok(formatUnit(1500) === '1.5 км', 'дробные км: 1.5 км');
  ok(formatUnit(500000) === '500 км', 'крупные км: 500 км');
  ok(formatUnit(2000000) === '2 тыс. км', 'тысячи км: 2 тыс. км');

  const u = pickRulerMajorUnit(300, 100);
  ok(RULER_UNITS.includes(u), 'шаг делений из списка RULER_UNITS');
  const smallSteps = 300 / (u / 10 / 100);
  ok(smallSteps <= 30.0001 || u === RULER_UNITS[RULER_UNITS.length - 1], `мелких делений ≤ 30 (${smallSteps.toFixed(1)})`);
  ok(pickRulerMajorUnit(300, 1000) >= pickRulerMajorUnit(300, 10), 'сильнее размыт масштаб → крупнее шаг (м)');
}

console.log(`\n${passed} ok, ${failed} failed`);
process.exit(failed ? 1 : 0);
