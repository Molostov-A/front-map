// Юнит-тесты описаний базовых карт. Запуск: node scripts/basemap.test.mjs
import { BASEMAPS, DEFAULT_BASEMAP_ID, basemapById } from '../basemaps.mjs';

let passed = 0, failed = 0;
const ok = (cond, name) => {
  if (cond) { passed++; console.log(`  ok  ${name}`); }
  else { failed++; console.log(`  FAIL ${name}`); }
};

console.log('структура списка');
{
  ok(Array.isArray(BASEMAPS) && BASEMAPS.length >= 8, `карт в списке: ${BASEMAPS.length}`);
  const ids = BASEMAPS.map((b) => b.id);
  ok(new Set(ids).size === ids.length, 'идентификаторы уникальны');
  ok(BASEMAPS.every((b) => b.id && b.group && b.label), 'у каждой карты есть id/group/label');
  ok(basemapById(DEFAULT_BASEMAP_ID) != null, `карта по умолчанию существует: ${DEFAULT_BASEMAP_ID}`);
  ok(basemapById('nope') === undefined, 'неизвестный id → undefined');
}

console.log('провайдеры');
{
  const groups = new Set(BASEMAPS.map((b) => b.group));
  ok(groups.has('Google'), 'есть группа Google');
  ok(groups.has('Яндекс'), 'есть группа Яндекс');
  const need = ['Схема', 'Спутник', 'Гибрид'];
  for (const g of ['Google', 'Яндекс']) {
    const labels = BASEMAPS.filter((b) => b.group === g).map((b) => b.label);
    ok(need.every((n) => labels.includes(n)), `${g}: есть ${need.join('/')}`);
  }
}

console.log('raster-стили');
{
  const rasters = BASEMAPS.filter((b) => b.style);
  ok(rasters.length >= 8, `raster-карт: ${rasters.length}`);
  for (const b of rasters) {
    const s = b.style;
    const src = s.sources && s.sources.basemap;
    const tileOk = src && Array.isArray(src.tiles) && src.tiles.length >= 1 &&
      src.tiles.every((t) => t.includes('{x}') && t.includes('{y}') && t.includes('{z}'));
    ok(tileOk, `${b.id}: tiles содержат {x}{y}{z}`);
    ok(src && typeof src.attribution === 'string' && src.attribution.length > 0, `${b.id}: есть attribution`);
    ok(s.version === 8 && typeof s.glyphs === 'string', `${b.id}: version 8 + glyphs`);
    ok(s.layers.some((l) => l.type === 'raster' && l.source === 'basemap'), `${b.id}: слой raster`);
    ok(s.layers.some((l) => l.type === 'background'), `${b.id}: фоновый слой`);
  }
}

console.log('карта по умолчанию');
{
  const d = basemapById(DEFAULT_BASEMAP_ID);
  ok(d != null, `карта по умолчанию существует: ${DEFAULT_BASEMAP_ID}`);
  ok(!!d.style && d.kind !== 'liberty', 'карта по умолчанию — растровая (без внешнего стиля)');

  const v = basemapById('liberty');
  ok(v && v.kind === 'liberty' && !v.style, 'векторная схема liberty остаётся доступной');
}

console.log(`\n${passed} ok, ${failed} fail`);
process.exit(failed === 0 ? 0 : 1);
