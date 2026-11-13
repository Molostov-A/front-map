// Завершение сохранений операндов, серверная операция и выбор результата.
import { api, getToken } from '../core/api.js';
import { currentDay } from '../core/days.js';
import { hooks } from '../core/hooks.js';
import { canEdit } from '../core/session.js';
import { flushFeaturePuts } from './sync.js';

export async function applyPolygonOperation(context) {
  const token = getToken();
  const active = () => token && token === getToken() && currentDay() === context.day && canEdit();
  if (!active()) return null;
  await flushFeaturePuts([context.firstId, context.secondId]);
  if (!active()) return null;
  const feature = await api.send('POST', `/api/features/${context.firstId}/polygon-operation`, {
    other_id: context.secondId, operation: context.operation, date: context.day,
    result: context.result, consume: context.consume, expected: context.expected
  });
  if (!active()) return null;
  await hooks.reload();
  if (!active()) return null;
  hooks.select(feature.id);
  return feature;
}
