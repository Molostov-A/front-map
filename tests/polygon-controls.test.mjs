import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './module-harness.mjs';
import { operate } from '../polygon.mjs';

test('контролы операции: применение только после просмотра, сброс блокирует применение', () => {
  const nodes=new Map();
  const node=id=>{
    if(!nodes.has(id))nodes.set(id,{value:'',checked:false,textContent:'',disabled:false,
      addEventListener() {},replaceChildren() {this.value='';},appendChild(o) {if(!this.value)this.value=o.value;}});
    return nodes.get(id);
  };
  node('#polygon-other').value='2'; node('#polygon-operation-mode').value='union'; node('#polygon-result').value='second';
  const rect=x=>({type:'Polygon',coordinates:[[[x,0],[x+2,0],[x+2,2],[x,2],[x,0]]]});
  const state={selectedId:1,tool:'select',layers:[{id:1,visible:true,name:'L'}],features:[1,2].map(id=>({id,layer_id:1,type:'polygon',geometry:rect(id)}))};
  let previews=0,clears=0;
  const mod=loadModule('../src/ui/polygon-operations.js',{
    $:node,state,operate,structuredClone,canEdit:()=>true,currentDay:()=> '2026-11-13',
    document:{createElement:()=>({})},setPolygonPreview:()=>previews++,clearPolygonPreview:()=>clears++,hooks:{}
  });
  mod.bindPolygonOperations(); mod.renderPolygonOperations(); assert.equal(node('#polygon-apply').disabled,true);
  node('#polygon-preview').onclick(); assert.equal(previews,1); assert.equal(node('#polygon-apply').disabled,false);
  mod.resetPolygonOperations(); assert.equal(node('#polygon-apply').disabled,true); assert.ok(clears>0);
  assert.match(node('#polygon-operation-status').textContent,/сброшен/);
});
