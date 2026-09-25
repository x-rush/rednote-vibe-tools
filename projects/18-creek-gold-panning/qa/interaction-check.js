qaAction('QA 完整淘洗',async b=>{
 const app=document.getElementById('app'),sleep=ms=>new Promise(r=>setTimeout(r,ms)),w=innerWidth,h=innerHeight,p={x:w*.5,y:h>w?h*.54:h*.55,r:Math.min(w*.43,h*.33),sy:.77};let id=6300;
 const ev=(type,x,y)=>app.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:id,pointerType:'touch',button:0,buttons:type==='pointerup'?0:1,clientX:x,clientY:y}));
 if(app.dataset.stage!=='shore'){b.textContent='需正常选砂入口';return;}
 b.textContent='取砂';ev('pointerdown',p.x-40,p.y);for(let j=0;j<24;j++){ev('pointermove',p.x-40+j*5,p.y);await sleep(20);}ev('pointerup',p.x+75,p.y);await sleep(1700);
 const dip=async first=>{id++;const y=first?p.y:p.y-p.r*p.sy*.82;ev('pointerdown',p.x,y);ev('pointermove',p.x,y+w*.24);await sleep(1200);ev('pointerup',p.x,y+w*.24);await sleep(700);};await dip(true);
 for(let cycle=0;cycle<12&&app.dataset.stage==='wash';cycle++){
 b.textContent='第 '+(cycle+1)+' 轮分层';if(cycle>0)await dip(false);id++;const radius=p.r*.5;ev('pointerdown',p.x+radius,p.y);
 for(let j=1;j<=360&&app.dataset.stage==='wash';j++){const a=j*.045;ev('pointermove',p.x+Math.cos(a)*radius,p.y+Math.sin(a)*radius*p.sy);await sleep(20);}ev('pointerup',p.x+radius,p.y);await sleep(550);
 b.textContent='第 '+(cycle+1)+' 轮倾洗';id++;const y=p.y+p.r*p.sy*.8;ev('pointerdown',p.x,y);ev('pointermove',p.x,y+8+p.r*.59);for(let j=0;j<220&&app.dataset.stage==='wash';j++)await sleep(20);ev('pointerup',p.x,y+8+p.r*.59);await sleep(500);
 }
 b.textContent='正常淘洗结果：'+app.dataset.stage;
});
