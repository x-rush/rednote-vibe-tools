import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),create=require('../src/engine.js'),c=JSON.parse(await readFile(new URL('../src/content/content.json',import.meta.url),'utf8')),e=create(c),start=1800000000000,s=e.fresh(start),events=[],snapshots=[];
function act(a,minute){return e.act(s,a,start+minute*60000).ok;}
function spot(id){for(let area=0;area<4;area++)for(const rotated of [false,true]){const p=e.suggest(s,id,area,rotated);if(p)return Object.assign({rotated},p);}return null;}
let minute=0;
for(;minute<=60*24*14;minute++){
  act({type:'collect'},minute);
  for(let step=0;step<50;step++){
    let changed=false;
    for(const g of c.goals)if(!s.goals.includes(g.id)&&e.goalValue(s,g)>=g.target){act({type:'goal',id:g.id},minute);changed=true;}
    const expansion=c.expansions[s.expansion+1];if(expansion&&e.level(s).value>=expansion.level&&s.coins>=expansion.price){act({type:'expand'},minute);changed=true;}
    const next=c.items.find(i=>!s.collection.includes(i.id));
    if(next&&e.level(s).value>=c.tiers[next.tier-1].level&&s.coins>=e.price(next.id)){
      let p=spot(next.id);
      if(!p){for(const old of s.objects.filter(o=>o.pos>=0).sort((a,b)=>e.baseRate(a)-e.baseRate(b))){act({type:'store',uid:old.uid},minute);p=spot(next.id);if(p)break;}}
      if(p){act(Object.assign({type:'buy',item:next.id},p),minute);events.push({minute,scenery:next.name,tier:next.tier,gardenLevel:e.level(s).value,rate:e.rate(s)});changed=true;}
    }
    // Upgrade only when it unlocks the next tier or starts the tutorial; otherwise save for new scenery.
    if((next&&e.level(s).value<c.tiers[next.tier-1].level)||!s.goals.includes('firstup')){
      const o=s.objects.filter(o=>o.pos>=0&&o.level<10).sort((a,b)=>e.upgradeCost(a)/e.items[a.item].tier-e.upgradeCost(b)/e.items[b.item].tier)[0];
      if(o&&s.coins>=e.upgradeCost(o)){act({type:'upgrade',uid:o.uid},minute);changed=true;}
    }
    if(!changed)break;
  }
  if([0,10,30,60,180,480,1440,4320].includes(minute))snapshots.push({minute,coins:Math.floor(s.coins),rate:e.rate(s),level:e.level(s).value,collection:s.collection.length,slots:e.slots(s)});
  if(s.collection.length===24&&e.slots(s)===48)break;
}
assert.equal(s.collection.length,24,'All tiers reachable with real economy');assert.equal(e.slots(s),48,'All four courts reachable');
assert.equal(e.restore(JSON.stringify(s),start+minute*60000).error,undefined);
const report={policy:'Deterministic active strategy: collect each minute, claim goals, expand when affordable, purchase unique scenery in order, upgrade to unlock; not a human playtime forecast.',fullCollectionMinutes:minute,firstPerTier:[1,2,3,4,5,6].map(t=>events.find(x=>x.tier===t)),snapshots,events};
await writeFile(new URL('./balance-results-v2.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({fullCollectionMinutes:minute,firstPerTier:report.firstPerTier,snapshots},null,2));
