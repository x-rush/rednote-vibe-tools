import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  for(const width of [375,390,430]){
    const context=await browser.newContext({viewport:{width,height:844},hasTouch:true,isMobile:true});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/src/app.js',async route=>{
      const response=await route.fetch();
      await route.fulfill({response,body:(await response.text())+'\nwindow.__gestureAudit={get scene(){return scene},get plan(){return plan},get selected(){return selected},choose};'});
    });
    await page.goto('http://127.0.0.1:4311/');
    await page.waitForFunction(()=>window.__gestureAudit?.scene);
    await page.addStyleTag({content:':root{--safe-area-inset-top:28px;--safe-area-inset-bottom:16px}'});
    for(const mode of ['portrait','forced','natural']){
      if(mode==='forced')await page.locator('.orientation-toggle').click();
      if(mode==='natural')await page.setViewportSize({width:844,height:width});
      await page.waitForTimeout(150);
      const results=await page.evaluate(async()=>{
        const {scene:s,plan:p,choose}=window.__gestureAudit;
        const assert=(ok,message)=>{if(!ok)throw Error(message);};
        const before=JSON.stringify(p),canvas=s.renderer.domElement,host=canvas.parentElement;
        const rect=canvas.getBoundingClientRect(),x=rect.left+rect.width*.5,y=rect.top+rect.height*.5;
        const send=(type,dx=0,dy=0,id=1)=>canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:id,pointerType:'touch',button:0,buttons:type==='pointerup'?0:1,clientX:x+dx,clientY:y+dy}));
        // Synthetic pointers cannot acquire native capture; only this test page overrides capture.
        for(const el of [canvas,host]){el.setPointerCapture=()=>{};el.releasePointerCapture=()=>{};el.hasPointerCapture=()=>false;}
        const hit=s.hit.bind(s),point=s.point.bind(s),checks=[];
        const door=p.openings.find(o=>o.type==='door');
        assert(door,'Template needs a door');
        const room=p.rooms.find(r=>r.id===door.roomId);
        s.hit=()=>({object:{userData:{kind:'opening',id:door.id}},point:{x:room.x+door.offset,z:room.z}});
        choose(null);send('pointerdown');send('pointermove',40);send('pointermove');send('pointerup');
        assert(!window.__gestureAudit.selected,'Orbit returning to its start selected a door');
        assert(JSON.stringify(p)===before,'Orbit moved layout');checks.push('door-origin orbit and round-trip drag preserve layout');
        send('pointerdown');send('pointerup');assert(window.__gestureAudit.selected?.openingId===door.id,'Tap did not select door');
        s.hit=()=>null;send('pointerdown');send('pointermove',40);send('pointerup',40);
        assert(!window.__gestureAudit.selected,'Orbit retained door selection');checks.push('orbit clears prior selection');
        choose({kind:'room',id:door.roomId,openingId:door.id});
        s.hit=()=>({object:{userData:{kind:'opening',id:door.id}},point:{x:room.x+door.offset,z:room.z}});
        send('pointerdown');send('pointerdown',15,0,2);send('pointermove',35,0,2);send('pointerup',35,0,2);send('pointerup');
        assert(JSON.stringify(p)===before,'Multitouch changed layout');checks.push('multitouch cancels edits');
        s.hit=hit;s.point=point;choose(null);
        assert(s.enter(room),'Cannot enter template room');
        const route={points:[{x:s.camera.position.x+.1,z:s.camera.position.z}],index:0,last:performance.now(),travelled:0};s.walkRoute=route;
        send('pointerdown');send('pointermove',30);send('pointermove');send('pointerup');
        assert(s.walkRoute===route,'Looking cancelled or replaced walk route');
        s.stopWalking();assert(!s.walkRoute,'Stop did not clear route');s.exit();checks.push('walking look-around and stop');
        return checks;
      });
      console.log(JSON.stringify({width,mode,checks:results}));
    }
    assert.deepEqual(errors,[]);await context.close();
  }
}finally{await browser.close();}
