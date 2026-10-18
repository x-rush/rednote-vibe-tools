const { chromium } = require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
let activeBrowser;
(async()=>{
 const root=path.resolve(__dirname,'../..');
 const buildStartedAt=new Date().toISOString();
 const sourceFiles=['src/game/engine.ts','src/rendering/renderer.ts','src/rendering/cell.ts','src/world/environments.ts','src/content/content.json','src/game/spatial-grid.ts','src/domain/membrane.ts','src/rendering/body-path.ts','src/rendering/feedback.ts'];
 const sourceHashes=Object.fromEntries(sourceFiles.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));
 const {build}=await import(require('node:url').pathToFileURL(path.join(root,'node_modules/vite/dist/node/index.js')).href);
 const buildResult=await build({root,configFile:false,plugins:[{name:'qa-later-layer-initial-state',enforce:'pre',transform(source,id){if(id.replaceAll(String.fromCharCode(92),'/').endsWith('/src/game/engine.ts'))return source.replace(/\r\n/g,'\n').replace("const journeyEnabled = (options.environmentId ?? 'env-clear-drop') === 'env-clear-drop'","const journeyEnabled = true /* QA initial-state fixture: current tier supplied directly */").replace('  return engine\n','  Object.assign(engine, { qaPopulate() { for (let n = 0; n < 179; n++) { const definition = environment.entityDefinitions[n % environment.entityDefinitions.length]; const id = `qa-population-${n}`; entities.set(id, createEntity(definition, { id, position: { x: (n % 13 + .5) / 13 * environment.width, y: (Math.floor(n / 13) + .5) / 14 * environment.height }, spawnedAtMs: elapsedMs - 5000 })); } } });\n  return engine\n')}}],logLevel:'error',build:{write:false,minify:process.argv[3]!=='profile',target:'es2020',lib:{entry:path.join(__dirname,'performance-fixture.ts'),name:'PerfFixture',formats:['iife']}}});
 const bundle=(Array.isArray(buildResult)?buildResult[0]:buildResult).output.find(x=>x.type==='chunk').code;
 const browser=activeBrowser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const cases=[], errors=[];
 for(const throttle of [1,4]) for(const tierIndex of [1,2]) for(const dense of [false,true]) {
  if(process.argv[3]==='profile' && (throttle!==4 || tierIndex!==2 || !dense))continue;
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/__qa_performance',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><style>html,body{margin:0}canvas{display:block;width:390px;height:844px}</style><canvas></canvas>'}));
  await page.goto('http://127.0.0.1:4110/__qa_performance');
  await page.addScriptTag({content:bundle});
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:throttle});
  if(throttle===4&&tierIndex===2&&dense){await cdp.send('Profiler.enable');await cdp.send('Profiler.start');}
  const result=await page.evaluate(args=>window.runFixture(args),{tierIndex,dense,frames:180});
  if(throttle===4&&tierIndex===2&&dense){const profile=await cdp.send('Profiler.stop');fs.writeFileSync(path.join(__dirname,'profile-'+(process.argv[2]||'baseline')+'.json'),JSON.stringify(profile.profile));}
  cases.push({throttle,...result}); console.log(JSON.stringify({throttle,tierIndex,dense,updateMs:result.updateMs,renderMs:result.renderMs,frameGapMs:result.frameGapMs,entities:result.engineEntities}));
  await page.close();
 }
 await browser.close();
 const output={buildStartedAt,recordedAt:new Date().toISOString(),runtime:'Installed desktop Chrome headless; 390x844 CSS px; DPR2; 1x and 4x CDP CPU throttling. Synthetic idle source fixtures at tier1/2 pressure .65 and 18s. Vite QA transform changes journeyEnabled initialization to true for the directly seeded later tier and exposes qaPopulate; ordinary simulation and renderer algorithms unchanged. Dense initializes 179 extra real environment entity definitions distributed over world, then clones renderer-only entities to 180 all-visible bodies; engine population separately recorded. Actual source compiled in memory, assets from current preview dist. Does not establish physical mobile GPU or Xiaohongshu host performance.',sourceHashes,bundleSha256:crypto.createHash('sha256').update(bundle).digest('hex'),cases,errors};
 fs.writeFileSync(path.join(__dirname,'performance-'+(process.argv[2]||'baseline')+'.json'),JSON.stringify(output,null,2));
 if(errors.length)throw Error(errors.join('\n'));
})().catch(async e=>{await activeBrowser?.close();console.error(e);process.exitCode=1});
