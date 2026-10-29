// Слои объектов MapLibre (fmL-*): источник и набор слоёв на каждый слой карты; fmLIds для hit-test.
import { map, state } from '../core/store.js';
import { addOverlayLayers, bringOverlaysToFront, emptyFC, OVERLAY_DRAFT_FILL } from './overlays.js';
import { refreshSources } from './render.js';

export const DASH_NAMES = ['solid', 'dotted', 'dashed', 'dashdot'];

export const DASH_ARRAYS = { solid: [1, 0], dotted: [1, 2], dashed: [5, 3], dashdot: [6, 2, 1, 2] };

export function rebuildStyle() {
  const ids = map.getStyle().layers.map((l) => l.id).filter((id) => id.startsWith('fmL-'));
  for (const id of ids) map.removeLayer(id);
  const srcs = Object.keys(map.getStyle().sources).filter((k) => k.startsWith('fmS-'));
  for (const k of srcs) map.removeSource(k);

  // снизу вверх: сервер отдаёт z_order DESC, реверсируем
  [...state.layers].reverse().forEach((L) => {
    map.addSource(`fmS-${L.id}`, { type: 'geojson', data: emptyFC() });
    const common = { source: `fmS-${L.id}`, beforeId: OVERLAY_DRAFT_FILL };
    const color = L.color || '#e63946';
    const arrowColor = ['coalesce', ['get', 'color'], color];
    const arrowOpacity = ['coalesce', ['get', 'opacity'], 0.6];
    const arrowGlowColor = ['coalesce', ['get', 'glowColor'], arrowColor];
    const arrowStrokeColor = ['coalesce', ['get', 'strokeColor'], '#ffffff'];
    const arrowStrokeWidth = ['coalesce', ['get', 'strokeWidth'], 2];
    const arrowStrokeOpacity = ['coalesce', ['get', 'strokeOpacity'], 1];

    map.addLayer({ id: `fmL-fill-${L.id}`, type: 'fill', ...common,
      filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['!=', ['get', 'hatch'], true]],
      paint: {
        'fill-color': ['coalesce', ['get', 'color'], color],
        'fill-opacity': ['coalesce', ['get', 'opacity'], 0.25],
        'fill-outline-color': 'rgba(0,0,0,0)'
      } });

    map.addLayer({ id: `fmL-hatch-${L.id}`, type: 'fill', ...common,
      filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['==', ['get', 'hatch'], true]],
      paint: {
        'fill-pattern': ['coalesce', ['get', 'hatchImg'], 'fm-blank'],
        'fill-opacity': ['coalesce', ['get', 'opacity'], 0.25]
      } });

    map.addLayer({ id: `fmL-arrow-glow-${L.id}`, type: 'fill', ...common,
      filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['==', ['get', 'type'], 'arrow'], ['==', ['get', 'glowEnabled'], true]],
      paint: {
        'fill-color': arrowGlowColor,
        'fill-opacity': ['*', arrowOpacity, 0.3]
      } });

    map.addLayer({ id: `fmL-arrow-stroke-${L.id}`, type: 'line', ...common,
      filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['==', ['get', 'type'], 'arrow'], ['==', ['get', 'strokeEnabled'], true]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': arrowStrokeColor,
        'line-width': arrowStrokeWidth,
        'line-opacity': arrowStrokeOpacity,
        'line-dasharray': ['case', ['==', ['get', 'strokeDashed'], true], ['literal', [4, 4]], ['literal', [1, 0]]]
      } });

    // line-dasharray не поддерживает feature-выражения — отдельный слой на каждый тип обводки
    for (const dashName of DASH_NAMES) {
      map.addLayer({ id: `fmL-outline-${L.id}-${dashName}`, type: 'line', ...common,
        filter: ['all',
          ['==', ['geometry-type'], 'Polygon'],
          ['==', ['get', 'type'], 'polygon'],
          ['==', ['coalesce', ['get', 'outlineDash'], 'solid'], dashName]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['coalesce', ['get', 'outlineColor'], ['coalesce', ['get', 'color'], color]],
          'line-width': ['coalesce', ['get', 'outlineWidth'], 2],
          'line-dasharray': DASH_ARRAYS[dashName]
        } });
    }

    for (const dashName of DASH_NAMES) {
      map.addLayer({ id: `fmL-line-${L.id}-${dashName}`, type: 'line', ...common,
        filter: ['all',
          ['==', ['geometry-type'], 'LineString'],
          ['==', ['get', 'type'], 'line'],
          ['==', ['coalesce', ['get', 'dash'], 'solid'], dashName]],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['coalesce', ['get', 'color'], color],
          'line-width': ['coalesce', ['get', 'width'], 3],
          'line-opacity': ['coalesce', ['get', 'opacity'], 1],
          'line-dasharray': DASH_ARRAYS[dashName]
        } });
    }

    // линейка: тело рисует MapLibre, деления и подписи — на оверлей-канве (drawRulers)
    map.addLayer({ id: `fmL-ruler-${L.id}`, type: 'line', ...common,
      filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'type'], 'ruler']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['coalesce', ['get', 'color'], '#e0b050'],
        'line-width': ['coalesce', ['get', 'width'], 3],
        'line-opacity': ['coalesce', ['get', 'opacity'], 1]
      } });

    // невидимая широкая линия — только для попадания клика/курсора
    map.addLayer({ id: `fmL-rulerhit-${L.id}`, type: 'line', ...common,
      filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'type'], 'ruler']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': 'rgba(0,0,0,0)', 'line-width': 16 } });

    map.addLayer({ id: `fmL-circle-${L.id}`, type: 'circle', ...common,
      filter: ['all', ['==', ['geometry-type'], 'Point'], ['!=', ['get', 'type'], 'label']],
      paint: {
        'circle-color': ['coalesce', ['get', 'color'], color],
        'circle-radius': ['coalesce', ['get', 'size'], 7],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5
      } });
  });

  addOverlayLayers();
  bringOverlaysToFront();
  refreshSources();
}

export function fmLIds() {
  return map.getStyle().layers.map((l) => l.id).filter((id) => id.startsWith('fmL-'));
}
