import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadModule, deferred } from './module-harness.mjs';
import { compare } from '../polygon.mjs';
import { polygonAreaKm2 } from '../measure.mjs';

const tick = () => new Promise(r => setImmediate(r));
function setup() {
  let token = 'one', mod; const nodes = new Map(), requests = [], applied = [], colors = [];
  const defaults = { addedFill:'#34d399', addedLine:'#047857', removedFill:'#fb7185', removedLine:'#be123c', opacity:0.5 };
  const node = (id) => {
    if (!nodes.has(id)) nodes.set(id,{value:'',textContent:'',disabled:false,style:{},addEventListener() {}});
    return nodes.get(id);
  };
  node('#compare-from').value = '2026-11-12'; node('#compare-to').value = '2026-11-13';
  node('#compare-opacity').value = '50';
  for (const key of ['addedFill','addedLine','removedFill','removedLine']) node('#compare-'+key).value = defaults[key];
  const state = {date:'2026-11-13',layers:[{id:1,visible:true}]};
  mod = loadModule('../src/ui/date-comparison.js',{
    $:node,state,compare,polygonAreaKm2,formatArea:n=>String(n),comparisonDefaults:defaults,
    getToken:()=>token,currentDay:()=>state.date,shiftDay:()=> '2026-11-12',
    hooks:{flushSaves:async()=>{}},
    setDay:async(day)=>{state.date=day;mod.resetDateComparison();},
    api:{get:()=>{const d=deferred(); requests.push(d);return d.promise;}},
    setComparison:(fc,c)=>applied.push({fc,c}),clearComparison() {},
    recolorComparison:c=>colors.push(c),localStorage:{setItem() {},getItem:()=>null}
  });
  return {...mod,node,state,requests,applied,colors,token:t=>{token=t;}};
}
const feature={id:1,layer_id:1,type:'polygon',geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]}};

test('даты: показ изменений, четыре цвета и перекраска без повторных GET', async()=>{
  const x=setup(); const p=x.runDateComparison(); await tick();
  assert.equal(x.requests.length,2);
  x.requests[0].resolve({features:[]}); x.requests[1].resolve({features:[feature]}); await p;
  assert.equal(x.applied[0].fc.features[0].properties.kind,'added');
  assert.match(x.node('#compare-status').textContent,/2026-11-12/);
  x.node('#compare-addedLine').value='#112233'; x.updateComparisonColors();
  assert.equal(x.colors.at(-1).addedLine,'#112233'); assert.equal(x.requests.length,2);
});

test('даты: ошибка порядка/календаря не вызывает GET; одинаковые снимки без изменений', async()=>{
  const x=setup(); x.node('#compare-from').value='2026-02-30'; await x.runDateComparison();
  assert.equal(x.requests.length,0); assert.match(x.node('#compare-status').textContent,/корректные/);
  x.node('#compare-from').value='2026-11-14'; await x.runDateComparison(); assert.equal(x.requests.length,0);
  x.node('#compare-from').value='2026-11-12'; const p=x.runDateComparison(); await tick();
  for(const d of x.requests) d.resolve({features:[feature]}); await p;
  assert.match(x.node('#compare-status').textContent,/нет/); assert.equal(x.node('#compare-removed-area').textContent,'0 км²');
});

test('даты: смена дня/сессии/сброс при загрузке запрещают старому ответу вернуть оверлей', async()=>{
  for(const change of ['day','session','reset']) {
    const x=setup(); const p=x.runDateComparison(); await tick();
    if(change==='day') x.state.date='2026-11-14';
    if(change==='session') x.token('two');
    if(change==='reset') x.resetDateComparison();
    x.requests[0].resolve({features:[]}); x.requests[1].resolve({features:[feature]}); await p;
    assert.equal(x.applied.length,0,change);
  }
});

test('даты: сетевой сбой снимает загрузку и сообщает ошибку',async()=>{
  const x=setup(); const p=x.runDateComparison(); await tick();
  x.requests[0].reject(new Error('network')); x.requests[1].resolve({features:[]}); await p;
  assert.match(x.node('#compare-status').textContent,/network/); assert.equal(x.node('#compare-run').disabled,false);
});
