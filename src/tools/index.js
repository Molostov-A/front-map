// Реестр инструментов рисования и завершение черновика.
// Интерфейс рисующего инструмента (tools/<type>.js):
//   onClick({ lngLat, point, shift }) → true, если черновик пора завершить;
//   finish(draft) → геометрия GeoJSON или null (точек мало — инструмент сам сообщает/отменяет).
// Инструменты без черновика (точка, надпись) создают объект сразу и finish не имеют.
// «Выбор» — tools/select.js (onClick / onDblClick / onHover). Общая механика — tools/map-events.js.
import { state } from '../core/store.js';
import { arrowTool } from './arrow.js';
import { commitDraft } from './draw.js';
import { labelTool } from './label.js';
import { lineTool } from './line.js';
import { pointTool } from './point.js';
import { polygonTool } from './polygon.js';
import { rulerTool } from './ruler.js';

export const DRAW_TOOLS = {
  line: lineTool,
  polygon: polygonTool,
  point: pointTool,
  label: labelTool,
  arrow: arrowTool,
  ruler: rulerTool
};

/** Завершить текущий черновик: геометрия от инструмента → создание объекта. */
export function finishDraft() {
  const d = state.draft;
  if (!d) return;
  const tool = DRAW_TOOLS[d.type];
  const geometry = tool && tool.finish ? tool.finish(d) : null;
  if (geometry) commitDraft(geometry, d.type);
}
