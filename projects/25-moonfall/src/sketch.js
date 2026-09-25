/* global p5, MoonFlow, MoonTerrain */
(() => {
  'use strict';
  const W=900,H=1200;
  const PULLBACK_END = 3.4;
  const MOON_END = 6.5;
  const WATER_START = 7.1;
  const WATER_DURATION=16;
  const FILM_END=WATER_START+WATER_DURATION;
  const holder=document.getElementById('canvas'),scene=document.querySelector('.scene'),trigger=document.getElementById('play-surface');
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp=v=>Math.max(0,Math.min(1,v));
  const ease=v=>.5-.5*Math.cos(Math.PI*clamp(v));
  let started=false,filmTime=0,filmStartedAt=0,ready=false;
  const sketch=p=>{
    let layers,sparkle;
    const threads=MoonFlow.create(38);
    p.setup=()=>{
      p.pixelDensity(Math.min(window.devicePixelRatio||1,2));
      p.createCanvas(holder.clientWidth,holder.clientHeight).parent(holder);p.frameRate(30);
      layers=MoonTerrain.create();
      sparkle=document.createElement('canvas');sparkle.width=64;sparkle.height=64;
      const sc=sparkle.getContext('2d'),glow=sc.createRadialGradient(32,32,0,32,32,32);
      glow.addColorStop(0,'rgba(245,251,255,1)');glow.addColorStop(.11,'rgba(224,244,255,.8)');
      glow.addColorStop(.3,'rgba(165,208,255,.22)');glow.addColorStop(1,'rgba(126,183,255,0)');
      sc.fillStyle=glow;sc.fillRect(0,0,64,64);
      ready=true;scene.dataset.ready='true';
      if(reduced.matches)p.noLoop();
    };
    p.windowResized=()=>{p.resizeCanvas(holder.clientWidth,holder.clientHeight);if(reduced.matches)p.redraw();};
    p.draw=()=>{
      if(!ready)return;
      const elapsed=reduced.matches?0:(performance.now()-filmStartedAt)/1000;
      if(started&&!reduced.matches)filmTime=Math.min(FILM_END,elapsed);
      scene.dataset.filmTime=filmTime.toFixed(2);
      const back=started?ease(filmTime/PULLBACK_END):0,zoom=p.lerp(1.5,1,back);
      p.background('#04132d');p.push();
      p.translate(p.width/2,p.height/2);p.scale(p.width/W*zoom,p.height/H*zoom);p.translate(-p.lerp(563,450,back),-p.lerp(742,600,back));
      const c=p.drawingContext;
      c.drawImage(layers.background,0,0,W,H);
      mist(c,reduced.matches?0:performance.now()/1000,false);
      if (started) {
        const descent=ease((filmTime-PULLBACK_END)/(MOON_END-PULLBACK_END));
        c.drawImage(layers.moon,735-210,p.lerp(-230,300,descent)-210);
        scene.classList.toggle('has-moon',descent>.97);
      }
      c.drawImage(layers.terrain,0,0);
      if(started){const progress=clamp((filmTime-WATER_START)/WATER_DURATION);if(progress>0)drawWater(c,progress,Math.max(0,elapsed-WATER_START));scene.classList.toggle('has-flow',progress>.8);}
      c.drawImage(layers.foreground,0,0);
      mist(c,reduced.matches?0:performance.now()/1000,true);
      p.pop();
    };
    function mist(c,t,front) {
      c.save();
      if(front) {
        c.globalAlpha=.12;c.drawImage(layers.mist,-160+Math.sin(t*.042)*43,963,920,200);
        c.globalAlpha=.05;c.drawImage(layers.mist,420+Math.sin(t*.05+3)*24,801,610,178);
      }else{
        c.globalAlpha=.54;c.drawImage(layers.mist,-180+Math.sin(t*.037)*48,450,830,177);
        c.globalAlpha=.51;c.drawImage(layers.mist,-90+Math.cos(t*.029)*30,674,730,166);
        c.globalAlpha=.38;c.drawImage(layers.mist,40+Math.sin(t*.04+2)*50,840,770,165);
      }
      c.restore();
    }
    function drawWater(c,progress,time) {
      c.save();c.globalCompositeOperation='screen';c.lineCap='round';c.lineJoin='round';
      // Broad local reflection only behind the reached portion of the river.
      c.beginPath();let first=true;
      for(const a of MoonFlow.route){if(a[3]>progress)break;if(first){c.moveTo(a[0],a[1]);first=false;}else c.lineTo(a[0],a[1]);}
      c.strokeStyle='rgba(111,177,239,.012)';c.lineWidth=44;c.shadowColor='rgba(151,205,255,.2)';c.shadowBlur=20;c.stroke();c.shadowBlur=0;
      for(const strand of threads) {
        const pts=strand.points,head=progress>=.999?1:progress-strand.delay;
        let lo=0,hi=pts.length;while(lo<hi){const mid=(lo+hi)>>1;if(pts[mid][2]<=head)lo=mid+1;else hi=mid;}
        const count=lo;if(count<2)continue;
        const phase=time*.28+strand.phase;
        const stroke=(from,to,width,alpha)=>{
          c.beginPath();for(let i=from;i<to;i++){const a=pts[i],x=a[0]+Math.sin(i*.21-phase)*strand.sway,y=a[1]+Math.cos(i*.09+phase)*strand.sway*.2;if(i===from)c.moveTo(x,y);else c.lineTo(x,y);}
          c.lineWidth=width;c.strokeStyle=`rgba(212,234,255,${alpha})`;c.stroke();
        };
        if(strand.bright)stroke(0,count,5,strand.alpha*.16);
        stroke(0,count,strand.width,strand.alpha*(.61+.15*Math.sin(phase)));
        // Small points travel by arc length, so long branches do not produce fast light bars.
        if(strand.droplet){
          const amount=1+Math.floor(strand.length/370);
          for(let k=0;k<amount;k++){
            const offset=(strand.phase*.159155+k/amount)%1;
            const d=(time*strand.speed+offset*strand.length)%strand.length;
            const pt=MoonFlow.sampleDistance(strand,d);if(pt[2]>head)continue;
            const edge=clamp(d/18)*clamp((strand.length-d)/22)*clamp((head-pt[2])*50);
            const twinkle=.5+.5*Math.sin(time*(.5+strand.speed*.016)+strand.phase+k*2.4);
            const alpha=edge*(.4+.55*twinkle*twinkle);
            const radius=1.05+((strand.phase+k*1.71)%2.1)*.65;
            c.save();c.globalAlpha=alpha;
            const halo=radius*(5+twinkle*2);
            c.drawImage(sparkle,pt[0]-halo,pt[1]-halo,halo*2,halo*2);
            c.fillStyle='rgba(239,250,255,.9)';c.beginPath();c.arc(pt[0],pt[1],radius*(.72+twinkle*.18),0,Math.PI*2);c.fill();
            c.restore();
          }
        }
      }
      for(let k=0;k<MoonFlow.pools.length;k++) {
        const pool=MoonFlow.pools[k],a=clamp((progress-pool.at)*13);if(a<=0)continue;
        const glow=c.createRadialGradient(pool.x,pool.y,1,pool.x,pool.y,pool.width*.72);
        glow.addColorStop(0,`rgba(191,225,254,${a*.16})`);glow.addColorStop(1,'rgba(123,186,230,0)');c.fillStyle=glow;c.fillRect(pool.x-pool.width,pool.y-pool.width,pool.width*2,pool.width*2);
        c.save();c.globalAlpha=a*.13;c.drawImage(layers.mist,pool.x-pool.width*1.15+Math.sin(time*.3+k)*8,pool.y-30,pool.width*2.3,82);c.restore();
        if(pool.warm){
          const glint=c.createRadialGradient(pool.x,pool.y,0,pool.x,pool.y,32);
          glint.addColorStop(0,`rgba(255,248,209,${a*.7})`);glint.addColorStop(.15,`rgba(255,232,164,${a*.29})`);glint.addColorStop(1,'rgba(247,202,120,0)');
          c.fillStyle=glint;c.fillRect(pool.x-32,pool.y-32,64,64);
        }
        for(let i=0;i<47;i++) {
          const phase=(i*.618+time*(.035+(i%5)*.005))%1,angle=i*2.399+time*.022;
          const x=pool.x+Math.sin(angle)*pool.width*.55*Math.sqrt(phase),y=pool.y+Math.cos(angle)*9*phase;
          c.fillStyle=`rgba(222,244,255,${a*(1-phase)*.48})`;c.fillRect(x,y,.7+(i%3)*.45,.6);
        }
        // Spray rises briefly from each impact and fades into the valley mist.
        for(let i=0;i<8;i++) {
          const u=(i*.381+time*.07)%1,x=pool.x+Math.sin(i*4.1)*pool.width*.7*u,y=pool.y-Math.sin(u*Math.PI)*23;
          c.beginPath();c.arc(x,y,i%5===0?1.4:.6,0,Math.PI*2);c.fillStyle=`rgba(205,234,255,${a*(1-u)*.55})`;c.fill();
        }
      }
      c.restore();
    }
  };
  const artwork=new p5(sketch);
  function startFilm(){if(!ready||(started&&filmTime<FILM_END))return;started=true;filmTime=reduced.matches?FILM_END:0;filmStartedAt=performance.now();scene.classList.remove('has-flow','has-moon');trigger.setAttribute('aria-label','再次轻触画面，重放月落与流水');if(reduced.matches)artwork.redraw();else artwork.loop();}
  trigger.addEventListener('click', startFilm);
  reduced.addEventListener?.('change',e=>{if(e.matches){if(started)filmTime=FILM_END;artwork.noLoop();artwork.redraw();}else{filmStartedAt=performance.now()-filmTime*1000;artwork.loop();}});
})();
