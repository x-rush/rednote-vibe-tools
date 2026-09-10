import test from 'node:test';import assert from 'node:assert/strict';
import {appendPour} from '../src/pour.js';
import {cleanRecipe} from '../src/engine.js';
import {readFileSync} from 'node:fs';
const content=JSON.parse(readFileSync(new URL('../src/content/content.json',import.meta.url)));
test('changing the next colour preserves every previously poured colour and boundary',()=>{const first=Object.freeze([Object.freeze({flavor:'peach',end:.23})]);const second=appendPour(first,'blue',.17,32);assert.deepEqual(first,[{flavor:'peach',end:.23}]);assert.deepEqual(second,[{flavor:'peach',end:.23},{flavor:'blue',end:.4}]);const third=appendPour(second,'peach',.6,32);assert.deepEqual(third.slice(0,2),second);assert.deepEqual(third.at(-1),{flavor:'peach',end:1})});
test('pausing and resuming the same colour extends one layer without introducing empty layers',()=>{const first=appendPour([],'peach',.15,32);assert.deepEqual(appendPour(first,'peach',.1,32),[{flavor:'peach',end:.25}]);for(const dose of [0,-1,NaN,Infinity])assert.equal(appendPour(first,'blue',dose,32),first)});
test('overfill clamps at full and the layer limit never recolours existing liquid',()=>{const first=[{flavor:'peach',end:.4}];assert.equal(appendPour(first,'blue',.2,1),first);const filled=appendPour(first,'peach',2,1);assert.equal(filled.at(-1).end,1);assert.equal(appendPour(filled,'blue',.2,32),filled)});
test('single-colour and irregular multilayer finished recipes survive storage',()=>{const base={mold:'flower',first:'peach',second:'blue',split:.5,toppings:[]};for(const layers of [[{flavor:'peach',end:1}],[{flavor:'peach',end:.17},{flavor:'blue',end:.39},{flavor:'milk',end:1}]])assert.deepEqual(cleanRecipe({...base,layers},content).layers,layers)});
