import test from 'node:test';
import assert from 'node:assert/strict';
import {pickSticker} from '../src/collage-layout.js';
const sticker=(patch={})=>({x:300,y:400,rotation:0,scale:1,back:false,...patch});
test('collage picking follows visible layers and keeps back stickers reachable',()=>{const items=[sticker(),sticker({back:true}),sticker({x:600})];assert.equal(pickSticker(items,{x:300,y:400}),0);assert.equal(pickSticker(items,{x:600,y:400}),2);assert.equal(pickSticker(items,{x:0,y:0}),-1);items[0].x=100;assert.equal(pickSticker(items,{x:300,y:400}),1);});
test('collage picking respects rotated and scaled bounds',()=>{const items=[sticker({rotation:Math.PI/2,scale:2})];assert.equal(pickSticker(items,{x:300,y:580}),0);assert.equal(pickSticker(items,{x:480,y:400}),-1);assert.equal(pickSticker([sticker(),sticker()],{x:300,y:400}),1);});
