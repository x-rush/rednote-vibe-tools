import test from 'node:test';
import assert from 'node:assert/strict';
import {smoothPressure,pressureAt} from '../src/press.js';
test('held pressure stays depressed, then releases without sticking',()=>{let p=0;for(let i=0;i<600;i++)p=smoothPressure(p,.4,1/60);assert.ok(Math.abs(p-.4)<1e-8);for(let i=0;i<60;i++)p=smoothPressure(p,0,1/60);assert.ok(p<.000001);});
test('pressure follows the contact point and keeps the plate contact anchored',()=>{const point={x:.8,y:1.5,z:0};assert.ok(pressureAt(.8,1.5,0,point,.4)>pressureAt(-.8,1.5,0,point,.4)*10);assert.equal(pressureAt(.8,.14,0,point,.4),0);const moved={x:-.8,y:1.5,z:0};assert.ok(pressureAt(-.8,1.5,0,moved,.4)>pressureAt(.8,1.5,0,moved,.4)*10);});
test('press easing is independent of frame rate',()=>{let a=0,b=0;for(let i=0;i<60;i++)a=smoothPressure(a,.4,1/60);for(let i=0;i<30;i++)b=smoothPressure(b,.4,1/30);assert.ok(Math.abs(a-b)<1e-10);});
