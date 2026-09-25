import {createRequire} from 'node:module';import {readFile,writeFile} from 'node:fs/promises';
const c=JSON.parse(await readFile(new URL('../src/content/content.json',import.meta.url),'utf8')),e=createRequire(import.meta.url)('../src/engine.js')(c),T=1800000000000,s=e.fresh(T),milestones=[];
e.act(s,{type:'starter'},T);for(const o of s.objects){let p=e.suggest(s,o.item,0,false,o.uid);if(p)e.act(s,Object.assign({type:'move',uid:o.uid},p),T);}
for(let minute=0;minute<=180;minute++){
 const now=T+minute*60000;e.act(s,{type:'collect'},now);
 for(const o of s.objects)if(e.careEligible(s,o,now))e.act(s,{type:'care',uid:o.uid,answers:c.care.steps.map(x=>x.answer)},now);
 for(const g of c.goals)if(!s.goals.includes(g.id)&&e.goalValue(s,g)>=g.target)e.act(s,{type:'goal',id:g.id},now);
 for(const q of c.quests)if(e.questReady(s,q))e.act(s,{type:'quest',id:q.id,choice:'a'},now);
 if(!(s.ground||[]).some(g=>(g.map||0)===(s.map||0)&&g.kind==='path'))e.act(s,{type:'ground',kind:'path',points:[[30,40],[40,50]]},now);
 for(const m of c.maps.slice(1))if(!e.mapIds(s).includes(m.id)&&e.level(s).value>=m.level&&s.coins>=m.price){e.act(s,{type:'unlockMap',id:m.id},now);milestones.push({map:m.name,minute,level:e.level(s).value});}
 // Player invests some earnings into two additional plants and early upgrades, then saves for land.
 if(s.objects.length<6&&s.coins>=e.price('bamboo')+200){const p=e.suggest(s,'bamboo',1,false);if(p)e.act(s,Object.assign({type:'buy',item:'bamboo'},p),now);}
 for(const o of s.objects)if(o.item==='bamboo'&&o.level<3&&s.coins>=e.upgradeCost(o)+400)e.act(s,{type:'upgrade',uid:o.uid},now);
 if(e.mapIds(s).length===3)break;
}
const report={scenario:'Simulated active play: collect each minute, care eligible plants, claim available goals and visitor rewards, modest early purchases/upgrades, save remaining coins for maps. Not a human playtime promise.',milestones,rate:e.rate(s),coins:s.coins,level:e.level(s).value};await writeFile(new URL('./balance-results-v6.json',import.meta.url),JSON.stringify(report,null,2));console.log(report);
