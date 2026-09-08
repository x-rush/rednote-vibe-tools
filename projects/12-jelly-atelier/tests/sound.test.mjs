import test from 'node:test';
import assert from 'node:assert/strict';
import {createSound} from '../src/sound.js';

test('audio starts on interaction, has soft envelopes, and cancels pouring on mute or suspension',t=>{
  t.mock.timers.enable({apis:['setInterval','setTimeout']});
  const nodes=[];let contexts=0;
  const param=()=>({value:0,events:[],setValueAtTime(v,time){this.events.push(['set',v,time])},linearRampToValueAtTime(v,time){this.events.push(['linear',v,time])},exponentialRampToValueAtTime(v,time){this.events.push(['exp',v,time])},cancelScheduledValues(){},setTargetAtTime(v,time){this.events.push(['target',v,time])}});
  function node(type){const n={type,gain:param(),frequency:param(),Q:param(),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),connect(){},disconnect(){},start(){},stop(){this.stopped=true}};nodes.push(n);return n}
  t.mock.method(globalThis,'setInterval',globalThis.setInterval);
  const previous=globalThis.AudioContext;
  globalThis.AudioContext=class{constructor(){contexts++;this.currentTime=1;this.sampleRate=8000;this.state='running';this.destination={}}createDynamicsCompressor(){return node('compressor')}createOscillator(){return node('osc')}createGain(){return node('gain')}createBuffer(){return {getChannelData:()=>new Float32Array(16000)}}createBufferSource(){return node('source')}createBiquadFilter(){return node('filter')}suspend(){this.state='suspended';return Promise.resolve()}resume(){this.state='running';return Promise.resolve()}};
  t.after(()=>{if(previous)globalThis.AudioContext=previous;else delete globalThis.AudioContext});
  const sound=createSound({volume:.3,pourVolume:.25,maxVoices:5});
  sound.setEnabled(true);assert.equal(contexts,0);
  sound.impact();assert.equal(contexts,1);
  const envelope=nodes.find(n=>n.type==='gain');assert.deepEqual(envelope.gain.events[0],['set',0,1]);assert.ok(envelope.gain.events[1][2]>=1.04);
  sound.startPour();sound.startPour();assert.equal(nodes.filter(n=>n.type==='source').length,1);
  t.mock.timers.tick(400);assert.ok(nodes.filter(n=>n.frequency.events.length).length>=4);
  sound.setEnabled(false);const count=nodes.length;t.mock.timers.tick(1000);assert.equal(nodes.length,count);assert.ok(nodes.find(n=>n.type==='source').stopped);
  sound.impact();assert.equal(nodes.length,count);
  sound.setEnabled(true);sound.startPour();sound.suspend();const suspendedCount=nodes.length;t.mock.timers.tick(1000);assert.equal(nodes.length,suspendedCount);
});
