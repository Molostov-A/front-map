import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleAppearance, transferAppearance } from '../style-transfer.mjs';
import { normalize, FEATURE_TYPES } from '../shared/feature-schema.mjs';

test('пипетка: все типы, только оформление; геометрические параметры, текст и nodeMeta сохраняются', () => {
  for (const type of FEATURE_TYPES) {
    const source = { type, properties: normalize(type, { color:'#123456',opacity:0.7,width:8,text:'source',caption:'source',
      label:{color:'#abcdef',size:25},baseWidth:12000,headLength:8000,smooth:true,stemMode:'smooth',nodeMeta:[{auto:false,i:[7,8]}] }) };
    const target = { id:2,type,geometry:{type:'LineString',coordinates:[[1,2],[3,4]]},properties:normalize(type,{
      color:'#fedcba',text:'target',caption:'target',baseWidth:600,headLength:900,smooth:false,stemMode:'sharp',nodeMeta:[{auto:false,i:[1,2]}]
    }) };
    const old = structuredClone(target), sample=sampleAppearance(source);
    const props = transferAppearance(sample,target);
    assert.deepEqual(target,old,'получатель не мутируется: '+type);
    for (const key of ['text','caption','nodeMeta','baseWidth','headLength','smooth','stemMode','smoothAmount']) {
      assert.deepEqual(props[key],old.properties[key],type+': '+key);
    }
    if (type==='label') assert.equal(props.label.color,'#abcdef'); else assert.equal(props.color,'#123456');
  }
});

test('пипетка: снимок независим от источника; между типами только совместимые поля', () => {
  const source={type:'line',properties:{color:'#112233',width:9,opacity:0.4,smooth:true}};
  const sample=sampleAppearance(source); source.properties.color='#ffffff';
  const polygon={type:'polygon',properties:normalize('polygon',{color:'#aabbcc',outlineWidth:5})};
  const props=transferAppearance(sample,polygon);
  assert.equal(props.color,'#112233'); assert.equal(props.opacity,0.4); assert.equal(props.outlineWidth,5);
  assert.equal(props.width,undefined); assert.equal(props.smooth,undefined);
  const label=transferAppearance(sample,{type:'label',properties:normalize('label',{text:'Keep',label:{size:30}})});
  assert.equal(label.text,'Keep'); assert.equal(label.label.color,'#112233'); assert.equal(label.label.size,30);
});

test('пипетка: текстовое оформление переносится между точкой и надписью без содержимого',()=>{
  const sample=sampleAppearance({type:'label',properties:normalize('label',{text:'Do not copy',label:{color:'#334455',bold:true}})});
  const props=transferAppearance(sample,{type:'point',properties:normalize('point',{caption:'Keep caption',size:9})});
  assert.equal(props.caption,'Keep caption'); assert.equal(props.size,9); assert.equal(props.label.bold,true);
});
