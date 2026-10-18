import { createController } from '../../src/app/controller'
import { createGameEngine } from '../../src/game/engine'
import { createCanvasRenderer } from '../../src/rendering/renderer'
import { createNumberFeed } from '../../src/rendering/numbers'
const stats=(xs:number[])=>{const s=[...xs].sort((a,b)=>a-b);return{mean:xs.reduce((a,b)=>a+b,0)/xs.length,p50:s[Math.floor(s.length*.5)],p95:s[Math.floor(s.length*.95)],p99:s[Math.floor(s.length*.99)],max:Math.max(...s)}}
;(window as any).battle=async({count=120,frames=240,catchUp=false,mature=false}:{count:number;frames:number;catchUp:boolean;mature:boolean})=>{
 const engine=createGameEngine({seed:727,environmentId:'env-abandoned-chamber',initialElapsedMs:18000,initialLifecycle:{tierIndex:2,evolutionPressure:mature?1:.65,tierBiomass:mature?1350:0}})
 ;(engine as any).qaBattle(count)
 engine.setViewport({width:390,height:844});engine.start()
 const controller=createController({createEngine:()=>engine,nextSeed:s=>s+1,recordResult:()=>{}});controller.startRun({seed:727,originId:'origin-primal-cell'});
 for(let n=0;n<1000;n++)controller.handle({type:'organ-triggered',entityId:'player',organId:'organelle-flagellum',atMs:n})
 const canvas=document.querySelector('canvas')!,renderer=createCanvasRenderer(canvas,{quality:'balanced',visualSeed:727})
 const feed=createNumberFeed({aggregateMs:180,maxVisible:8}),times:number[]=[],updates:number[]=[],renders:number[]=[],gaps:number[]=[],pop:number[]=[]
 const eventTimes:number[]=[],frameData:any[]=[],overlapTimes:number[]=[]; const counts={engulfs:0,breaks:0,overlapFrames:0,maxChasing:0},longTasks:number[]=[]
 const observer=new PerformanceObserver(l=>l.getEntries().forEach(e=>longTasks.push(e.duration)))
 let previous=0,previousTime=0,startMs=0
 for(let frame=-30;frame<frames;frame++){
  const now:number=await new Promise(r=>requestAnimationFrame(r))
  if(frame===0){observer.observe({type:'longtask',buffered:false});startMs=engine.snapshot().elapsedMs}
  const before=engine.renderSnapshot(),p=before.entities.find(e=>e.id==='player')!;p.membrane=1e8
  ;(engine as any).qaBattleFood()
  engine.input.start({x:0,y:0});engine.input.move({x:25*Math.sin(frame/45),y:-65})
  const begin=performance.now();engine.advance(catchUp&&previousTime?Math.min(83.33,now-previousTime):1000/60)
  const afterUpdate=performance.now(),events=engine.drainEvents(),world=engine.renderSnapshot()
  for(const e of events){if(e.type==='engulfed'&&e.predatorId==='player'){counts.engulfs++;feed.push({kind:'biomass',amount:e.biomass,entityId:'player',atMs:e.atMs,chain:e.chain})}if(e.type==='terrain-broken')counts.breaks++}
  const eventStart=performance.now();
  if(events.length){if('handleMany' in controller)(controller as any).handleMany(events);else events.forEach(e=>controller.handle(e));controller.snapshot({includeEventLog:false} as any)}
  if(frame%6===0)controller.snapshot({includeEventLog:'result'} as any);if(frame>=0)eventTimes.push(performance.now()-eventStart)
  const chasing=world.entities.filter(e=>e.id.startsWith('qa-chaser-')&&['charge','telegraph','recover'].includes(e.behaviorState??'')).length
  counts.maxChasing=Math.max(counts.maxChasing,chasing)
  const overlapping=(world.environmentField.recentBreaks?.length??0)>0&&(world.recentEngulfs?.length??0)>0&&chasing>=5; if(overlapping)counts.overlapFrames++
  const drawStart=performance.now();renderer.render(world,feed);const end=performance.now()
  if(frame>=0){updates.push(afterUpdate-begin);renders.push(end-drawStart);times.push(end-begin);pop.push(world.entities.length);frameData.push({frame,atMs:world.elapsedMs,update:afterUpdate-begin,render:end-drawStart,total:end-begin,overlapping,chasing,meals:world.recentEngulfs?.length??0});if(overlapping)overlapTimes.push(end-begin);if(previous)gaps.push(now-previous)}
  previous=now;previousTime=now
 }
 await new Promise(r=>setTimeout(r,0));observer.disconnect()
 const result={count,frames,catchUp,update:stats(updates),render:stats(renders),eventHandling:stats(eventTimes),total:stats(times),frameGap:stats(gaps),population:{min:Math.min(...pop),max:Math.max(...pop)},events:counts,longTasks:{count:longTasks.length,max:Math.max(0,...longTasks)},overlap:overlapTimes.length?stats(overlapTimes):undefined,frameData,simulatedMs:engine.snapshot().elapsedMs-startMs}
 renderer.destroy();engine.destroy();return result
}
