/* Gravity-led moonwater: straight freefall, then bends only where it meets a ledge. */
(() => {
  'use strict';
  const route=[
    [735,425,96],[735,468,96],[735,520,96],
    [703,543,112],[674,564,96],[674,617,96],[674,666,96],
    [645,686,145],[618,716,154],[618,790,154],[618,890,154],[618,1015,154],
    [570,1030,181],[520,1045,166],[468,1060,148],[468,1104,148],
    [440,1120,160],[386,1124,174],[322,1156,189],[235,1171,205],
    [120,1200,221],[-60,1230,246]
  ];
  const sections=[
    {kind:'freefall',from:0,to:2,count:72,dim:.88},
    {kind:'slope',from:2,to:4,count:58,dim:.70},
    {kind:'drop',from:4,to:6,count:63,dim:.78},
    {kind:'slope',from:6,to:8,count:64,dim:.69},
    {kind:'drop',from:8,to:11,count:142,dim:1},
    {kind:'slope',from:11,to:14,count:87,dim:.76},
    {kind:'drop',from:14,to:15,count:35,dim:.48},
    {kind:'slope',from:15,to:21,count:99,dim:.68}
  ];
  let routeLength=0;route[0][3]=0;
  for(let i=1;i<route.length;i++){
    routeLength+=Math.hypot(route[i][0]-route[i-1][0],route[i][1]-route[i-1][1]);
    route[i][3]=routeLength;
  }
  route.forEach(p=>p[3]/=routeLength);
  const pools=[4,8,11,15].map((i)=>({x:route[i][0],y:route[i][1],width:route[i][2],at:route[i][3],warm:i===15}));
  const ledges=[
    [[735,520],[703,543],[674,564]],
    [[674,666],[645,686],[618,716]],
    [[618,1015],[570,1030],[520,1045],[468,1060]],
    [[468,1104],[440,1120],[386,1124],[322,1156],[235,1171],[120,1200],[-60,1230]]
  ];
  const ledgeStarts=[2,6,11,15];
  const fallingSegments=new Set([0,1,4,5,8,9,10,14]);
  function rockProfile(segment,t) {
    const e=Math.sin(Math.PI*t);
    return [e*(2.7*Math.sin(t*6.28+segment*.8)+1.4*Math.sin(t*12.56+segment*1.4)),
      e*(6*Math.sin(t*6.28+segment*1.7)+2.5*Math.sin(t*12.56+segment*.8))];
  }
  function create(seed=38) {
    let state=seed>>>0;
    const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    const streams=[];
    function addStrand(knots,kind,dim,phase) {
      const points=[];
      for(let i=0;i<knots.length-1;i++) {
        const a=knots[i],b=knots[i+1];
        const falling=kind==='branch'||(kind==='main'&&fallingSegments.has(a[3]))||kind==='freefall'||kind==='drop';
        const steps=Math.max(2,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2.5));
        for(let j=0;j<steps;j++) {
          const t=j/steps,turn=falling?0:Math.sin(Math.PI*t);
          const bed=falling?[0,0]:rockProfile(a[3],t);
          const x=a[0]+(b[0]-a[0])*t+bed[0]+turn*Math.sin(phase+i*1.9)*1.25;
          const y=a[1]+(b[1]-a[1])*t+bed[1]+turn*Math.sin(phase+i*2.3)*1.65;
          points.push([x,y,a[2]+(b[2]-a[2])*t]);
        }
      }
      points.push(knots.at(-1).slice(0,3));
      const distances=[0];
      for(let i=1;i<points.length;i++)distances.push(distances[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
      const bright=random()<.085;
      streams.push({points,distances,length:distances.at(-1),kind,branch:kind==='branch',phase,
        delay:random()*.016,speed:10+random()*14,sway:fallingSegments.has(knots[0][3])?0:.12,
        alpha:(bright?.68:.13+random()**2*.40)*dim,width:bright?1.05:.28+random()*.50,
        bright,droplet:random()<.28});
    }
    function ribbon(from,to,count,dim,kind) {
      for(let j=0;j<count;j++) {
        const phase=random()*Math.PI*2;
        // Small uneven groups make curtains porous without changing the fall direction.
        const lane=random()-.5;
        const knots=[];
        for(let i=from;i<=to;i++) {
          const a=route[i],x=a[0]+lane*a[2];
          // The moon is round; rock lips and impact points are uneven across the curtain.
          const moonEdge=i===0?300+Math.sqrt(126**2-(x-735)**2)-425:0;
          const contact=[2,4,6,8,11,14,15].includes(i);
          const lip=contact?Math.sin(lane*29+i*1.7)*10+Math.sin(lane*61-i)*6:
            fallingSegments.has(i)||fallingSegments.has(i-1)?0:
              Math.sin(i*1.47+lane*24)*5+Math.sin(lane*48+i)*3;
          const y=a[1]+moonEdge+lip;
          knots.push([x,y,a[3],i]);
        }
        addStrand(knots,kind,dim,phase);
      }
    }
    ribbon(0,route.length-1,20,.17,'main');
    for(const section of sections)ribbon(section.from,section.to,section.count,section.dim,section.kind);
    // Detached side threads leave a real lip and descend vertically beyond the frame.
    for(const [index,count] of [[11,14],[14,13],[15,12]]) {
      const a=route[index];
      for(let j=0;j<count;j++) {
        const phase=random()*Math.PI*2;
        const x=a[0]+(random()-.45)*a[2]*1.18;
        const endY=1230+random()*65,arrival=.95+random()*.025;
        const knots=[[x,a[1],a[3],index],[x,a[1]+(endY-a[1])*.39,a[3]+(arrival-a[3])*.39,index],
          [x,a[1]+(endY-a[1])*.72,a[3]+(arrival-a[3])*.72,index],[x,endY,arrival,index]];
        addStrand(knots,'branch',.18+random()*.28,phase);
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
  globalThis.MoonFlow=Object.freeze({create,route,sections,pools,ledges,ledgeStarts,rockProfile,sampleDistance});
})();
