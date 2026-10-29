// Декларативный биндер панелей на минимальной подделке DOM (без браузера).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPanel, bindPanel } from '../src/ui/panel-binder.js';

const ok = (cond, name) => assert.ok(cond, name);

function el(attrs = {}, { type = 'text', classes = [], children = [] } = {}) {
  const cls = new Set(classes);
  const listeners = {};
  const e = {
    type, value: '', checked: false, disabled: false, textContent: '',
    dataset: { ...attrs },
    classList: { contains: (c) => cls.has(c), toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)) },
    addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
    fire: (ev) => (listeners[ev] || []).forEach((fn) => fn()),
    children,
    querySelectorAll: (sel) => {
      if (sel === 'button[data-value]') return children.filter((c) => c.dataset.value !== undefined);
      return [];
    }
  };
  return e;
}
function root(nodes) {
  const has = (k) => nodes.filter((n) => n.dataset[k] !== undefined);
  return {
    querySelectorAll: (sel) => ({
      '[data-field]': has('field'), '[data-out]': has('out'), '[data-enabled-if]': has('enabledIf')
    })[sel] || []
  };
}

test('renderPanel', () => {
  const opacity = el({ field: 'opacity', scale: '100' }, { type: 'range' });
  const opacityOut = el({ out: 'opacity', format: 'percent' });
  const width = el({ field: 'baseWidth' }, { type: 'number' });
  const widthOut = el({ out: 'baseWidth', format: 'm' });
  const smooth = el({ field: 'smoothAmount', scale: '100', enabledIf: 'stemMode=smooth' }, { type: 'range' });
  const stemSeg = el({ field: 'stemMode' }, { classes: ['as-seg'], children: [el({ value: 'sharp' }), el({ value: 'smooth' })] });
  const bold = el({ field: 'label.bold' }, { type: 'checkbox' });
  const bgColor = el({ field: 'label.bgColor', enabledIf: 'label.bg' }, { type: 'color' });
  const lineSmooth = el({ field: 'smooth', type: 'bool' }, { classes: ['as-seg'], children: [el({ value: '0' }), el({ value: '1' })] });
  const notSmooth = el({ enabledIf: '!smooth' });
  const r = root([opacity, opacityOut, width, widthOut, smooth, stemSeg, bold, bgColor, lineSmooth, notSmooth]);
  renderPanel(r, { opacity: 0.955, baseWidth: 600, smoothAmount: 0.6, stemMode: 'sharp', smooth: true,
    label: { bold: true, bg: false, bgColor: '#123456' } });
  ok(opacity.value === 96, 'data-scale: значение × scale, округлено');
  ok(opacityOut.textContent === '96%', 'формат percent');
  ok(width.value === 600 && widthOut.textContent === '600 м', 'число без scale и формат m');
  ok(smooth.disabled === true, 'data-enabled-if="stemMode=smooth" при sharp → disabled');
  ok(stemSeg.children[0].classList.contains('active') && !stemSeg.children[1].classList.contains('active'), 'сегмент: активна кнопка значения');
  ok(bold.checked === true, 'вложенный путь label.bold → checkbox');
  ok(bgColor.disabled === true && bgColor.value === '#123456', 'label.bg=false → цвет фона disabled');
  ok(lineSmooth.children[1].classList.contains('active'), 'bool-сегмент: true → "1"');
  ok(notSmooth.disabled === true, 'отрицание "!smooth"');
});

test('bindPanel', () => {
  const style = { opacity: 1, label: { bold: false }, smooth: false, fill: 'solid', caption: '' };
  let changes = 0;
  const opacity = el({ field: 'opacity', scale: '100' }, { type: 'range' });
  const bold = el({ field: 'label.bold' }, { type: 'checkbox' });
  const caption = el({ field: 'caption' }, { type: 'text' });
  const fillSeg = el({ field: 'fill' }, { classes: ['as-seg'], children: [el({ value: 'solid' }), el({ value: 'hatched' })] });
  const smoothSeg = el({ field: 'smooth', type: 'bool' }, { classes: ['as-seg'], children: [el({ value: '0' }), el({ value: '1' })] });
  bindPanel(root([opacity, bold, caption, fillSeg, smoothSeg]), () => style, () => { changes++; });
  opacity.value = '40'; opacity.fire('input');
  ok(style.opacity === 0.4, 'range с data-scale → ввод / scale');
  bold.checked = true; bold.fire('input');
  ok(style.label.bold === true, 'checkbox по вложенному пути');
  caption.value = 'Привет'; caption.fire('input');
  ok(style.caption === 'Привет', 'текстовое поле → строка');
  fillSeg.children[1].fire('click');
  ok(style.fill === 'hatched', 'сегмент → значение кнопки');
  smoothSeg.children[1].fire('click');
  ok(style.smooth === true, 'bool-сегмент → boolean');
  ok(changes === 5, 'onChange после каждого изменения');
});
