// Два клика: взять визуальный образец, затем применять его без изменения геометрии.
import { sampleAppearance, transferAppearance } from '../../style-transfer.mjs';
import { getToken } from '../core/api.js';
import { canEdit } from '../core/session.js';
import { map, state } from '../core/store.js';
import { toast } from '../core/util.js';
import { setMoveMode } from '../edit/move-mode.js';
import { select } from '../edit/selection.js';
import { saveFeature } from '../edit/sync.js';
import { fmLIds } from '../map/style-layers.js';
import { updateHint } from '../ui/hint.js';

let sample = null, sourceId = null, token = null;
const names = { polygon: 'полигона', arrow: 'стрелки', line: 'линии', ruler: 'линейки', point: 'точки', label: 'надписи' };
const hit = (point) => {
  const layers = fmLIds();
  return layers.length ? map.queryRenderedFeatures(point, { layers })[0] : null;
};

export function pickAppearance(id, shift = false) {
  if (!canEdit()) return;
  const feature = state.features.find((f) => f.id === id);
  if (!feature) return;
  if (token !== getToken()) sample = null;
  if (!sample || shift) {
    sample = sampleAppearance(feature); sourceId = id; token = getToken();
    select(id); updateHint(); return;
  }
  if (id === sourceId) { toast('Выберите другой объект или Shift+клик для нового образца'); return; }
  feature.properties = transferAppearance(sample, feature);
  saveFeature(feature, { properties: feature.properties });
  select(id); updateHint();
}

export const eyedropperTool = {
  hint: () => sample && token === getToken()
    ? `Пипетка: оформление ${names[sample.type]} #${sourceId} · клик — применить · Shift+клик — другой образец · Esc — выход`
    : 'Пипетка: кликните источник оформления · геометрия и текст получателя сохранятся · Esc — выход',
  onEnter() { sample = null; sourceId = null; token = null; state.draft = null; setMoveMode(false); select(null); },
  onLeave() { sample = null; sourceId = null; token = null; },
  onClick(e) {
    const feature = hit(e.point);
    if (feature) pickAppearance(Number(feature.properties.id), !!e.originalEvent?.shiftKey);
    else toast(sample ? 'Кликните объект-получатель' : 'Кликните объект-источник');
  },
  onHover(e) { map.getCanvas().style.cursor = hit(e.point) ? 'copy' : 'crosshair'; }
};
