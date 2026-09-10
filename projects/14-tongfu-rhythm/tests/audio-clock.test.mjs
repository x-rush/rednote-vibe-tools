import test from 'node:test';import assert from 'node:assert/strict';
import {outputTime,medianOffset} from '../src/audio-clock.mjs';
test('output timeline does not mistake 120ms of queued audio for audible music',()=>{
 const context={currentTime:10,getOutputTimestamp:()=>({contextTime:9.88,performanceTime:20000})};
 assert.equal(outputTime(context,20000,20000),9.88);
 assert.ok(Math.abs(outputTime(context,19990,20000)-9.87)<1e-9);
 assert.ok(Math.abs(outputTime(context,20020,20020)-9.90)<1e-9);
});
test('fallback accounts for output latency once and invalid timestamp cannot jump time',()=>{
 const c={currentTime:10,baseLatency:.01,outputLatency:.04,getOutputTimestamp:()=>({contextTime:0,performanceTime:0})};
 assert.equal(outputTime(c,20000,20000),9.95);
 assert.equal(outputTime(c,1700000000000,20000),9.95);
 c.getOutputTimestamp=()=>{throw Error('unsupported');};assert.equal(outputTime(c,20000,20000),9.95);
});
test('calibration rejects inconsistent tapping rather than saving a misleading offset',()=>{
 assert.equal(medianOffset([48,51,52,49,50,53,47,200]),50);
 assert.equal(medianOffset([-240,-210,-180,-100,20,80,160,230]),null);
 assert.equal(medianOffset([0,1,2]),null);
});
