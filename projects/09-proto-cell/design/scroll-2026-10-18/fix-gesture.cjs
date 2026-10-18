const fs=require('node:fs'),p='design/scroll-2026-10-18/scroll.cjs';let s=fs.readFileSync(p,'utf8');const a=s.indexOf("  const cdp=await page.context().newCDPSession(page);"),b=s.indexOf('  await page.waitForTimeout(100);record.touch',a);s=s.slice(0,a)+`  const cdp=await page.context().newCDPSession(page)
  for(let i=0;i<3;i++){
   const x=width-12,start=Math.round(height*.82),end=Math.round(height*.18)
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:start}]})
   for(let n=1;n<=10;n++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:start+(end-start)*n/10}]});await page.waitForTimeout(24)}
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(120)
  }
`+s.slice(b);fs.writeFileSync(p,s)
