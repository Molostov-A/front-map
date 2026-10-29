// Единое состояние клиента (state), экземпляр карты (map + setMap), выбранный объект и его стиль.
import { defaultStyle, FEATURE_TYPES } from '../../shared/feature-schema.mjs';

export const state = {
  layers: [],
  features: [],
  activeLayerId: null,
  tool: 'select',
  selectedId: null,
  draft: null,          // {type:'line'|'polygon', coords, cursor} | {type:'arrow', nodes:[...], cursor}
  drag: null,           // {featureId, index, ring, moved} | {featureId, type:'tangent', index, which}
  appendArrow: false,   // режим «дорисовать» для выбранной стрелки
  arrowStyle: defaultStyle('arrow'),
  lineStyle: defaultStyle('line'),
  polygonStyle: defaultStyle('polygon'),
  pointStyle: defaultStyle('point'),
  labelStyle: defaultStyle('label'),
  rulerStyle: defaultStyle('ruler'),
  markers: new Map(),   // id -> { marker, el } для надписей и подписей точек
  areaMarkers: new Map(), // id -> marker для подписей площади полигонов
  moveMode: false,      // режим перемещения выбранного элемента
  move: null,           // активное перетаскивание: { featureId, start, orig, moved }
  ignoreNextClick: false,
  date: null,           // выбранный день YYYY-MM-DD; null = "сейчас"
  dates: null,          // даты выбранного элемента { created_at, deleted_at, changes:[...] }
  calView: null         // отображаемый месяц календаря: Date (1-е число)
};

export let map = null;

export function setMap(m) { map = m; }

export function selectedArrow() {
  const f = state.features.find((x) => x.id === state.selectedId);
  return f && f.type === 'arrow' ? f : null;
}

// Тип объекта → ключ его стиля в state: line → lineStyle и т.д. (типы — из общей схемы).
export const STYLE_KEY = Object.fromEntries(FEATURE_TYPES.map((t) => [t, t + 'Style']));

export function styleStateOf(type) { return state[STYLE_KEY[type]]; }

export function activeSelected(type) {
  const f = state.features.find((x) => x.id === state.selectedId);
  return f && f.type === type ? f : null;
}
