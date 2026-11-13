import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './module-harness.mjs';

test('высота панели учитывает её отступ сверху: низ остаётся в окне', () => {
  const { loadPanels, panelEls, applyPanelRect } = loadModule('../src/ui/float-panels.js', {
    localStorage: { getItem: () => null }, FEATURE_TYPES: [], state: {}, $: () => null
  });
  const props = { style: {}, dataset: {}, classList: { toggle() {} } };
  panelEls.props = props; loadPanels(); applyPanelRect('props');
  assert.equal(props.style.top, '96px'); assert.equal(props.style.maxHeight, 'calc(100% - 108px)');
});
