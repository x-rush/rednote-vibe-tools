/* Uneven luminous rivulets sharing one downhill arrival clock. */
(() => {
  'use strict';
  const route=[
    [710,282,104,0],[712,335,91,0],[703,385,78,1],[689,426,57,3],
    [661,449,78,13],[644,468,60,4],[637,497,80,3],[611,525,97,14],
    [592,550,73,7],[591,585,134,20],[580,616,112,8],[563,654,123,4],
    [553,709,141,2],[536,756,147,3],[520,793,166,6],[474,820,89,5],
    [433,842,71,10],[396,860,121,12],[348,884,97,6],[298,908,135,9],
    [280,951,113,3],[239,980,151,8],[177,1004,132,4],[113,1040,177,6],
    [43,1075,195,5],[-37,1120,225,5]
  ];
  let total=0;route[0][4]=0;
  for(let i=1;i<route.length;i++){total+=Math.hypot(route[i][0]-route[i-1][0],route[i][1]-route[i-1][1]);route[i][4]=total;}
  route.forEach(p=>p[4]/=total);
  const pools=[7,15,20].map(i=>({x:route[i][0],y:route[i][1],width:route[i][2],at:route[i][4],warm:i===15}));
  function create(seed=38) {
    let state=seed>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    const streams=[];
    function strand(knots,dim,tail=false,trim=false,branch=false) {
      const phase=random()*Math.PI*2,points=[];
      for(let i=0;i<knots.length-1;i++) {
        const a=knots[Math.max(0,i-1)],b=knots[i],c=knots[i+1],d=knots[Math.min(knots.length-1,i+2)];
        const steps=Math.max(3,Math.ceil(Math.hypot(c[0]-b[0],c[1]-b[1])/2.4));
        for(let k=0;k<steps;k++) {
          const t=k/steps,t2=t*t,t3=t2*t;
          const xy=[0,1].map(axis=>(2*t3-3*t2+1)*b[axis]+(t3-2*t2+t)*.32*(c[axis]-a[axis])+(-2*t3+3*t2)*c[axis]+(t3-t2)*.32*(d[axis]-b[axis]));
          xy[0]+=Math.sin((i+t)*9+phase)*.55;
          points.push([...xy,b[2]+(c[2]-b[2])*t]);
        }
      }
      points.push(knots.at(-1));
      const start=trim?Math.floor(random()*.10*points.length):0;
      const end=trim?Math.max(start+4,Math.floor(points.length*(.68+random()*.32))):points.length;
      const bright=random()<.14;
      const visible=points.slice(start,end),distances=[0];
      for(let i=1;i<visible.length;i++)distances.push(distances[i-1]+Math.hypot(visible[i][0]-visible[i-1][0],visible[i][1]-visible[i-1][1]));
      streams.push({points:visible,distances,length:distances.at(-1),phase,delay:random()*.021,speed:10+random()*14,sway:.15+random()*.5,
        alpha:(bright?.84:.16+random()**2*.46)*dim,width:bright?1.35:.32+random()*.56,bright,droplet:random()<.28,tail,branch});
    }
    function bundle(anchors,amount,dim=1,mode='fall') {
      for(let j=0;j<amount;j++) {
        // Unequal small clusters leave dark gaps; they are not parallel copies of a band.
        const centers=[-.4,-.16,.12,.36],lane=random()<.28?random()-.5:centers[Math.floor(random()*4)]+(random()-.5)*.115;
        const phase=random()*6.28,drift=(random()-.5)*.22,ledge=random()*21;
        const knots=anchors.map((a,i)=>{
          const u=i/(anchors.length-1),prev=anchors[Math.max(0,i-1)],next=anchors[Math.min(anchors.length-1,i+1)];
          const dx=next[0]-prev[0],dy=next[1]-prev[1],len=Math.hypot(dx,dy)||1;
          const changingLane=lane+Math.sin(u*Math.PI)*drift+Math.sin(i*.76+phase)*.035;
          const spread=changingLane*a[2];
          const lip=(Math.sin(lane*25+i*.9)*.7+Math.sin(lane*53)*.3)*a[3];
          return [a[0]+(.5+.5*Math.abs(dy)/len)*spread,
            a[1]-dx/len*spread*(mode==='surface'?.65:.3)-lip+Math.sin(u*Math.PI)*(random()-.5)*ledge,a[4]];
        });
        strand(knots,dim,random()<.20,true);
      }
    }
    bundle(route,12,.18,'surface');
    bundle(route.slice(0,5),93,.95);
    bundle(route.slice(3,9),49,.86,'surface');
    bundle(route.slice(6,11),43,.82);
    bundle(route.slice(9,16),118,.92);
    bundle(route.slice(14,21),69,.84,'surface');
    bundle(route.slice(19),73,.65,'surface');
    // Branches peel off rock lips and continue downhill beyond the visible canvas.
    for(const [index,count,reach,spread] of [[3,11,144,79],[7,14,169,101],[10,19,277,149],[14,22,225,198],[18,12,157,155]]) {
      const a=route[index];
      for(let j=0;j<count;j++) {
        const side=random()<.23?-1:1,startX=a[0]+(random()-.3)*a[2]*.7;
        const endX=startX+side*(14+random()*spread),fall=reach*(.45+random()*.55);
        const arrival=Math.min(.995,a[4]+fall/total);
        const knots=[[startX,a[1],a[4]],[startX+side*16,a[1]+fall*.19,a[4]+(arrival-a[4])*.2],
          [endX,a[1]+fall*.63,a[4]+(arrival-a[4])*.67],[endX-12-random()*30,a[1]+fall,arrival]];
        // Unequal lengths and slopes lead to separate outlets at the left or bottom edge.
        const towardLeft=random()<.55;
        while(knots.at(-1)[0]>-75 && knots.at(-1)[1]<1260) {
          const last=knots.at(-1),drop=65+random()*100;
          knots.push([last[0]-(towardLeft?65+random()*115:12+random()*56),last[1]+drop,0]);
        }
        // Retiming the entire connected branch prevents a pause at its former endpoint.
        let length=0;const distances=[0];
        for(let k=1;k<knots.length;k++){length+=Math.hypot(knots[k][0]-knots[k-1][0],knots[k][1]-knots[k-1][1]);distances.push(length);}
        const outletTime=.94+random()*.032;
        knots.forEach((p,k)=>{p[2]=a[4]+(outletTime-a[4])*distances[k]/length;});
        strand(knots,.24+random()*.28,false,false,true);
      }
    }
    return streams;
  }
  function sampleDistance(stream,distance) {
    const d=Math.max(0,Math.min(stream.length,distance));
    let lo=1,hi=stream.distances.length-1;
    while(lo<hi){const mid=(lo+hi)>>1;if(stream.distances[mid]<d)lo=mid+1;else hi=mid;}
    const a=stream.points[lo-1],b=stream.points[lo],span=stream.distances[lo]-stream.distances[lo-1];
    const t=span?(d-stream.distances[lo-1])/span:0;
    return a.map((v,i)=>v+(b[i]-v)*t);
  }
  globalThis.MoonFlow=Object.freeze({create,route,pools,sampleDistance});
})();
