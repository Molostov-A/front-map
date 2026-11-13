import { test } from 'node:test';
import assert from 'node:assert/strict';
import { operate, compare } from '../polygon.mjs';
import { applyCoord, translateGeom } from '../src/edit/geometry.js';
import { loadModule } from './module-harness.mjs';

const rect = (x, y, w, h) => ({ type: 'Polygon', coordinates: [[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]]] });
const area = (g) => !g ? 0 : (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).reduce((sum, p) => sum + p.reduce((s, ring, i) => {
  const a = Math.abs(ring.slice(1).reduce((n, b, j) => n + ring[j][0]*b[1] - b[0]*ring[j][1], 0)/2);
  return s + (i ? -a : a);
}, 0), 0);

test('union/difference: overlap, отверстие, разрез, непересекающиеся и пустой результат', () => {
  const a = rect(0,0,4,4), b = rect(2,0,4,4), snapshot = JSON.stringify([a,b]);
  assert.equal(area(operate('union',a,b)),24);
  assert.equal(area(operate('difference',a,b)),8);
  const hole = operate('difference',a,rect(1,1,2,2));
  assert.equal(hole.type,'Polygon'); assert.equal(hole.coordinates.length,2); assert.equal(area(hole),12);
  const split = operate('difference',a,rect(1,-1,1,6));
  assert.equal(split.type,'MultiPolygon'); assert.equal(area(split),12);
  assert.equal(operate('union',a,rect(10,10,1,1)).type,'MultiPolygon');
  assert.equal(operate('difference',a,a),null);
  assert.equal(JSON.stringify([a,b]),snapshot,'операнды не мутируются');
});

test('MultiPolygon: ручки второй части, замыкание отверстия, перенос всех частей', () => {
  const g = { type:'MultiPolygon', coordinates:[rect(0,0,4,4).coordinates, operate('difference',rect(10,0,4,4),rect(11,1,2,2)).coordinates] };
  const { handlesFor } = loadModule('../src/map/render.js',{createFrameScheduler:()=>({})});
  const handles = handlesFor({geometry:g});
  assert.equal(handles.length,12); assert.ok(handles.some(h=>h.polygon===1 && h.ring===1));
  applyCoord({geometry:g},{polygon:1,ring:1,index:0},[11.1,1.1]);
  assert.deepEqual(g.coordinates[1][1][0],g.coordinates[1][1].at(-1));
  const original=structuredClone(g); translateGeom(g,original,2,3);
  assert.deepEqual(g.coordinates[1][1][0],[13.1,4.1]);
});

test('сравнение по id: добавление, удаление, стиль, скрытый слой и отсутствие мутаций', () => {
  const f = (id,g,layer_id=1)=>({id,layer_id,type:'polygon',geometry:g,properties:{color:'#123456'}});
  const before=[f(1,rect(0,0,2,2)),f(2,rect(10,0,1,1)),f(4,rect(20,0,1,1),2)];
  const after=[f(1,rect(1,0,2,2)),f(3,rect(30,0,1,1)),f(4,rect(21,0,1,1),2)];
  const snapshot=JSON.stringify([before,after]);
  const fc=compare(before,after,new Set([1]));
  assert.equal(fc.features.length,4);
  assert.equal(fc.features.filter(f=>f.properties.kind==='added').reduce((a,f)=>a+area(f.geometry),0),3);
  assert.equal(fc.features.filter(f=>f.properties.kind==='removed').reduce((a,f)=>a+area(f.geometry),0),3);
  assert.equal(compare(before,before).features.length,0);
  assert.equal(compare([before[0]],[{...before[0],properties:{color:'#ffffff'}}]).features.length,0);
  assert.equal(JSON.stringify([before,after]),snapshot);
});
