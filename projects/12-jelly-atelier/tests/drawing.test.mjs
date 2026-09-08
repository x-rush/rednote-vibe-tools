import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {appendDrawingPoint,tidyStroke} from '../src/drawing.js';
import {prepareOutline} from '../src/contour.js';
const rules=JSON.parse(readFileSync(new URL('../src/content/content.json',import.meta.url))).customRules;
test('screenshot-like star closes despite a tiny retraced corner',()=>{const raw=[[173,180],[160,199],[146,217],[121,228],[133,235],[142,244],[139,265],[136,276],[164,277],[175,285],[192,302],[197,289],[205,278],[217,275],[233,275],[231,272],[233,275],[218,241],[225,227],[236,214],[216,209],[206,205],[190,195]].map(([x,z])=>({x:(x-192)/115,z:(z-245)/115}));assert.equal(prepareOutline(raw,rules,{explicitClose:true}).ok,false);const fixed=prepareOutline(tidyStroke(raw),rules,{explicitClose:true});assert.equal(fixed.ok,true);});
test('long strokes keep accepting their latest point at the sample limit',()=>{let raw=[];for(let i=0;i<5000;i++)raw=appendDrawingPoint(raw,{x:Math.cos(i*.013)*.8,z:Math.sin(i*.013)*.8},rules.maxInput);assert.ok(raw.length<=rules.maxInput);assert.ok(Math.abs(raw.at(-1).x-Math.cos(4999*.013)*.8)<1e-10);});
test('cleaning does not turn a large bow tie into a valid mold',()=>{const raw=[{x:-.8,z:-.8},{x:.8,z:.8},{x:.8,z:-.8},{x:-.8,z:.8}];assert.equal(prepareOutline(tidyStroke(raw),rules,{explicitClose:true}).error,'cross');});
