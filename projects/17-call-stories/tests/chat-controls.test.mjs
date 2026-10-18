import test from 'node:test';
import assert from 'node:assert/strict';
import {voiceGesture} from '../src/chat-controls.mjs';

test('voice gesture only cancels or converts after an upward slide',()=>{
  for(const width of [375,390,430,844]){
    const start={x:width/2,y:740};
    assert.equal(voiceGesture(start,{x:width*.1,y:735},width),'send');
    assert.equal(voiceGesture(start,{x:width*.9,y:690},width),'send');
    assert.equal(voiceGesture(start,{x:width*.1,y:630},width),'cancel');
    assert.equal(voiceGesture(start,{x:width*.9,y:630},width),'text');
    assert.equal(voiceGesture(start,start,width),'send');
  }
});
