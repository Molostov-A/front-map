// Единая схема свойств объектов карты — источник истины для клиента и сервера.
// Канонический файл: frontend/shared/feature-schema.mjs; копия в backend/shared/ обновляется
// скриптом `node tools/sync-shared.mjs` (корень), тест в backend сверяет копии.
//
// Поле описывается нормализатором: (значение, уже нормализованные поля) → значение.
// Новое поле стиля = одна строка в SCHEMA (+ контрол в панели на клиенте).
// Чистый модуль: без DOM и Node API.

/** Цвет/строка: непустая строка, иначе значение по умолчанию (или значение другого поля). */
const str = (def, { fallbackField } = {}) => (v, out) =>
  (typeof v === 'string' && v ? v : (fallbackField ? out[fallbackField] : def));

/** Текст: любая строка (в том числе пустая), иначе def. */
const text = (def = '') => (v) => (typeof v === 'string' ? v : def);

/** Число с ограничением диапазона; нечисло → def. */
const num = (min, max, def) => (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

const bool = (def) => (v) => (typeof v === 'boolean' ? v : def);

/** Значение из списка, иначе def. */
const oneOf = (list, def) => (v) => (list.includes(v) ? v : def);

/** Вложенный объект по своей схеме. */
const nested = (schema) => (v) => normalizeBy(schema, v);

/** Метаданные узлов линии/стрелки (касательные): массив или undefined. Не поле стиля. */
const nodeMeta = () => (v) => (Array.isArray(v)
  ? v.map((m) => ({
    auto: !(m && m.auto === false),
    i: m && Array.isArray(m.i) ? [Number(m.i[0]) || 0, Number(m.i[1]) || 0] : undefined,
    o: Array.isArray(m && m.o) ? [Number(m.o[0]) || 0, Number(m.o[1]) || 0] : undefined
  }))
  : undefined);

export const DASH_STYLES = ['solid', 'dotted', 'dashed', 'dashdot'];
export const FONTS = ['system', 'sans', 'serif', 'mono', 'cursive'];
export const CAPTION_MODES = ['never', 'selected', 'always'];

// Поля, которые не входят в «стиль» панели (хранятся в properties, но редактируются геометрией).
const META_FIELDS = new Set(['nodeMeta']);

/** Стиль текста (надписи и подписи точек). */
const TEXT_STYLE = {
  color: str('#ffffff'),
  size: num(6, 96, 13),
  font: oneOf(FONTS, 'system'),
  haloColor: str('#0b0d10'),
  haloWidth: num(0, 10, 2),
  opacity: num(0, 1, 1),
  bg: bool(false),
  bgColor: str('#1b1e24'),
  italic: bool(false),
  bold: bool(false),
  underline: bool(false),
  strike: bool(false)
};

export const SCHEMA = {
  line: {
    color: str('#e63946'),
    opacity: num(0, 1, 1),
    width: num(0.5, 200, 3),
    dash: oneOf(DASH_STYLES, 'solid'),
    smooth: bool(false),
    smoothAmount: num(0, 1, 0.6),
    nodeMeta: nodeMeta()
  },
  polygon: {
    color: str('#e63946'),
    opacity: num(0, 1, 0.25),
    fill: oneOf(['solid', 'hatched'], 'solid'),
    outlineColor: str(null, { fallbackField: 'color' }),
    outlineWidth: num(0, 100, 2),
    outlineDash: oneOf(DASH_STYLES, 'solid'),
    areaColor: str('#eaf0ff'),
    areaFontSize: num(6, 96, 12),
    areaBg: bool(true)
  },
  point: {
    color: str('#e63946'),
    size: num(2, 60, 7),
    caption: text(''),
    captionMode: oneOf(CAPTION_MODES, 'selected'),
    label: nested(TEXT_STYLE)
  },
  label: {
    text: text(''),
    label: nested(TEXT_STYLE)
  },
  arrow: {
    color: str('#7f8cff'),
    opacity: num(0.1, 1, 0.95),
    baseWidth: num(1, 200000, 600),
    headBaseWidth: num(1, 200000, 300),
    headLength: num(1, 200000, 900),
    headShape: num(0, 1, 0),
    earsEnabled: bool(true),
    earSpread: num(0, 200000, 1400),
    earForward: num(-200000, 200000, 0),
    stemMode: oneOf(['sharp', 'smooth'], 'sharp'),
    smoothAmount: num(0, 1, 0.6),
    glowEnabled: bool(false),
    glowBlur: num(0, 60, 12),
    glowColor: str('#7f8cff'),
    strokeEnabled: bool(true),
    strokeWidth: num(0, 10, 2),
    strokeColor: str('#ffffff'),
    strokeOpacity: num(0, 1, 1),
    strokeDashed: bool(false),
    nodeMeta: nodeMeta()
  },
  ruler: {
    color: str('#e0b050'),
    width: num(0.5, 40, 3),
    opacity: num(0, 1, 1),
    fontSize: num(6, 96, 12),
    labelColor: str('#eaf0ff'),
    showTicks: bool(true),
    showLabels: bool(true)
  }
};

export const FEATURE_TYPES = Object.keys(SCHEMA);

function normalizeBy(schema, src, skip) {
  const p = src && typeof src === 'object' ? src : {};
  const out = {};
  for (const [key, norm] of Object.entries(schema)) {
    if (skip && skip.has(key)) continue;
    out[key] = norm(p[key], out);
  }
  return out;
}

/** Все свойства объекта типа `type` (whitelist + диапазоны). Неизвестный тип — как есть. */
export function normalize(type, props) {
  const schema = SCHEMA[type];
  return schema ? normalizeBy(schema, props) : (props || {});
}

/** Только поля стиля (без nodeMeta) — для панели и стиля «по умолчанию» на клиенте. */
export function normalizeStyle(type, props) {
  const schema = SCHEMA[type];
  return schema ? normalizeBy(schema, props, META_FIELDS) : {};
}

/** Стиль по умолчанию для нового объекта. */
export const defaultStyle = (type) => normalizeStyle(type, {});

/** Стиль текста (вложенный `label` у точки и надписи). */
export const normalizeTextStyle = (src) => normalizeBy(TEXT_STYLE, src);
