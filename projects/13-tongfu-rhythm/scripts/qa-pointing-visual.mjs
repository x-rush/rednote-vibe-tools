import {pathToFileURL} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE));
const browser=await chromium.launch({channel:'chrome'}),page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
let js=await readFile('release/package/app.js','utf8');
js=js.replace(/\}\)\(\);\s*$/,`window.previewPoint=function(lanes,hold,cast){cancelAnimationFrame(raf);setCharacter(cast);document.querySelector('#fighter').classList.remove('entering');document.querySelector('#countdown').hidden=true;effects=lanes.map(lane=>({start:performance.now()-40,lane,strong:false}));engine.notes.forEach(n=>n.status='done');if(hold)lanes.forEach(lane=>engine.notes.push({lane,status:'holding',time:songTime()-.15,duration:.5}));drawEffects(performance.now());};})();`);
await page.route('**/app.js',route=>route.fulfill({contentType:'application/javascript',body:js}));
await page.goto(pathToFileURL(process.cwd()+'/release/package/index.html').href);await page.click('#practice');await page.waitForSelector('#notes');
for(const width of [375,390,430]){
 await page.setViewportSize({width,height:844});await page.addStyleTag({content:'html{--safe-area-inset-top:32px;--safe-area-inset-bottom:20px}'});
 await page.evaluate(()=>window.previewPoint([1,2],true,0));
 await page.screenshot({path:`test-results/pointing-hold-${width}.png`});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
}
await page.evaluate(()=>window.previewPoint([0],false,1));await page.screenshot({path:'test-results/pointing-tap.png'});
assert.deepEqual(errors,[]);await writeFile('test-results/pointing-visual-report.json',JSON.stringify({widths:[375,390,430],safeTop:32,safeBottom:20,errors,deterministicVisualPreview:true},null,2));await browser.close();
