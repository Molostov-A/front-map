import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './module-harness.mjs';
import { sampleAppearance, transferAppearance } from '../style-transfer.mjs';

test('пипетка: два клика, повторное применение, Shift, другая сессия и readonly',()=>{
  let token='one',editable=true; const saves=[],selected=[];
  const f=id=>({id,type:'polygon',geometry:{type:'Polygon',coordinates:[[[id,0],[id+1,0],[id,1],[id,0]]]},properties:{color:id===1?'#112233':'#aabbcc'}});
  const state={features:[f(1),f(2),f(3)]};
  const mod=loadModule('../src/tools/eyedropper.js',{
    state,sampleAppearance,transferAppearance,getToken:()=>token,canEdit:()=>editable,
    setMoveMode() {},select:id=>selected.push(id),saveFeature:(feature,patch)=>saves.push({id:feature.id,patch}),updateHint() {},toast() {}
  });
  mod.eyedropperTool.onEnter(); mod.pickAppearance(1);
  state.features[0].properties.color='#ffffff';
  const geometry=structuredClone(state.features[1].geometry);
  mod.pickAppearance(2); mod.pickAppearance(3);
  assert.equal(state.features[1].properties.color,'#112233'); assert.equal(state.features[2].properties.color,'#112233');
  assert.deepEqual(state.features[1].geometry,geometry); assert.deepEqual(Object.keys(saves[0].patch),['properties']);
  mod.pickAppearance(1,true); mod.pickAppearance(2); assert.equal(state.features[1].properties.color,'#ffffff');
  token='two'; mod.pickAppearance(3); assert.equal(saves.length,3,'новая сессия только берёт образец');
  editable=false; mod.pickAppearance(1); assert.equal(saves.length,3);
  mod.eyedropperTool.onLeave(); assert.match(mod.eyedropperTool.hint(),/источник/); assert.ok(selected.length>0);
});
