const {chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
const out='design/implementation-2026-10-18';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const results=[];
 for(const [width,height] of [[375,812],[390,844],[430,932],[844,390]]) {
  const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:true,deviceScaleFactor:1});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4110/');
  await page.evaluate(()=>{document.documentElement.style.setProperty('--safe-area-inset-top','44px');Date.now=()=>727});
  await page.getByRole('button').first().click(); await page.waitForTimeout(2300);
  const game=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,buttons:[...document.querySelectorAll('button')].map(e=>({text:e.getAttribute('aria-label')||e.innerText,rect:(r=>({x:r.x,y:r.y,width:r.width,height:r.height}))(e.getBoundingClientRect())})),body:document.body.innerText}));
  await page.evaluate(()=>{for(const side of ['left','right']){const e=document.createElement('div');e.dataset.hostMock=side;Object.assign(e.style,{position:'fixed',top:'48px',[side]:'8px',width:'56px',height:'56px',borderRadius:'50%',background:'#ff2753bb',border:'2px dashed white',zIndex:9999,pointerEvents:'none',display:'grid',placeItems:'center',color:'white',fontSize:'12px'});e.innerText=side==='left'?'宿主返回':'宿主操作';document.body.append(e)}});
  await page.screenshot({path:`${out}/${width}-game-host.png`});const pauseBox=await page.getByRole('button',{name:'暂停',exact:true}).boundingBox();game.pauseHit=await page.evaluate(r=>document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')?.getAttribute('aria-label')==='暂停',pauseBox);
  await page.getByRole('button',{name:'暂停',exact:true}).click();
  await page.screenshot({path:`${out}/${width}-paused-host.png`});
  const touchPage=await context.newPage();await touchPage.goto('http://127.0.0.1:4110/');await touchPage.evaluate(()=>document.documentElement.style.setProperty('--safe-area-inset-top','44px'));await touchPage.getByRole('button',{name:'开始孵化',exact:true}).click();const cdp=await context.newCDPSession(touchPage);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:width/2,y:height*.65}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:width/2+50,y:height*.65+30}]});const active=await touchPage.locator('.floating-joystick').getAttribute('data-active');await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});const cancelled=await touchPage.locator('.floating-joystick').getAttribute('data-active');results.push({width,height,game,touch:{active,cancelled},errors});
  await context.close();
 }
 fs.writeFileSync(`${out}/browser-matrix.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
