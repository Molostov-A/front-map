// Полигональные операции клиента работают и на исходниках, и в сборке Pages.
import engine from './vendor/polygon-clipping.mjs';
import { createPolygonOps } from './shared/polygon-ops.mjs';
export const { operate, compare } = createPolygonOps(engine);
