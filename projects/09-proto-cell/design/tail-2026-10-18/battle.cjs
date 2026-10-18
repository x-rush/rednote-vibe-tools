const {chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const fs=require('node:fs'),crypto=require('node:crypto');let browser
;(async()=>{
 const {build}=await import('vite'),out='design/tail-2026-10-18',tag=process.argv[2]||'measure'
 const sourceFiles=['src/game/engine.ts','src/game/spatial-grid.ts','src/domain/membrane.ts','src/rendering/cell.ts','src/rendering/renderer.ts','src/rendering/feedback.ts','src/rendering/body-path.ts','src/app/controller.ts']
 const hashes=Object.fromEntries(sourceFiles.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]))
 const hook=`
  let qaFoodSerial = 0, qaLastFood = -Infinity;
  Object.assign(engine, {
   qaBattle(count) {
    const body = entities.get(PLAYER_ID), wall = environmentField.obstacles[0];
    const position = { x: wall.from.x + 220, y: wall.from.y + body.body.radius + 2 };
    entities.set(PLAYER_ID, moveEntity(body, position, {x:0,y:0}));
    const species = content.creatures.find(c=>c.id==='predator-chamber-maw');
    for(let n=0;n<count;n++) {
     const angle=n*2.399963, spread=body.body.radius*(4.5+Math.sqrt(n/count)*2);
     const definition={...creatureEntityDefinition(species),radius:147,mass:21609,maxSpeed:480,behaviorProfileId:'behavior-leviathan'};
     const id='qa-chaser-'+n;
     entities.set(id,createEntity(definition,{id,position:{x:position.x+Math.cos(angle)*spread,y:position.y+Math.sin(angle)*spread},spawnedAtMs:elapsedMs-5000}));
    }
   },
   qaBattleFood() {
    if(elapsedMs-qaLastFood<350)return;qaLastFood=elapsedMs;
    const body=entities.get(PLAYER_ID), living=[...entities.values()].filter(e=>e.id.startsWith('qa-meal-')&&e.status==='active').length;
    const species=content.creatures.find(c=>c.id==='creature-fiber-float'),definition={...creatureEntityDefinition(species),radius:12,mass:144};
    for(let n=living;n<8;n++) {const angle=n*2.399963,id='qa-meal-'+qaFoodSerial++;entities.set(id,createEntity(definition,{id,position:{x:body.position.x+Math.cos(angle)*body.body.radius*.4,y:body.position.y+Math.sin(angle)*body.body.radius*.4},spawnedAtMs:elapsedMs-5000}));}
   }
  });
  return engine
 `
 const result=await build({configFile:false,logLevel:'error',plugins:[{name:'qa-battle',enforce:'pre',transform(source,id){if(tag.includes('opaque')&&id.replaceAll('\\','/').endsWith('/src/rendering/renderer.ts'))return source.replace("canvas.getContext('2d')","canvas.getContext('2d',{alpha:false})");if(tag.includes('no-text')&&id.replaceAll('\\','/').endsWith('/src/rendering/renderer.ts'))return source.replace('numbers.draw(context, width, height, snapshot.elapsedMs)','');if(tag.includes('no-ring')&&id.replaceAll('\\','/').endsWith('/src/rendering/renderer.ts'))return source.replace(/drawDangerTelegraph\(context, item.entity,[^\n]+\)/,'');if(tag==='before'&&id.replaceAll('\\','/').endsWith('/src/game/spatial-grid.ts'))return fs.readFileSync(out+'/grid-before.ts','utf8');if(id.replaceAll('\\','/').endsWith('/src/game/engine.ts'))return source.replace(/\r\n/g,'\n').replace("const journeyEnabled = (options.environmentId ?? 'env-clear-drop') === 'env-clear-drop'","const journeyEnabled = true /* QA-only seeded late battle */").replace("protectedPreyId: journeyEnabled && lifecycle.tierIndex === 2 && entities.get('encounter-2')?.behaviorState !== 'recover' ? 'encounter-2' : undefined,",'protectedPreyId: PLAYER_ID, /* QA survival only */').replace('function currentMembraneMax(): number {','function currentMembraneMax(): number { return 1e8; /* QA survival budget */').replace('  return engine\n',hook)}}],build:{write:false,minify:!process.argv.includes('--profile'),lib:{entry:out+(tag.includes('events')?'/events-fixture.ts':'/battle-fixture.ts'),name:'BattleQA',formats:['iife']}}})
 const code=(Array.isArray(result)?result[0]:result).output.find(c=>c.type==='chunk').code
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'})
 const cases=[],errors=[]
 fs.writeFileSync(out+'/bundle-'+tag+'.js.txt',code); if(process.argv.includes('--compile-only')){await browser.close();return}
 for(const throttle of (process.argv.includes('--profile')?[6]:[4,6]))for(const catchUp of (process.argv.includes('--profile')?[false]:[false,true])){
  if(process.argv.includes('--single')&&(throttle!==4||catchUp))continue;
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});page.on('pageerror',e=>errors.push(e.message))
  await page.route('**/__qa_battle',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><style>html,body{margin:0}canvas{display:block;width:390px;height:844px}</style><canvas></canvas>'}));await page.goto('http://127.0.0.1:4110/__qa_battle');await page.addScriptTag({content:code})
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:throttle})
  if(process.argv.includes('--profile')){await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:500});await cdp.send('Profiler.start')}
  const sample=await page.evaluate(a=>window.battle(a),{count:120,frames:tag.includes('combined')?300:180,catchUp,mature:tag.includes('combined')});if(process.argv.includes('--profile')){const profile=await cdp.send('Profiler.stop');fs.writeFileSync(out+'/profile-'+tag+'.json',JSON.stringify(profile.profile))}cases.push({throttle,...sample});console.log(JSON.stringify({...cases.at(-1),frameData:undefined}));await page.screenshot({path:out+'/'+tag+'-'+throttle+'-'+catchUp+'.png'});await page.close()
 }
 await browser.close();fs.writeFileSync(out+'/battle-'+tag+'.json',JSON.stringify({sourceHashes:hashes,bundleHash:crypto.createHash('sha256').update(code).digest('hex'),method:'QA initial late state and 120 real source AI chasers at radius147, food replenishment and membrane protection; real terrain breaks/engulfs. No renderer-only clones. Fixed step and actual RAF catch-up separate; source compiled in memory; not normalplaythrough or physical phone.',cases,errors},null,2));if(errors.length)throw Error(errors)
})().catch(async e=>{await browser?.close();console.error(e);process.exitCode=1})
