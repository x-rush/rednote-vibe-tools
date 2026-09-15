import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1440,height:960},deviceScaleFactor:1});
const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1')&&!r.url().startsWith('data:'))external.push(r.url());});
await mkdir('artifacts',{recursive:true});
try{
  await page.goto(process.env.PREVIEW_URL||'http://127.0.0.1:4311',{waitUntil:'networkidle'});
  await page.waitForSelector('.furniture-card img');
  await page.screenshot({path:'artifacts/desktop.png'});
  assert.equal(await page.locator('#viewport canvas').count(),1);
  assert.equal(await page.locator('.furniture-card').count(),26);
  await page.locator('#tabs [data-action="tab-styles"]').click();
  await page.locator('[data-action="style"][data-id="modern"]').click();
  await page.waitForTimeout(300);
  const saved=()=>page.evaluate(()=>{const db=JSON.parse(localStorage.getItem('roomish-project-15-v1'));return db.plans.find(p=>p.id===db.active);});
  assert.equal((await saved()).style,'modern');
  await page.locator('[data-action="undo"]').click();await page.waitForTimeout(300);assert.equal((await saved()).style,'natural');
  await page.locator('[data-action="redo"]').click();await page.waitForTimeout(300);assert.equal((await saved()).style,'modern');
  await page.locator('[data-action="compare"]').first().click();await page.locator('[data-action="show-before"]').click();assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('before-view')),true);await page.locator('#comparison [data-action="compare"]').click();
  await page.locator('#room-nav button').first().click();
  await page.locator('#room-form input[name="measured"]').check();await page.locator('#room-form button[type="submit"]').click();await page.waitForTimeout(300);assert.equal((await saved()).rooms[0].measured,true);
  await page.locator('[data-action="inventory"]').last().click();await page.locator('.price-input').first().fill('100');await page.locator('.price-input').first().press('Tab');assert.match(await page.locator('#price-total').textContent(),/100/);await page.locator('[data-action="close-modal"]').click();
  await page.locator('[data-action="inside"]').click();assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('walking')),true);await page.screenshot({path:'artifacts/inside.png'});await page.locator('[data-action="exit-walk"]').click();
  await page.locator('[data-action="finish"]').click();assert.equal(await page.locator('#finish-card').isVisible(),true);await page.screenshot({path:'artifacts/finished.png'});
  const download=page.waitForEvent('download');await page.locator('#finish-card [data-action="capture"]').click();const file=await download;assert.match(file.suggestedFilename(),/\.png$/);await page.locator('[data-action="finish"]').click();
  await page.reload({waitUntil:'networkidle'});assert.equal((await saved()).rooms[0].measured,true);
  // Exercise actual raycast placement and pointer dragging, not just toolbar buttons.
  async function screenPoint(x,z,y=0){return page.evaluate(async({x,z,y})=>{const T=await import('./src/vendor/package/build/three.module.js'),core=await import('./src/core.js'),db=JSON.parse(localStorage.getItem('roomish-project-15-v1')),p=db.plans.find(p=>p.id===db.active),b=core.bounds(p.rooms),rect=document.querySelector('#viewport').getBoundingClientRect(),aspect=rect.width/rect.height,size=Math.max(b.w,b.d)/Math.min(1,aspect),distance=size*1.18+2,camera=new T.PerspectiveCamera(38,aspect,.05,200);camera.position.set(b.cx+distance*.76,distance*1.02,b.cz+distance*1.08);camera.lookAt(b.cx,0,b.cz);camera.updateMatrixWorld();const point=new T.Vector3(x,y,z).project(camera);return{x:rect.x+(point.x+1)*rect.width/2,y:rect.y+(1-point.y)*rect.height/2};},{x,z,y});}
  const spot=await page.evaluate(async()=>{const core=await import('./src/core.js'),catalog=await fetch('./src/content/content.json').then(r=>r.json()),db=JSON.parse(localStorage.getItem('roomish-project-15-v1')),p=db.plans.find(p=>p.id===db.active);return core.findSpot(p,catalog.furniture.find(f=>f.id==='pouf'),p.rooms[0],catalog);});
  const count=(await saved()).items.length;
  await page.locator('#tabs [data-action="tab-furniture"]').click();await page.locator('#search').fill('坐墩');await page.locator('.furniture-card').click();const drop=await screenPoint(spot.x,spot.z);await page.mouse.click(drop.x,drop.y);await page.waitForTimeout(300);assert.equal((await saved()).items.length,count+1);
  let placed=(await saved()).items.at(-1);assert.equal(placed.catalogId,'pouf');
  await page.locator('[data-action="rotate"]').click();await page.waitForTimeout(300);placed=(await saved()).items.at(-1);assert.equal(placed.angle,90);
  const dragStart=await screenPoint(placed.x,placed.z,.39);await page.mouse.move(dragStart.x,dragStart.y);await page.mouse.down();await page.mouse.move(dragStart.x+6,dragStart.y+2,{steps:6});await page.mouse.up();await page.waitForTimeout(300);const moved=(await saved()).items.at(-1);assert.ok(moved.x!==placed.x||moved.z!==placed.z,'furniture drag must move the instance');
  await page.locator('[data-action="delete"]').click();await page.waitForTimeout(300);assert.equal((await saved()).items.length,count);
  await page.locator('#tabs [data-action="tab-layouts"]').click();const roomCount=(await saved()).rooms.length;await page.locator('[data-action="add-room"]').click();await page.waitForTimeout(300);assert.equal((await saved()).rooms.length,roomCount+1);
  await page.locator('#room-form input[name="w"]').fill('3.5');await page.locator('#room-form button[type="submit"]').click();await page.waitForTimeout(300);assert.equal((await saved()).rooms.at(-1).w,3.5);
  await page.locator('[data-action="undo"]').click();await page.locator('[data-action="undo"]').click();await page.waitForTimeout(300);assert.equal((await saved()).rooms.length,roomCount);
  await page.locator('#room-nav button').first().click();await page.locator('[data-action="mode"]').click();assert.equal(await page.locator('#global-form').count(),1);
  await page.locator('[data-action="edit-opening"]').first().click();const openingCount=(await saved()).openings.length;await page.locator('#opening-form input[name="h"]').fill('0.9');await page.locator('#opening-form button[type="submit"]').click();await page.waitForTimeout(300);assert.equal((await saved()).openings.length,openingCount);assert.ok((await saved()).openings.some(o=>o.h===.9));
  await page.locator('details').filter({has:page.locator('#global-form')}).locator('summary').click();await page.locator('#global-form input[name="wallHeightMeasured"]').check();await page.locator('#global-form button[type="submit"]').click();await page.waitForTimeout(300);assert.equal((await saved()).wallHeightMeasured,true);
  await page.locator('[data-action="overview"]').click();await page.locator('[data-action="deselect"]').click();
  await page.locator('#tabs [data-action="tab-furniture"]').click();await page.locator('#search').fill('');
  const mobile=[];
  for(const width of [375,390,430]){
    await page.setViewportSize({width,height:844});
    await page.evaluate(()=>document.documentElement.style.setProperty('--safe-area-inset-top','28px'));
    await page.waitForTimeout(150);
    await page.screenshot({path:`artifacts/mobile-${width}.png`});
    const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,brand:document.querySelector('.brand').getBoundingClientRect().top,top:document.querySelector('.view-toolbar').getBoundingClientRect().top,canvas:document.querySelector('#viewport canvas').getBoundingClientRect().height}));
    assert.equal(geometry.scroll,width);assert.ok(geometry.brand>=28);assert.ok(geometry.top>=28);assert.ok(geometry.canvas>400);
    await page.locator('#mobile-launch [data-action="tab-furniture"]').click();await page.locator('#search').fill('沙发');assert.equal(await page.locator('.furniture-card').count(),2);await page.locator('.furniture-card').first().click();assert.equal(await page.locator('#placing').isVisible(),true);await page.locator('[data-action="cancel-place"]').click();
    await page.screenshot({path:`artifacts/mobile-${width}-editor.png`});
    mobile.push({width,...geometry});
  }
  await page.setViewportSize({width:1440,height:960});await page.keyboard.press('Escape');
  await page.locator('[data-action="plans"]').click();let jsonDownload=page.waitForEvent('download');await page.locator('[data-action="json"]').click();assert.match((await jsonDownload).suggestedFilename(),/\.json$/);
  const previousId=(await saved()).id;await page.locator('#modal [data-action="copy-plan"]').click();await page.waitForTimeout(300);assert.notEqual((await saved()).id,previousId);
  const importValue=await saved();importValue.name='Imported layout';importValue.image='data:image/png;base64,forbidden';await page.locator('#import-file').setInputFiles({name:'layout.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(importValue))});await page.waitForTimeout(400);assert.equal((await saved()).name,'Imported layout');assert.equal((await saved()).image,undefined);
  const importedId=(await saved()).id;await page.locator('#import-file').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{"schemaVersion":99}')});await page.waitForTimeout(250);assert.equal((await saved()).id,importedId);
  await page.locator('[data-action="finish"]').click();await page.locator('[data-action="plans"]').click();await page.locator('#modal [data-action="open-plan"]').first().click();assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('finished')),false);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  const report={passed:true,checks:['render','26 furniture assets','style changes','undo and redo','before-after','measurement','inventory pricing','walkthrough','PNG download','reload recovery','raycast furniture placement','furniture rotation','pointer drag','furniture deletion','add room','resize room','advanced mode','opening editing','wall height confirmation','375/390/430 widths','28px safe area','JSON download and import','media stripped from imports','invalid import preserves state','plan copy','open plan from showcase','no external runtime requests'],mobile,errors,external};
  await writeFile('artifacts/browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
