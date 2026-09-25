import {readFile,writeFile} from 'node:fs/promises';
import {readRecord,commitRecord,simulate} from '../.cache/model.mjs';
const c=JSON.parse(await readFile('src/content/content.json','utf8'));let record=readRecord(null);for(let i=0;i<3;i++)record=commitRecord(record,'qa-'+i,simulate(c.stones[i],.75,15,0,c.physics));
await writeFile('.cache/layout-preview/record-fixture.js',`localStorage.setItem(${JSON.stringify(c.records.storageKey)},${JSON.stringify(JSON.stringify(record))});`);
let html=await readFile('.cache/layout-preview/index.html','utf8');html=html.replace('<script src="./app.js">','<script src="./record-fixture.js"></script><script src="./app.js">');await writeFile('.cache/layout-preview/index.html',html);
