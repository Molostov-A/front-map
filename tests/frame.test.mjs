import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFrameScheduler } from '../src/core/frame.js';
import { loadModule } from './module-harness.mjs';

function frames() {
  const callbacks = new Map(); let id = 0;
  return {
    request: (fn) => { callbacks.set(++id, fn); return id; },
    cancel: (n) => callbacks.delete(n), size: () => callbacks.size,
    run: () => { const work = [...callbacks.values()]; callbacks.clear(); work.forEach((fn) => fn()); }
  };
}

test('события одного кадра объединяются, используются последние аргументы', () => {
  const f = frames(), values = [];
  const s = createFrameScheduler((value) => values.push(value), f.request, f.cancel);
  for (let i = 0; i < 100; i++) s.schedule(i);
  assert.equal(f.size(), 1); assert.equal(values.length, 0);
  f.run(); assert.deepEqual(values, [99]);
  s.schedule(100); f.run(); assert.deepEqual(values, [99, 100]);
});

test('отмена удаляет кадр, повторное планирование и планирование внутри кадра работают', () => {
  const f = frames(), values = [];
  const s = createFrameScheduler((value) => { values.push(value); if (value === 2) s.schedule(3); }, f.request, f.cancel);
  s.schedule(1); s.cancel(); s.cancel(); f.run(); assert.deepEqual(values, []);
  s.schedule(2); f.run(); assert.deepEqual(values, [2]);
  assert.equal(f.size(), 1); f.run(); assert.deepEqual(values, [2, 3]);
});

test('перерисовка карты: движение объединяется, немедленная перерисовка отменяет ожидающий кадр', () => {
  const f = frames(); let renders = 0, measures = 0;
  const noop = () => {};
  const mod = loadModule('../src/map/render.js', {
    createFrameScheduler: (render) => createFrameScheduler(render, f.request, f.cancel),
    state: { layers: [], features: [], selectedId: null, draft: null },
    map: { getSource: () => ({ setData: noop }) }, canEdit: () => true,
    ensureOverlayImages: noop, emptyFC: () => ({ type: 'FeatureCollection', features: [] }),
    updateHandleSizes: noop, syncMarkers: () => renders++, syncAreaLabels: noop, drawRulers: noop
  });
  for (let i = 0; i < 20; i++) mod.scheduleRefreshSources(() => measures++);
  assert.equal(f.size(), 1); f.run(); assert.equal(renders, 1); assert.equal(measures, 1);
  mod.scheduleRefreshSources(() => measures++);
  mod.refreshSources(); assert.equal(f.size(), 0); f.run();
  assert.equal(renders, 2); assert.equal(measures, 1);
  mod.scheduleRefreshSources(); f.run(); assert.equal(renders, 3);
});
