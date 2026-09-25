
qaAction('QA 完整一竿',async b=>{
 const canvas=document.getElementById('scene'),app=document.getElementById('app'),status=document.getElementById('status'),sleep=ms=>new Promise(r=>setTimeout(r,ms));let id=9001,held=false,netSince=0;const log=[];
 const pos=(x,y,zoom=1,cy=.5)=>{const w=innerWidth,h=innerHeight,k=Math.min(w*(w>h?.6:.94),h*.85),ox=(w>h?w*.32:w*.5)-k/2,oy=h*.54-k/2;return{x:ox+(.5+(x-.5)*zoom)*k,y:oy+(.5+(y-cy)*zoom)*k};};
 const ev=(type,q)=>canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:id,pointerType:'touch',button:0,buttons:type==='pointerup'?0:1,clientX:q.x,clientY:q.y}));
 if(app.dataset.phase!=='ready'){b.textContent='需从正常待抛竿开始';return;}
 ev('pointerdown',pos(.5,.5));ev('pointermove',pos(.5,.72));await sleep(100);ev('pointerup',pos(.5,.72));const start=Date.now();let previous='';
 while(Date.now()-start<160000){const phase=app.dataset.phase;if(phase!==previous){log.push(phase);previous=phase;b.textContent=log.join('→');}
 if(phase==='bite'){id++;const q={x:innerWidth*.5,y:innerHeight*.66};ev('pointerdown',q);ev('pointermove',{x:q.x,y:q.y-100});ev('pointerup',{x:q.x,y:q.y-100});}
 if(phase==='fight'){const letGo=/冲|过紧|松手/.test(status.textContent),q={x:innerWidth*.5,y:innerHeight*.83};if(!letGo&&!held){id++;ev('pointerdown',q);held=true;}else if(letGo&&held){ev('pointerup',q);held=false;}}
 if(phase==='net'){if(held){ev('pointerup',{x:innerWidth*.5,y:innerHeight*.83});held=false;}if(!netSince)netSince=Date.now();if(Date.now()-netSince>1800){const data=JSON.parse(localStorage.getItem('wild-pond:current')),r=data.run,w=innerWidth,h=innerHeight,k=Math.min(w*(w>h?.6:.94),h*.85),zoom=data.settings.reduced?1:1.12,cy=data.settings.reduced?.5:Math.min(.64,.5+.12*h/(2*k*1.12));id++;ev('pointerdown',pos(.28,.84,zoom,cy));ev('pointermove',pos(r.x,r.y,zoom,cy));await sleep(450);ev('pointerup',pos(r.x,r.y,zoom,cy));}}
 if(phase==='caught'){b.textContent='完整一竿通过：'+log.join('→');const report=document.createElement('output');report.textContent='正常入口，未注入阶段或缩短等待；实际指针完成抛投、提竿、收放线、抄网。';qaBox.appendChild(report);id++;ev('pointerdown',{x:innerWidth*.5,y:innerHeight*.6});ev('pointerup',{x:innerWidth*.5,y:innerHeight*.6});return;}
 if(phase==='miss'){b.textContent='本竿失败：'+document.getElementById('hint').textContent;return;}
 await sleep(80);
 }
 b.textContent='完整流程超时 '+log.join('→');
});

qaAction('QA 当前抄网',async()=>{const d=JSON.parse(localStorage.getItem('wild-pond:current'));if(d.run.phase!=='net')return;const w=innerWidth,h=innerHeight,k=Math.min(w*(w>h?.6:.94),h*.85),ox=(w>h?w*.32:w*.5)-k/2,oy=h*.54-k*.5,z=d.settings.reduced?1:1.12,cy=d.settings.reduced?.5:Math.min(.64,.5+.12*h/(2*k*1.12)),ev=(type,x,y)=>document.getElementById('scene').dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:9861,pointerType:'touch',buttons:type==='pointerup'?0:1,clientX:ox+(.5+(x-.5)*z)*k,clientY:oy+(.5+(y-cy)*z)*k}));ev('pointerdown',.28,.84);ev('pointermove',d.run.x,d.run.y);await new Promise(r=>setTimeout(r,900));ev('pointerup',d.run.x,d.run.y);});
