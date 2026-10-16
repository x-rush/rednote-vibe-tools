import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeOrientation,viewportRect} from '../src/orientation.js';

function setup(width,height,beforeToggle){
  const classes=new Set(),values=new Map(),events=new Map(),handlers=new Map();
  const media={mediaText:'(max-width: 700px)'};
  const toggle={setAttribute(name,value){this[name]=value;},addEventListener(name,callback){handlers.set(name,callback);}};
  const viewport={contains:target=>target==='canvas'};
  const root={style:{setProperty:(name,value)=>values.set(name,value)},querySelector:()=>({appendChild(){}}),getBoundingClientRect:()=>({left:0,top:0,right:width,bottom:height})};
  globalThis.document={styleSheets:[{cssRules:[{media}]}],body:{classList:{contains:name=>classes.has(name),toggle(name,on){if(on)classes.add(name);else classes.delete(name);}}},activeElement:null,createElement:()=>toggle,getElementById:id=>id==='app'?root:viewport};
  globalThis.window={innerWidth:width,innerHeight:height,visualViewport:null,addEventListener(name,callback){if(!events.has(name))events.set(name,[]);events.get(name).push(callback);},dispatchEvent(event){for(const callback of events.get(event.type)||[])callback(event);}};
  initializeOrientation({portrait:'portrait',landscape:'landscape'},beforeToggle);
  return{classes,values,media,toggle,click:()=>handlers.get('click')(),pointer(event){for(const callback of events.get(event.type)||[])callback(event);}};
}

test('physical landscape switches to portrait and back without hiding its toggle',()=>{
  const state=setup(932,430);
  assert.equal(state.toggle.hidden,false);
  assert.equal(state.toggle.textContent,'portrait');
  state.click();
  assert.ok(state.classes.has('forced-portrait'));
  assert.ok(!state.classes.has('natural-landscape'));
  assert.equal(state.values.get('--rotation-width'),'430px');
  assert.equal(state.values.get('--available-height'),'932px');
  assert.equal(state.media.mediaText,'all');
  assert.equal(state.toggle.textContent,'landscape');
  state.click();
  assert.ok(state.classes.has('natural-landscape'));
  assert.ok(!state.classes.has('forced-portrait'));
  assert.equal(state.media.mediaText,'(max-width: 700px)');
  assert.equal(state.toggle.textContent,'portrait');
});

test('portrait keeps the existing landscape round trip',()=>{
  const state=setup(393,852);
  state.click();
  assert.ok(state.classes.has('forced-landscape'));
  assert.equal(state.values.get('--rotation-width'),'852px');
  assert.equal(state.toggle.textContent,'portrait');
  state.click();
  assert.ok(!state.classes.has('forced-landscape'));
  assert.equal(state.toggle.textContent,'landscape');
});

test('portrait rotation maps canvas bounds and tracked pointers back to logical coordinates',()=>{
  const state=setup(932,430);state.click();
  const rect=viewportRect({clientWidth:350,clientHeight:700,getBoundingClientRect:()=>({left:60,top:20,right:760,bottom:370})});
  assert.deepEqual(rect,{left:60,top:60,width:350,height:700});
  const down={type:'pointerdown',target:'canvas',pointerId:1,clientX:120,clientY:100};state.pointer(down);
  assert.equal(down.clientX,330);assert.equal(down.clientY,120);
  const move={type:'pointermove',target:'outside',pointerId:1,clientX:140,clientY:110};state.pointer(move);
  assert.equal(move.clientX,320);assert.equal(move.clientY,140);
});

test('a rejected toggle leaves the current orientation intact',()=>{
  const state=setup(932,430,()=>false);state.click();
  assert.ok(state.classes.has('natural-landscape'));
  assert.ok(!state.classes.has('forced-portrait'));
});
