import { createGameEngine } from '../../src/game/engine'
import { createCanvasRenderer } from '../../src/rendering/renderer'
import { createNumberFeed } from '../../src/rendering/numbers'
const stats=(xs:number[])=>{const s=[...xs].sort((a,b)=>a-b);return{mean:xs.reduce((a,b)=>a+b,0)/xs.length,p50:s[Math.floor(s.length*.5)],p95:s[Math.floor(s.length*.95)],max:Math.max(...s)}}
;(window as any).battle=async({count=120,frames=240,catchUp=false,mature=false}:{count:number;frames:number;catchUp:boolean;mature:boolean})=>{
 const engine=createGameEngine({seed:727,environmentId:'env-abandoned-chamber',initialElapsedMs:18000,initialLifecycle:{tierIndex:2,evolutionPressure:mature?1:.65,tierBiomass:mature?1350:0}})
 ;(engine as any).qaBattle(count)
 engine.setViewport({width:390,height:844});engine.start()
 const canvas=document.querySelector('canvas')!,renderer=createCanvasRenderer(canvas,{quality:'balanced',visualSeed:727})
 const feed=createNumberFeed({aggregateMs:180,maxVisible:8}),times:number[]=[],updates:number[]=[],renders:number[]=[],gaps:number[]=[],pop:number[]=[]
 const counts={engulfs:0,breaks:0,overlapFrames:0,maxChasing:0},longTasks:number[]=[]
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
  const chasing=world.entities.filter(e=>e.id.startsWith('qa-chaser-')&&['charge','telegraph','recover'].includes(e.behaviorState??'')).length
  counts.maxChasing=Math.max(counts.maxChasing,chasing)
  if((world.environmentField.recentBreaks?.length??0)>0&&(world.recentEngulfs?.length??0)>0&&chasing>=5)counts.overlapFrames++
  const drawStart=performance.now();renderer.render(world,feed);const end=performance.now()
  if(frame>=0){updates.push(afterUpdate-begin);renders.push(end-drawStart);times.push(end-begin);pop.push(world.entities.length);if(previous)gaps.push(now-previous)}
  previous=now;previousTime=now
 }
 await new Promise(r=>setTimeout(r,0));observer.disconnect()
 const result={count,frames,catchUp,update:stats(updates),render:stats(renders),total:stats(times),frameGap:stats(gaps),population:{min:Math.min(...pop),max:Math.max(...pop)},events:counts,longTasks:{count:longTasks.length,max:Math.max(0,...longTasks)},simulatedMs:engine.snapshot().elapsedMs-startMs}
 renderer.destroy();engine.destroy();return result
}
