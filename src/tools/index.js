// Реестр инструментов рисования и завершение черновика.
// Интерфейс инструмента (tools/<type>.js) — всё про инструмент в одном файле:
//   hint(draft) → текст подсказки;
//   onClick({ lngLat, point, shift }) → true, если черновик пора завершить;
//   draft(draft) → GeoJSON-объекты черновика для оверлея (необязательно);
//   finish(draft) → геометрия GeoJSON или null (точек мало — инструмент сам сообщает/отменяет);
//   selectAfterCreate — выбрать объект сразу после создания.
// Инструменты регистрируются в core/tools-registry.js — оттуда их читают render (черновик) и hint.
// Инструменты без черновика (точка, надпись) создают объект сразу и finish не имеют.
// «Выбор» — tools/select.js (onClick / onDblClick / onHover). Общая механика — tools/map-events.js.
import { state } from '../core/store.js';
import { registerTools } from '../core/tools-registry.js';
import { deepStateImportTool } from './deepstate-import.js';
import { eyedropperTool } from './eyedropper.js';
import { arrowTool } from './arrow.js';
import { commitDraft } from './draw.js';
import { labelTool } from './label.js';
import { lineTool } from './line.js';
import { pointTool } from './point.js';
import { polygonTool } from './polygon.js';
import { rulerTool } from './ruler.js';
import { selectTool } from './select.js';

export const DRAW_TOOLS = {
  line: lineTool,
  polygon: polygonTool,
  point: pointTool,
  label: labelTool,
  arrow: arrowTool,
  ruler: rulerTool
};

registerTools({ ...DRAW_TOOLS, select: selectTool, eyedropper: eyedropperTool, 'deepstate-import': deepStateImportTool });

/** Завершить текущий черновик: геометрия от инструмента → создание объекта. */
export function finishDraft() {
  const d = state.draft;
  if (!d) return;
  const tool = DRAW_TOOLS[d.type];
  const geometry = tool && tool.finish ? tool.finish(d) : null;
  if (geometry) commitDraft(geometry, d.type, { select: !!tool.selectAfterCreate });
}
