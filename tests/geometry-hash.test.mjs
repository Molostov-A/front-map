import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { geometryHash } from '../geometry-hash.mjs';

test('хеш фиксирует контур до асинхронного вычисления и совместим с серверным SHA-256', async () => {
  const geometry = { type: 'Point', coordinates: [30, 48] };
  const expected = createHash('sha256').update(JSON.stringify(geometry)).digest('hex');
  const pending = geometryHash(geometry); geometry.coordinates[0] = 31;
  assert.equal(await pending, expected); assert.notEqual(await geometryHash(geometry), expected);
});
