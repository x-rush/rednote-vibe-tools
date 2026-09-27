import {readFile,writeFile,unlink} from 'node:fs/promises';
const p='src/app.js';
let s=await readFile(p,'utf8');
const q=str=>JSON.stringify(str);
// 1. item form: always show w/d/h/angle; x/z advanced only
const oldForm=String.raw`${advanced?`<form id="item-form"><div class="field-grid">${field(U.width+' m','w',o.w,.1,8)}${field(U.depth+' m','d',o.d,.1,8)}${field(U.height+' m','h',o.h,.01,4,.001)}${field(U.angle+' °','angle',o.angle,-360,360,1)}${field('X','x',o.x,-60,60)}${field('Z','z',o.z,-60,60)}</div><button class="primary" type="submit">${U.apply}</button></form><label class="check-row"><input id="snap" type="checkbox" ${snap?'checked':''}>${U.snap}</label>`:''}`;
const newForm=String.raw`<h4>${U.size}</h4><form id="item-form"><div class="field-grid">${field(U.width+' m','w',o.w,.1,8)}${field(U.depth+' m','d',o.d,.1,8)}${field(U.height+' m','h',o.h,.01,4,.001)}${field(U.angle+' °','angle',o.angle,-360,360,1)}${advanced?field('X','x',o.x,-60,60)+field('Z','z',o.z,-60,60):''}</div><button class="primary" type="submit">${U.apply}</button></form>${advanced?`<label class="check-row"><input id="snap" type="checkbox" ${snap?'checked':''}>${U.snap}</label>`:''}`;
if(!s.includes(oldForm))throw new Error('item form anchor not found');
s=s.replace(oldForm,newForm);
// 2. saveRoomDraft item-form: only override fields present in the form
const oldSave="const n={...old,...Object.fromEntries(['w','d','h','angle','x','z'].map(k=>[k,num(k)]))},room=";
if(!s.includes(oldSave))throw new Error('save anchor not found');
s=s.replace(oldSave,"const n={...old,...Object.fromEntries(['w','d','h','angle','x','z'].filter(k=>fd.has(k)).map(k=>[k,num(k)]))},room=");
// 3. advanced details gets a class; beginner strip only removes it
if(!s.includes('<details><summary>${U.advanced}</summary>'))throw new Error('adv details anchor not found');
s=s.replace('<details><summary>${U.advanced}</summary>','<details class="adv-detail"><summary>${U.advanced}</summary>');
s=s.replace("if(!advanced)el.querySelectorAll('details').forEach(detail=>detail.remove());","if(!advanced)el.querySelectorAll('details.adv-detail').forEach(detail=>detail.remove());");
await writeFile(p,s);
console.log('app.js patched');
