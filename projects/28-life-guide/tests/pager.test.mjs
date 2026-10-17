import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const context={window:{}};vm.runInNewContext(await readFile(new URL('../src/pager.js',import.meta.url),'utf8'),context);const P=context.window.LifePager;
test('page boundaries clamp negative, stale and fractional checkpoints',()=>{assert.equal(P.clamp(-1,20),0);assert.equal(P.clamp(200,20),19);assert.equal(P.clamp(3.9,20),3);assert.equal(P.clamp(NaN,0),0);});
test('swipe requires a clear horizontal gesture and preserves direction',()=>{assert.equal(P.swipe(-65,10),1);assert.equal(P.swipe(65,10),-1);assert.equal(P.swipe(20,2),0);assert.equal(P.swipe(50,80),0);});
test('step cannot skip chapter boundaries',()=>{const p=new P({}, {style:{}},null);p.pageCount=3;assert.equal(p.step(-1),false);assert.equal(p.step(1),true);assert.equal(p.pageIndex,1);assert.equal(p.step(1),true);assert.equal(p.step(1),false);assert.equal(p.pageIndex,2);});
