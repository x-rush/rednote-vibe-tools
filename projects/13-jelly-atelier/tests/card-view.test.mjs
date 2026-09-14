import test from 'node:test';
import assert from 'node:assert/strict';
import {cardView} from '../src/card-view.js';
test('recommended and current card angles both preserve night lighting without mutating source view',()=>{const source={rotation:[.2,0,0,.98],pan:[0,.4,0],zoom:.7,lightsOff:true};const recommended=cardView(source),current=cardView(source,true);assert.equal(recommended.lightsOff,true);assert.equal(current.lightsOff,true);assert.deepEqual(recommended.pan,[0,0,0]);assert.deepEqual(current.pan,source.pan);current.pan[1]=99;assert.equal(source.pan[1],.4);assert.equal(cardView(undefined).lightsOff,false);assert.equal(cardView({...source,lightsOff:false},true).lightsOff,false);});
