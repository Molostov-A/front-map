import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  SCHEMA, FEATURE_TYPES, FONTS, normalize, normalizeStyle, defaultStyle, normalizeTextStyle
} from '../shared/feature-schema.mjs';

const ok = (cond, name) => assert.ok(cond, name);
const same = (a, b) => JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  return v;
}
const roundtrip = (v) => JSON.parse(JSON.stringify(v));

test('golden: схема = прежний серверный normalizeProps', () => {
  const { cases } = JSON.parse(fs.readFileSync(new URL('./fixtures/props-golden.json', import.meta.url), 'utf8'));
  let mismatches = 0, fontFixes = 0;
  for (const c of cases) {
    const expected = roundtrip(c.expected);
    // Единственное намеренное отличие: шрифт подписи — только из списка FONTS (как было на клиенте),
    // сервер раньше принимал любую непустую строку.
    if (expected.label && typeof expected.label.font === 'string' && !FONTS.includes(expected.label.font)) {
      expected.label.font = 'system';
      fontFixes++;
    }
    const actual = roundtrip(normalize(c.type, c.input === null ? undefined : c.input));
    if (!same(actual, expected)) {
      mismatches++;
      if (mismatches <= 3) console.log('    ', c.type, JSON.stringify(c.input), '\n     exp', JSON.stringify(expected), '\n     got', JSON.stringify(actual));
    }
  }
  ok(cases.length > 300, `набор не пуст (${cases.length})`);
  ok(mismatches === 0, `совпадают все случаи (расхождений: ${mismatches}; поправок шрифта: ${fontFixes})`);
});

test('значения по умолчанию = прежние клиентские *_STYLE_DEFAULTS', () => {
  const OLD = {
    arrow: { color: '#7f8cff', opacity: 0.95, baseWidth: 600, headBaseWidth: 300, headLength: 900, headShape: 0,
      earsEnabled: true, earSpread: 1400, earForward: 0, stemMode: 'sharp', smoothAmount: 0.6,
      glowEnabled: false, glowBlur: 12, glowColor: '#7f8cff', strokeEnabled: true, strokeWidth: 2,
      strokeColor: '#ffffff', strokeOpacity: 1, strokeDashed: false },
    line: { color: '#e63946', opacity: 1, width: 3, dash: 'solid', smooth: false, smoothAmount: 0.6 },
    polygon: { color: '#e63946', opacity: 0.25, fill: 'solid', outlineColor: '#e63946', outlineWidth: 2,
      outlineDash: 'solid', areaColor: '#eaf0ff', areaFontSize: 12, areaBg: true },
    ruler: { color: '#e0b050', width: 3, opacity: 1, fontSize: 12, labelColor: '#eaf0ff', showTicks: true, showLabels: true }
  };
  const TEXT = { color: '#ffffff', size: 13, font: 'system', haloColor: '#0b0d10', haloWidth: 2,
    opacity: 1, bg: false, bgColor: '#1b1e24', italic: false, bold: false, underline: false, strike: false };
  for (const [type, exp] of Object.entries(OLD)) ok(same(defaultStyle(type), exp), 'defaults ' + type);
  ok(same(defaultStyle('point'), { color: '#e63946', size: 7, caption: '', captionMode: 'selected', label: TEXT }), 'defaults point');
  ok(same(defaultStyle('label'), { text: '', label: TEXT }), 'defaults label');
  ok(same(normalizeTextStyle(undefined), TEXT), 'normalizeTextStyle(undefined)');
});

test('стиль vs все свойства', () => {
  const meta = [{ auto: false, i: [1, 2], o: [3, 4] }];
  ok(!('nodeMeta' in normalizeStyle('arrow', { nodeMeta: meta })), 'normalizeStyle не содержит nodeMeta (иначе {...props, ...style} затрёт ручки)');
  ok(same(normalize('line', { nodeMeta: meta }).nodeMeta, meta), 'normalize сохраняет nodeMeta');
  ok(normalize('polygon', { color: '#00ff00' }).outlineColor === '#00ff00', 'обводка полигона по умолчанию = цвет заливки');
  ok(normalize('polygon', { color: '#00ff00', outlineColor: '#0000ff' }).outlineColor === '#0000ff', 'явная обводка сохраняется');
  ok(normalize('ruler', { width: 999 }).width === 40 && normalize('ruler', { width: -1 }).width === 0.5, 'диапазоны ограничиваются');
  ok(normalize('label', { label: { font: 'comic' } }).label.font === 'system', 'неизвестный шрифт → system');
  ok(normalize('line', { junk: 1 }).junk === undefined, 'лишние поля отбрасываются');
  ok(same(FEATURE_TYPES, Object.keys(SCHEMA)) && FEATURE_TYPES.length === 6, 'FEATURE_TYPES из схемы');
  const raw = { a: 1 };
  ok(normalize('unknown', raw) === raw && same(normalizeStyle('unknown', raw), {}), 'неизвестный тип');
});
