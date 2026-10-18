module.exports=function createDriver(page,mode){
 const trace=[]
 const geometry=async root=>page.locator(root).evaluate(e=>{const r=e.getBoundingClientRect();return{top:r.top,left:r.left,width:r.width,height:r.height,client:e.clientHeight,total:e.scrollHeight,scroll:e.scrollTop,overflow:getComputedStyle(e).overflowY}})
 async function point(target){return target.evaluate(e=>{
  if(e.closest('[inert]')||e.disabled||getComputedStyle(e).visibility==='hidden')return null
  const r=e.getBoundingClientRect();let a={left:Math.max(0,r.left),right:Math.min(innerWidth,r.right),top:Math.max(0,r.top),bottom:Math.min(innerHeight,r.bottom)}
  for(let p=e.parentElement;p;p=p.parentElement){const s=getComputedStyle(p);if(/hidden|auto|scroll|clip/.test(s.overflowY)){const b=p.getBoundingClientRect();a.top=Math.max(a.top,b.top);a.bottom=Math.min(a.bottom,b.bottom)}if(/hidden|auto|scroll|clip/.test(s.overflowX)){const b=p.getBoundingClientRect();a.left=Math.max(a.left,b.left);a.right=Math.min(a.right,b.right)}}
  if(a.right-a.left<4||a.bottom-a.top<6)return null
  for(const y of [(a.top+a.bottom)/2,a.top+Math.min(12,(a.bottom-a.top)/2),a.bottom-Math.min(12,(a.bottom-a.top)/2)])for(const x of [(a.left+a.right)/2,a.left+Math.min(16,(a.right-a.left)/2),a.right-Math.min(16,(a.right-a.left)/2)]){
   const hit=document.elementFromPoint(x,y);if(hit&&(hit===e||e.contains(hit)))return{x,y}
  }
  return null
 })}
 async function settle(root){
  if(mode!=='touch')return
  let previous=(await geometry(root)).scroll,stable=0
  for(let n=0;n<40&&stable<3;n++){await page.waitForTimeout(25);const now=(await geometry(root)).scroll;stable=Math.abs(now-previous)<.5?stable+1:0;previous=now}
 }
 let cdp
 async function gesture(root,direction=1){
  const g=await geometry(root),view=page.viewportSize(),x=Math.round(Math.min(view.width-8,g.left+g.width-9)),top=Math.max(114,g.top+8),bottom=Math.min(view.height-12,g.top+g.height-8)
  if(bottom-top<12)throw Error('No usable scroll track '+JSON.stringify({root,g,view}))
  const start=direction>0?bottom:top,end=direction>0?Math.max(8,top-100):Math.min(view.height-8,bottom+100)
  if(mode==='wheel'){await page.mouse.move(x,(top+bottom)/2);await page.mouse.wheel(0,direction*Math.max(120,Math.min(420,g.client*.65)));await page.waitForTimeout(65)}
  else{
   cdp??=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:start}]})
   for(let n=1;n<=10;n++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:start+(end-start)*n/10}]});await page.waitForTimeout(18)}
   for(let hold=0;hold<3;hold++){await page.waitForTimeout(40);await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:end}]})}
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(65)
  }
  await settle(root);const after=await geometry(root);trace.push({root,mode,direction,before:g.scroll,after:after.scroll});return after.scroll!==g.scroll
 }
 async function top(root){for(let n=0;n<80&&(await geometry(root)).scroll>1;n++)if(!await gesture(root,-1))break}
 async function reach(target,root){
  for(let n=0;n<100;n++){
   await settle(root);const p=await point(target);if(p)return p
   const rect=await target.boundingBox(),g=await geometry(root);if(!rect)throw Error('Missing target')
   const direction=rect.y+rect.height<Math.max(112,g.top+4)?-1:rect.y<Math.max(112,g.top+4)?-1:1
   if(!await gesture(root,direction))throw Error('Control cannot be reached '+JSON.stringify({text:await target.textContent(),debug:await target.evaluate(e=>({disabled:e.disabled,html:e.outerHTML.slice(0,200),hit:document.elementFromPoint(e.getBoundingClientRect().x+e.getBoundingClientRect().width/2,e.getBoundingClientRect().y+e.getBoundingClientRect().height/2)?.outerHTML.slice(0,180)})),rect,g}))
  }
  throw Error('Scroll attempt limit')
 }
 async function tap(target,root){const p=await reach(target,root);if(mode==='touch')await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);await page.waitForTimeout(35)}
 async function audit(root,name){
  const g=await geometry(root),height=page.viewportSize().height;if(g.height>height+2||!/auto|scroll/.test(g.overflow)&&g.total>g.client+2)throw Error('Unbounded page '+JSON.stringify({root,g}))
  await top(root)
  const controls=page.locator(root).locator('button,input,select,textarea,summary');await controls.evaluateAll(elements=>elements.forEach((e,i)=>e.dataset.reachControl=String(i)));const expected=await controls.count(),seen=new Set(),disabled=[],control=i=>page.locator(root).locator('[data-reach-control="'+i+'"]')
  for(let n=0;n<100;n++){
   const observations=await controls.evaluateAll(elements=>elements.map(e=>{
    const id=Number(e.dataset.reachControl);if(e.disabled||!e.checkVisibility())return{id,inactive:true}
    const r=e.getBoundingClientRect();let a={left:Math.max(0,r.left),right:Math.min(innerWidth,r.right),top:Math.max(0,r.top),bottom:Math.min(innerHeight,r.bottom)}
    for(let p=e.parentElement;p;p=p.parentElement){const css=getComputedStyle(p),b=p.getBoundingClientRect();if(/hidden|auto|scroll|clip/.test(css.overflowY)){a.top=Math.max(a.top,b.top);a.bottom=Math.min(a.bottom,b.bottom)}if(/hidden|auto|scroll|clip/.test(css.overflowX)){a.left=Math.max(a.left,b.left);a.right=Math.min(a.right,b.right)}}
    if(a.right-a.left<4||a.bottom-a.top<6)return{id,hit:false}
    for(const y of [(a.top+a.bottom)/2,a.top+Math.min(12,(a.bottom-a.top)/2),a.bottom-Math.min(12,(a.bottom-a.top)/2)]){const hit=document.elementFromPoint((a.left+a.right)/2,y);if(hit&&(hit===e||e.contains(hit)))return{id,hit:true}}
    return{id,hit:false}
   }))
   for(const o of observations){if(o.inactive){if(!disabled.includes(o.id))disabled.push(o.id)}else if(o.hit)seen.add(o.id)}
   const g=await geometry(root);if(g.total-g.client-g.scroll<2)break
   if(!await gesture(root)){const current=await geometry(root);if(current.total-current.client-current.scroll<=2)break;throw Error('User gesture cannot scroll '+JSON.stringify({root,g,current}))}
  }
  for(let i=0;i<expected;i++){if(seen.has(i)||disabled.includes(i))continue;if(!await control(i).count()){disabled.push(i);continue}await reach(control(i),root);seen.add(i)}
  const inactive=[...new Set(disabled)].filter(id=>!seen.has(id));const end=await geometry(root),record={name,mode,controls:expected,reachable:seen.size,disabled:inactive.length,geometry:end,gestures:trace.length};if(seen.size+inactive.length!==expected)throw Error('Missing controls')
  return record
 }
 return{tap,reach,point,gesture,top,audit,geometry,trace}
}
