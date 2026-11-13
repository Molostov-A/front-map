import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadModule, deferred } from './module-harness.mjs';

test('полигональная операция ждёт сохранений и не применяет ответ другой сессии', async () => {
  let token='one', day='2026-11-13'; const flushing=deferred(), request=deferred(), events=[];
  const {applyPolygonOperation}=loadModule('../src/edit/polygon-operations.js',{
    getToken:()=>token,currentDay:()=>day,canEdit:()=>true,
    flushFeaturePuts:()=>{events.push('flush');return flushing.promise;},
    api:{send:()=>{events.push('post');return request.promise;}},
    hooks:{reload:async()=>events.push('reload'),select:()=>events.push('select')}
  });
  const c={firstId:1,secondId:2,day}; const p=applyPolygonOperation(c);
  assert.deepEqual(events,['flush']); flushing.resolve();
  await new Promise(r=>setImmediate(r)); assert.deepEqual(events,['flush','post']);
  token='two'; request.resolve({id:3}); assert.equal(await p,null);
  assert.deepEqual(events,['flush','post']); day='2026-11-14';
});

test('ошибка сохранения операнда блокирует POST; успех загружает карту до выбора результата', async () => {
  const events=[];
  const bindings={getToken:()=> 'one',currentDay:()=> '2026-11-13',canEdit:()=>true,
    flushFeaturePuts:async()=>{throw new Error('save failed');},
    api:{send:async()=>{events.push('post');return {id:3};}},
    hooks:{reload:async()=>events.push('reload'),select:(id)=>events.push(id)}};
  const c={firstId:1,secondId:2,day:'2026-11-13'};
  await assert.rejects(loadModule('../src/edit/polygon-operations.js',bindings).applyPolygonOperation(c),/save failed/);
  assert.equal(events.length,0);
  bindings.flushFeaturePuts=async()=>{};
  assert.equal((await loadModule('../src/edit/polygon-operations.js',bindings).applyPolygonOperation(c)).id,3);
  assert.deepEqual(events,['post','reload',3]);
});
