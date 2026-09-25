/* global MoonFlow */
/* Code-drawn black mountain silhouettes, lunar albedo and mist. */
(() => {
  'use strict';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const hash=(x,y,s=37)=>{let n=Math.imul(x,374761393)+Math.imul(y,668265263)+s*1597334677;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
  function noise(x,y,s=37) {
    const ix=Math.floor(x),iy=Math.floor(y);let u=x-ix,v=y-iy;u=u*u*(3-2*u);v=v*v*(3-2*v);
    const a=hash(ix,iy,s),b=hash(ix+1,iy,s),c=hash(ix,iy+1,s),d=hash(ix+1,iy+1,s);
    return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;
  }
  const fbm=(x,y,s=37)=>noise(x,y,s)*.53+noise(x*2.03,y*2.03,s+1)*.27+noise(x*4.07,y*4.07,s+2)*.13+noise(x*8.13,y*8.13,s+3)*.07;
  const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
  function create() {
    const W=900,H=1200;
    const background=canvas(W,H), terrain=canvas(W,H), foreground=canvas(W,H);
    const c=background.getContext('2d');
    const sky=c.createLinearGradient(0,0,100,H);
    sky.addColorStop(0,'#04132d');sky.addColorStop(.45,'#163862');sky.addColorStop(1,'#0b203b');
    c.fillStyle=sky;c.fillRect(0,0,W,H);
    const halo=c.createRadialGradient(735,300,60,722,330,650);
    halo.addColorStop(0,'rgba(80,124,178,.24)');halo.addColorStop(1,'rgba(45,76,124,0)');c.fillStyle=halo;c.fillRect(0,0,W,H);
    for(let i=0;i<135;i++) {
      const x=hash(i,9)*W,y=hash(i,4)*800,r=hash(i,2)>.95?1.2:.3+hash(i,3)*.5;
      c.fillStyle=`rgba(192,219,244,${.08+hash(i,5)*.47})`;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
    }
    for(let layer=0;layer<5;layer++) {
      c.beginPath();
      for(let x=-10;x<W+10;x+=5) {
        const y=580+layer*93 - fbm(x*.005,layer*3,91)*180 - noise(x*.027,layer*2,70)*45;
        if(x===-10)c.moveTo(x,y);else c.lineTo(x,y);
      }
      c.lineTo(W,H);c.lineTo(0,H);c.closePath();
      const col=[[23,51,80],[18,43,71],[12,35,61],[9,28,48],[6,23,40]][layer];c.fillStyle=`rgb(${col})`;c.fill();
      const fog=c.createLinearGradient(0,580+layer*65,0,800+layer*100);fog.addColorStop(0,'rgba(91,125,162,0)');fog.addColorStop(.7,'rgba(78,115,153,.14)');fog.addColorStop(1,'rgba(19,43,69,0)');c.fillStyle=fog;c.fillRect(0,500,W,H-500);
    }
    const tc=terrain.getContext('2d');
    // Continuous near-black silhouettes with no rock texture or repeated terraces.
    silhouette(tc,[[-30,1090],[30,1022],[80,982],[123,988],[165,883],[213,832],[244,788],
      [265,799],[283,765],[309,775],[337,683],[359,541],[386,458],[404,449],[428,472],
      [450,484],[470,469],[493,481],[510,431],[522,364],[548,369],[574,410],[599,385],
      [620,425],[643,454],[666,461],[688,490],[709,502],[735,518],[753,506],
      [774,461],[797,421],[826,392],[851,403],[878,425],[919,469],
      [960,1240],[-30,1240]],'#08080c');
    silhouette(tc,[[915,427],[862,501],[824,526],[810,613],[778,684],[750,832],
      [700,910],[687,1062],[622,1210],[950,1240]],'#07070a');
    // A dark fractured face sits directly behind the long fall.
    silhouette(tc,[[548,704],[573,697],[612,713],[650,702],[687,722],[704,783],
      [690,852],[708,916],[680,990],[636,1028],[587,1034],[542,1062]],'#0b0c11');
    const fractures=[[570,729,559,828],[654,744,672,836],[594,801,578,903],
      [685,859,671,976],[551,921,538,1011],[629,892,616,993]];
    for(const [x1,y1,x2,y2] of fractures){tc.beginPath();tc.moveTo(x1,y1);tc.lineTo(x2,y2);
      tc.strokeStyle='rgba(92,110,135,.09)';tc.lineWidth=1;tc.stroke();}
    MoonFlow.ledges.forEach((path,i)=>drawLedge(tc,path,i));
    return {background,terrain,foreground,moon:makeMoon(),mist:makeMist()};
  }
  function silhouette(c,points,color) {
    c.beginPath();c.moveTo(...points[0]);
    for(let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i];
      c.quadraticCurveTo(a[0],a[1],(a[0]+b[0])*.5,(a[1]+b[1])*.5);
    }
    c.lineTo(...points.at(-1));c.closePath();c.fillStyle=color;c.fill();
  }
  function drawLedge(c,path,index) {
    const side=55+index*12,last=path.at(-1),bed=[];
    for(let segment=0;segment<path.length-1;segment++) {
      for(let j=0;j<12;j++) {
        const t=j/12,a=path[segment],b=path[segment+1];
        const relief=MoonFlow.rockProfile(MoonFlow.ledgeStarts[index]+segment,t);
        bed.push([a[0]+(b[0]-a[0])*t+relief[0],a[1]+(b[1]-a[1])*t+relief[1]]);
      }
    }
    bed.push(last);
    const upper=bed.map((p,i)=>[p[0]+side+Math.sin(i*.36+index)*7,p[1]-23-Math.cos(i*.51+index)*5]);
    const lower=bed.map((p,i)=>[p[0]-side+Math.cos(i*.41+index)*10,p[1]+19+Math.sin(i*.47+index)*6]);
    c.beginPath();c.moveTo(...upper[0]);
    for(const p of upper.slice(1))c.lineTo(...p);
    for(const p of lower.reverse())c.lineTo(...p);
    c.closePath();c.fillStyle=index%2?'#0e0e14':'#0b0c12';c.fill();
    c.beginPath();c.moveTo(last[0]-side,last[1]+11);c.lineTo(last[0]+side,last[1]-24);
    c.lineTo(last[0]+side-12,last[1]+47+index*13);c.lineTo(last[0]-side-21,last[1]+73+index*12);
    c.closePath();c.fillStyle='#06070b';c.fill();
    // Mineral facets near the wet groove reveal relief without texturing the whole mountain.
    for(let j=0;j<50;j++) {
      const p=bed[(j*7)%bed.length],dx=(hash(j,index)-.5)*side*1.9;
      const x=p[0]+dx,y=p[1]+(hash(j+1,index)-.5)*50;
      c.beginPath();c.moveTo(x,y);c.lineTo(x-1-hash(j+2,index)*9,y+2+hash(j+3,index)*7);
      c.strokeStyle=`rgba(96,115,140,${.055+hash(j+4,index)*.085})`;c.lineWidth=.5;c.stroke();
    }
    for(let j=0;j<bed.length-4;j+=7) {
      const a=bed[j],b=bed[j+3];
      c.beginPath();c.moveTo(...a);c.lineTo(...b);
      c.strokeStyle='rgba(139,166,195,.12)';c.lineWidth=1;c.stroke();
    }
  }
  function makeMoon() {
    const out=canvas(420,420),c=out.getContext('2d'),cx=210,cy=210,r=126;
    const halo=c.createRadialGradient(cx,cy,r*.88,cx,cy,206);
    halo.addColorStop(0,'rgba(163,199,240,.36)');halo.addColorStop(.4,'rgba(133,177,230,.13)');halo.addColorStop(1,'rgba(100,162,226,0)');c.fillStyle=halo;c.fillRect(0,0,420,420);
    const disc=canvas(256,256),dc=disc.getContext('2d'),image=dc.createImageData(256,256);
    const craters=Array.from({length:72},(_,i)=>({x:hash(i,24)*236+10,y:hash(i,25)*236+10,r:2+hash(i,26)**2*15}));
    for(let y=0;y<256;y++)for(let x=0;x<256;x++) {
      const nx=(x-128)/126,ny=(y-128)/126,rr=nx*nx+ny*ny;if(rr>1)continue;
      const large=fbm(x*.022,y*.022,84),fine=fbm(x*.16,y*.16,12);
      const maria=clamp((large-.45)*5)*.30;
      let value=242-maria*180+(fine-.5)*31;
      for(const q of craters) {const d=Math.hypot(x-q.x,y-q.y)/q.r;if(d<1.3){value-=Math.exp(-d*d*2)*18;value+=Math.exp(-(((d-.96)*7)**2))*14*(.5+(q.x-x+q.y-y)/q.r*.3);}}
      value-=Math.pow(rr,3)*13;
      const i=(y*256+x)*4;image.data[i]=value-4;image.data[i+1]=value+4;image.data[i+2]=value+13;image.data[i+3]=Math.round(clamp((1-Math.sqrt(rr))*200)*255);
    }
    dc.putImageData(image,0,0);c.drawImage(disc,cx-r,cy-r,r*2,r*2);return out;
  }
  function makeMist() {
    const out=canvas(450,160),c=out.getContext('2d'),im=c.createImageData(450,160);
    for(let y=0;y<160;y++)for(let x=0;x<450;x++) {
      const fade=Math.sin(Math.PI*x/450)*Math.sin(Math.PI*y/160)**2;
      const alpha=clamp((fbm(x*.019,y*.036,64)-.37)*2)*fade;
      const i=(y*450+x)*4;im.data[i]=125;im.data[i+1]=165;im.data[i+2]=200;im.data[i+3]=alpha*100;
    }
    c.putImageData(im,0,0);return out;
  }
  globalThis.MoonTerrain=Object.freeze({create});
})();
