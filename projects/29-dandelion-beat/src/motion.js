(function(root){
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
const mix=(a,b,u)=>a.map((v,i)=>v+(b[i]-v)*u);
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const unit=v=>{const l=Math.hypot(...v)||1;return v.map(n=>n/l);};
const target=[0,.86,1.25];let tempo=120,phrases=[],intro={duration:0,shots:[]};
function configure(bpm,sequence=[],opening={duration:0,shots:[]}){tempo=bpm;phrases=sequence;intro=opening;}
function track(keys,time){if(time<=keys[0][0])return keys[0][1];for(let i=1;i<keys.length;i++)if(time<=keys[i][0])return mix(keys[i-1][1],keys[i][1],smooth((time-keys[i-1][0])/(keys[i][0]-keys[i-1][0])));return keys[keys.length-1][1];}
// Cubic Hermite paths carry velocity through windup and follow-through while retaining each contact key.
function flow(keys,time){if(time<=keys[0][0])return keys[0][1];for(let i=1;i<keys.length;i++)if(time<=keys[i][0]){let a=keys[i-1],b=keys[i],before=keys[Math.max(0,i-2)],after=keys[Math.min(keys.length-1,i+1)],span=b[0]-a[0],u=(time-a[0])/span,u2=u*u,u3=u2*u;return a[1].map((v,k)=>{let m0=(b[1][k]-before[1][k])/(b[0]-before[0]),m1=(after[1][k]-v)/(after[0]-a[0]);return (2*u3-3*u2+1)*v+(u3-2*u2+u)*span*m0+(-2*u3+3*u2)*b[1][k]+(u3-u2)*span*m1;});}return keys[keys.length-1][1];}
function joint(a,b,upper,lower,hint,damping=.30){let d=b.map((v,i)=>v-a[i]),dist=Math.hypot(...d);if(dist<1e-6)return add(a,[0,upper,0]);d=d.map(v=>v/dist);let length=Math.min(dist,upper+lower-.001),along=(upper*upper-lower*lower+length*length)/(2*length),rise=Math.sqrt(Math.max(0,upper*upper-along*along));let h=hint.map((v,i)=>v-a[i]),dot=h.reduce((s,v,i)=>s+v*d[i],0);h=h.map((v,i)=>v-dot*d[i]);let hl=Math.max(damping,Math.hypot(...h));rise*=smooth(dist/.22);return a.map((v,i)=>v+d[i]*along+h[i]/hl*rise);}
// A shared orthogonal body frame keeps joint roots aligned with the garment surface.
const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function axes(p){const up=unit(p.shoulder.map((v,i)=>v-p.hip[i])),right=unit(p.right.map((v,i)=>v-up[i]*dot(p.right,up)));return {up,right,front:cross(right,up),length:Math.hypot(...p.shoulder.map((v,i)=>v-p.hip[i]))};}
function toLocal(point,p,f){let q=point.map((v,i)=>v-p.shoulder[i]);return [dot(q,f.right),dot(q,f.up)*.84/f.length,dot(q,f.front)];}
function fromLocal(q,p,f){return p.shoulder.map((v,i)=>v+f.right[i]*q[0]+f.up[i]*q[1]*f.length/.84+f.front[i]*q[2]);}
function clearBody(point,p,f,margin,head=false){let q=toLocal(point,p,f),volumes=[[[0,-.37,0],[.45,.44,.29]],[[0,-.59,.10],[.54,.34,.40]],[[0,-.80,.04],[.46,.13,.32]]];if(head)volumes.push([[0,.40,0],[.34,.38,.30]]);for(let pass=0;pass<3;pass++)for(let [center,radius]of volumes){let r=radius.map(v=>v+margin),v=q.map((n,i)=>n-center[i]),length=Math.hypot(...v.map((n,i)=>n/r[i]));if(length<1){if(length<.00001)v=[0,0,r[2]];else v=v.map(n=>n/length);q=center.map((n,i)=>n+v[i]);}}return fromLocal(q,p,f);}
function solveArms(p){let f=axes(p);p.hands=p.hands.map((hand,i)=>{let q=toLocal(hand,p,f),sign=i?1:-1,near=smooth((.12-q[1])/.15)*smooth((q[1]+.98)/.15)*(1-smooth((Math.abs(q[2])-.40)/.35));q[0]+=sign*Math.max(0,.77-sign*q[0])*near;return clearBody(fromLocal(q,p,f),p,f,.18,true);});p.elbows=p.hands.map((hand,i)=>{let reach=Math.hypot(...hand.map((v,k)=>v-p.shoulders[i][k])),hint=fromLocal([i?.80:-.80,-.32,.24],p,f),elbow=joint(p.shoulders[i],hand,Math.max(.50,reach*.52),Math.max(.50,reach*.52),hint,.70),local=toLocal(elbow,p,f),sign=i?1:-1;local[0]+=sign*Math.max(0,.70-sign*local[0]);elbow=clearBody(fromLocal(local,p,f),p,f,.14);
 return elbow;});return p;}
function separateKnees(p){let f=axes(p),delta=p.knees[1].map((v,i)=>v-p.knees[0][i]),side=dot(delta,f.right),perp=delta.map((v,i)=>v-side*f.right[i]),rest=Math.hypot(...perp);if(rest<.36){let need=Math.sqrt(.36*.36-rest*rest),push=Math.max(0,need-side)*.5;p.knees=p.knees.map((k,i)=>add(k,f.right.map(v=>v*push*(i?1:-1))));}return p;}
function attackAt(chart,t,bpm){
 const beat=60/bpm;let previousExit=-Infinity;
 for(let i=0;i<chart.length;i++){
  const a=chart[i],start=a.beat*beat;let end=start,lead=a.type==='headbutt'?1.5:a.type==='spin'?.75:.85,tail=a.type==='headbutt'?1:a.type==='spin'?.75:.52;
  if(a.type==='spin')while(i+1<chart.length&&chart[i+1].type==='spin'&&chart[i+1].beat===chart[i].beat+1){i++;end=chart[i].beat*beat;}
  const entry=Math.max(start-lead,previousExit);
  if(t>=entry&&t<=end+tail)return Object.assign({},a,{lead:start-entry,beatDuration:beat,start,end,delta:t-start,lastDelta:t-end});
  previousExit=end+tail;
 }
 return null;
}
// Each motif has planted-foot holds, passing steps and a matching centre of mass.
function motif(beat,style,flavor='',stepStyle=''){
 const cycle=((beat%4)+4)%4,rock=Math.sin(beat*Math.PI),pulse=Math.pow(Math.max(0,Math.cos(beat*Math.PI*2)),4);
 let feet=[[-.42,.15,-.6],[.52,.15,-.6]],weight=.5,yaw=rock*.25;
 if(style==='shuffle'||style==='power'){
  for(let i=0;i<2;i++){let phase=beat+i*2,u=((phase%4)+4)%4,lap=((Math.floor(phase/4)%2)+2)%2,x=i?.50:-.40,lane=stepStyle==='cross'?(i?-.62:.62):0,start=(lap?.18:-.65)+lane,end=(lap?-.65:.18)+lane,sign=i?1:-1,outer=stepStyle==='wide'?.78:stepStyle==='side'?.66:stepStyle==='cross'?-.10:Math.abs(x),inner=Math.abs(x),startX=sign*(lap?outer:inner),endX=sign*(lap?inner:outer);feet[i]=track([[0,[startX,.15,start]],[.18,[startX,.15,start]],[.62,[(startX+endX)*.5,.56,(start+end)*.5]],[1,[endX,.15,end]],[4,[endX,.15,end]]],u);}
  weight=track([[0,[.5]],[.16,[1]],[1.65,[1]],[2,[.5]],[2.16,[0]],[3.65,[0]],[4,[.5]]],cycle)[0];
 }else if(style!=='locking'&&style!=='finale'){
  feet[0]=track([[0,feet[0]],[2,feet[0]],[2.55,[.63,.32,.05]],[3,[.63,.15,.16]],[3.35,[.3,.28,-.1]],[4,feet[0]]],cycle);
  feet[1]=track([[0,feet[1]],[.55,[-.55,.32,.05]],[1,[-.55,.15,.16]],[1.35,[-.2,.28,-.1]],[2,feet[1]],[4,feet[1]]],cycle);
  weight=(1-Math.cos(cycle*Math.PI/2))*.5;
 }
 if(flavor==='side-rock'){feet[0]=track([[0,[-.42,.15,-.6]],[2,[-.42,.15,-.6]],[2.55,[-.78,.34,-.22]],[3,[-.82,.15,.12]],[3.35,[-.62,.32,-.12]],[4,[-.42,.15,-.6]]],cycle);feet[1]=track([[0,[.52,.15,-.6]],[.55,[.84,.34,-.22]],[1,[.88,.15,.12]],[1.35,[.72,.32,-.12]],[2,[.52,.15,-.6]],[4,[.52,.15,-.6]]],cycle);}
 if(flavor==='drunk-lock')feet=feet.map((p,i)=>add(p,[0,Math.pow(Math.max(0,Math.sin(beat*Math.PI/2+(i?Math.PI:0))),4)*.12,0]));
 let support=mix(feet[0],feet[1],weight);let landing=Math.pow(Math.max(0,Math.cos((beat-.10)*Math.PI*2)),6),dip=style==='locking'?.14*pulse:.075*landing+.025*(1-Math.cos(beat*Math.PI*2));if(style==='shuffle'||style==='power')dip=.095*Math.pow(Math.max(0,Math.cos((beat-1.10)*Math.PI)),8)+.02*(1-Math.cos(beat*Math.PI*2));
 let hip=[support[0]*.72,.96-dip,-.42+support[2]*.4+Math.sin(beat*Math.PI/2)*.055];
 let shoulder=[hip[0]-rock*.15,hip[1]+.84,hip[2]-.02+rock*.11];
 let hands=[[-.66+hip[0]+rock*.24,1.46+Math.sin(beat*Math.PI+.65)*.30,-.25],[.66+hip[0]-rock*.24,1.46-Math.sin(beat*Math.PI+.65)*.30,-.25]];
 if(style==='locking'){let lock=Math.sin(beat*Math.PI/2);hands=[[-.75+hip[0],1.65+.3*pulse,-.18],[.82+hip[0],1.35+.5*pulse,-.3]];yaw=lock*.55;shoulder[2]+=.10*pulse;}
 if(flavor==='arm-wave'){let wave=Math.sin(beat*Math.PI/2);hands=[add(hands[0],[.10*wave,.28*wave,-.14*Math.cos(beat*Math.PI/2)]),add(hands[1],[-.10*wave,-.28*wave,.14*Math.cos(beat*Math.PI/2)])];shoulder[2]+=.06*Math.sin(beat*Math.PI/2+.5);yaw+=.14*wave;}
 if(flavor==='drunk-lock'){let snap=Math.sin(beat*Math.PI/2);shoulder[0]+=.10*snap;hands=hands.map((p,i)=>add(p,[(i?1:-1)*.18*snap,(i?-.1:.1)*pulse,.10*snap]));}
 if(flavor==='body-roll'){let roll=beat*Math.PI/2;hip[1]-=.04*(1+Math.sin(roll-.9));shoulder=add(shoulder,[.10*Math.sin(roll),.07*Math.sin(roll+.9),.12*Math.sin(roll)]);hands=hands.map((p,i)=>add(p,[(i?1:-1)*.08*Math.cos(roll),.20*Math.sin(roll+(i?.7:-.7)),.16*Math.cos(roll)]));}
 if(flavor==='rebound'||flavor==='cross-shuffle'){let swing=Math.sin(beat*Math.PI/2);hands=hands.map((p,i)=>add(p,[(i?1:-1)*.15*swing,(i?1:-1)*.20*Math.cos(beat*Math.PI/2),-.12*swing]));shoulder[0]+=.08*swing;}
 if(style==='finale'){let charge=smooth((beat-56)/2);hip[1]-=.24*charge;shoulder[1]-=.32*charge;hands=hands.map((p,i)=>mix(p,[i?.55:-.55,1.32,-.45],charge));}
 if(style==='floorwork'){
  let entry=smooth((beat-19.5)/1),exit=1-smooth((beat-27)/1),floor=entry*exit;
  // Short six-step inspired bridge before/after power moves; one foot passes at a time.
  let u=((beat*3)%6+6)%6;
  let left=track([[0,[-.65,.15,-.8]],[1,[-.65,.15,-.8]],[1.5,[-.8,.25,.1]],[2,[-.85,.15,.2]],[3,[-.85,.15,.2]],[3.5,[-.25,.24,.45]],[4,[-.15,.15,.45]],[5,[-.15,.15,.45]],[5.5,[-.55,.24,-.4]],[6,[-.65,.15,-.8]]],u);
  let right=track([[0,[.65,.15,.2]],[.5,[.3,.25,.45]],[1,[.1,.15,.45]],[2,[.1,.15,.45]],[2.5,[.6,.25,-.4]],[3,[.65,.15,-.8]],[4,[.65,.15,-.8]],[4.5,[.85,.25,.05]],[5,[.85,.15,.2]],[6,[.65,.15,.2]]],u);
  feet=feet.map((p,i)=>mix(p,add(i?right:left,[-.45,0,0]),floor));hip=mix(hip,[-.45,.85,-.72],floor);shoulder=mix(shoulder,[-.45,.62,-.2],floor);hands=hands.map((p,i)=>mix(p,[i?.03:-.93,.13,-.05],floor));yaw*=1-floor;
 }
 const standing=style==='floorwork'?1-smooth((beat-19.5)/1)*(1-smooth((beat-27)/1)):1,drift=(Math.sin(beat*Math.PI/2-.45)*.065+Math.sin(beat*Math.PI/4+.8)*.028)*standing;shoulder=add(shoulder,[drift,0,Math.sin(beat*Math.PI/2-1)*.035*standing]);hands=hands.map((p,i)=>add(p,[-drift*.55,(i?1:-1)*drift*.45,0]));yaw+=Math.sin(beat*Math.PI/2-.8)*.055*standing;
 let energy=style==='power'?1.25:1;hands=hands.map(p=>[p[0]*energy,p[1],p[2]]);
 return {hip,shoulder,hands,feet,yaw,weight,style,flavor};
}
function dance(beat){let index=0;for(let i=0;i<phrases.length;i++)if(beat>=phrases[i].beat)index=i;let item=phrases[index]||{beat:0,style:'toprock'},prev=phrases[Math.max(0,index-1)]||item;let current=motif(beat,item.style,item.flavor,item.step),prior=motif(beat,prev.style,prev.flavor,prev.step),u=smooth((beat-item.beat)/.8);let result=Object.assign({},current);for(let key of ['hip','shoulder'])result[key]=mix(prior[key],current[key],u);for(let key of ['hands','feet'])result[key]=current[key].map((p,i)=>mix(prior[key][i],p,u));result.yaw=prior.yaw+(current.yaw-prior.yaw)*u;return result;}
// Blend complete body frames, so a turn never collapses a projected shoulder axis.
function quaternion(right,up){let front=cross(right,up),m00=right[0],m01=up[0],m02=front[0],m10=right[1],m11=up[1],m12=front[1],m20=right[2],m21=up[2],m22=front[2],trace=m00+m11+m22,q;if(trace>0){let s=Math.sqrt(trace+1)*2;q=[(m21-m12)/s,(m02-m20)/s,(m10-m01)/s,s/4];}else if(m00>m11&&m00>m22){let s=Math.sqrt(1+m00-m11-m22)*2;q=[s/4,(m01+m10)/s,(m02+m20)/s,(m21-m12)/s];}else if(m11>m22){let s=Math.sqrt(1+m11-m00-m22)*2;q=[(m01+m10)/s,s/4,(m12+m21)/s,(m02-m20)/s];}else{let s=Math.sqrt(1+m22-m00-m11)*2;q=[(m02+m20)/s,(m12+m21)/s,s/4,(m10-m01)/s];}return unit(q);}
function rotateQuaternion(q,v){let xyz=q.slice(0,3),a=cross(xyz,v),b=cross(xyz,a);return v.map((n,i)=>n+2*(q[3]*a[i]+b[i]));}
function spinFrame(up,right,angle,blend,attack,step){right=unit(right.map((v,i)=>v-up[i]*dot(right,up)));let a=quaternion(right,up),beta=Math.atan2(.57,-.29),b=[0,0,Math.sin(beta/2),Math.cos(beta/2)];if(dot(a,b)<0)b=b.map(v=>-v);let q=unit(mix(a,b,blend)),edge=attack.lastDelta>.13?attack.end-attack.start+.75:-((attack.lead!=null?attack.lead:.75)),heading=(angle-Math.PI*2*Math.round(edge*Math.PI/step/(Math.PI*2)))*blend,turn=v=>[v[0]*Math.cos(heading)+v[2]*Math.sin(heading),v[1],-v[0]*Math.sin(heading)+v[2]*Math.cos(heading)];return {up:turn(rotateQuaternion(q,[0,1,0])),right:turn(rotateQuaternion(q,[1,0,0]))};}
function dancePose(t,attack){
 const beat=t*tempo/60,base=dance(beat),d=attack?attack.delta:99,spin=attack&&attack.type==='spin';
 const pulse=(lead,tail)=>attack?smooth((d+((attack.lead!=null?attack.lead:lead)))/.22)*(1-smooth((d-tail+.22)/.22)):0;
 let hip=base.hip,shoulder=base.shoulder,hands=base.hands,feet=base.feet,yaw=base.yaw;
 let strike=attack?Math.exp(-Math.pow(d/.15,2)):0,side=attack&&attack.side===1?1:0,sign=side?1:-1,approach=attack&&attack.approach;
 if(attack&&attack.type==='slap'){
  let u=pulse(.85,.52),back=attack.variant==='backhand';
  let groove=base.shoulder.map((v,i)=>v-[0,1.8,-.6][i]);
  let wind=add(add([sign*(back?.9:1.12),back?1.8:2.25,back?-.95:-.60],groove),approach?approach.wind:[0,0,0]);
  let path=flow([[-.85,hands[side]],[-.50,wind],[-.23,add([sign*1.25,back?2.02:2.53,-.12],groove)],[0,target],[.14,[-sign*.60,.69,1.38]],[.52,hands[side]]],d);
  hands[side]=mix(hands[side],path,u);hands[1-side]=add(hands[1-side],[-sign*.12*u,.18*u,-.06*u]);
  hip=add(hip,[sign*strike*.06,-strike*.12,strike*.25]);shoulder=add(shoulder,[-sign*strike*.20,-strike*.27,strike*.4]);let windFactor=smooth((d+.80)/.3)*(1-smooth((d+.18)/.18))*u;hip=add(hip,[-sign*.10*windFactor,-.04*windFactor,-.05*windFactor]);shoulder=add(shoulder,[sign*.16*windFactor,.08*windFactor,-.12*windFactor]);yaw-=sign*strike*.4;
 }
 if(attack&&attack.type==='kick'){
  let u=pulse(.85,.52),path=flow([[-.85,feet[side]],[-.36,add(add([sign*.60,.98,-.25],[base.hip[0]*.25,base.hip[1]-.96,0]),approach?approach.wind:[0,0,0])],[-.13,add([sign*.67,1.23,.1],[base.hip[0]*.15,(base.hip[1]-.96)*.6,0])],[0,target],[.14,[-sign*.45,.96,1.30]],[.52,feet[side]]],d);
  if(approach){let ground=dance((t-d-((attack.lead!=null?attack.lead:.85)))*tempo/60).feet[side],lift=smooth((d-approach.plantAt)/(-.13-approach.plantAt));path=add(mix([ground[0],.15,ground[2]],path,lift),approach.wind.map(v=>v*1.8*Math.sin(Math.PI*lift)));}
  feet[side]=mix(feet[side],path,u);let plant=dance((t-d-.45)*tempo/60).feet[1-side];feet[1-side]=mix(feet[1-side],[plant[0],.15,plant[2]],u);let support=feet[1-side];hip=mix(hip,[support[0]+(base.hip[0]-support[0])*.20,base.hip[1]-.04,base.hip[2]-.10],u);shoulder=mix(shoulder,[hip[0]+base.shoulder[0]-base.hip[0]+sign*.12,hip[1]+base.shoulder[1]-base.hip[1],base.shoulder[2]-.30],u);
  hands=hands.map((p,i)=>add(p,[(i?1:-1)*.18*u,.20*u,-.18*u]));yaw+=sign*.38*u;
 }
 let imbalance=0,weightOnPlant=0,supportSide=null,plantAt=null;
 if(approach){let u=pulse(.85,.52),spill=Math.exp(-Math.pow((d-approach.spillAt)/approach.spillWidth,2))*u,catchStep=Math.exp(-Math.pow((d-approach.catchAt)/.13,2))*u,recover=Math.exp(-Math.pow((d-.27)/.16,2))*u;imbalance=approach.lurch*spill-approach.lurch*.55*catchStep+approach.recover*recover;hip=add(hip,[imbalance*.42,-approach.dip*spill,approach.lean*spill*.3]);shoulder=add(shoulder,[imbalance,-approach.dip*spill*.8,approach.lean*spill]);
  let release=1-smooth((d-.22)/.30);if(attack.type==='slap'||attack.type==='kick'){supportSide=attack.type==='kick'?1-side:approach.lurch>0?1:0;plantAt=approach.plantAt;let lift=approach.spillAt+.02,note=t-d,start=dance((note+lift)*tempo/60).feet[supportSide],end=[start[0]+approach.lurch*.62,.15,start[2]+.10],phase=smooth((d-lift)/(plantAt-lift)),stepWeight=smooth((d-lift)/.055)*release,stepPoint=mix(start,end,phase);stepPoint[1]+=.17*Math.sin(phase*Math.PI);feet[supportSide]=mix(base.feet[supportSide],stepPoint,stepWeight);weightOnPlant=smooth((d-plantAt)/.10)*release;let load=(end[0]-hip[0])*.32*weightOnPlant;hip=add(hip,[load,-.035*weightOnPlant,0]);shoulder=add(shoulder,[load*.8,-.02*weightOnPlant,0]);}
  yaw+=approach.turn*(.30*spill+.70*weightOnPlant-.20*recover);let flailWeight=Math.exp(-Math.pow((d-approach.spillAt-.09)/approach.spillWidth,2))*u,flail=approach.flail.map(v=>v*flailWeight);hands[1-side]=add(hands[1-side],flail);if(attack.type==='kick')hands[side]=add(hands[side],flail.map(v=>v*-.55));}
 let headBlend=attack&&attack.type==='headbutt'?pulse(1.5,1):0;
 if(headBlend){let launch=track([[-1.5,shoulder],[-.85,[.25,1.25,-1.15]],[-.38,[0,2.15,-.62]],[0,[0,1.298,.666]],[.18,[0,1.12,.88]],[.50,[.15,1.18,-.1]],[1,shoulder]],d);shoulder=mix(shoulder,launch,headBlend);let u=unit(mix([0,1,0],[0,-.6,.8],smooth((d+.65)/.5)*(1-smooth((d-.18)/.45))));hip=mix(hip,shoulder.map((v,i)=>v-u[i]*.85),headBlend);yaw*=1-headBlend;let airborne=smooth((d+.65)/.20)*(1-smooth((d-.20)/.35));feet=feet.map((p,i)=>mix(p,[i?.4:-.4,.15+(hip[1]+.15)*airborne,-1.05],headBlend));hands=hands.map((p,i)=>mix(p,[i?.75:-.75,shoulder[1]-.05,shoulder[2]-.30],headBlend));}
 let step=attack&&attack.beatDuration||60/tempo,angle=spin?d*Math.PI/step:0,spineFrame=null;
 const turn=p=>[p[0]*Math.cos(angle)+p[2]*Math.sin(angle),p[1],-.45-p[0]*Math.sin(angle)+p[2]*Math.cos(angle)];
 let blend=spin?smooth((d+((attack.lead!=null?attack.lead:.75)))/.60)*(1-smooth((attack.lastDelta-.13)/.62)):0;
 if(spin){let incoming=shoulder.map((v,i)=>v-hip[i]),length=Math.hypot(...incoming);spineFrame=spinFrame(unit(incoming),[Math.cos(yaw),0,-Math.sin(yaw)],angle,blend,attack,step);hip=mix(hip,[0,1.12,-.45],blend);shoulder=add(hip,spineFrame.up.map(v=>v*(length*(1-blend)+Math.hypot(.57,.29)*blend)));hands[0]=mix(hands[0],[.10,.13,-.66],blend);hands[1]=mix(hands[1],turn([-.8,1.2,.68]),blend);feet=feet.map((p,i)=>add(mix(p,turn([0,.86,i?-1.7:1.7]),blend),[0,0,(i?-1:1)*.55*Math.sin(Math.PI*blend)]));}

 let right=spineFrame?spineFrame.right:[Math.cos(yaw),0,-Math.sin(yaw)];
 const up=unit(shoulder.map((v,i)=>v-hip[i]));right=unit(right.map((v,i)=>v-up[i]*dot(right,up)));const waist=yaw*.4*(1-blend),front=cross(right,up),hipRight=unit(right.map((v,i)=>v*Math.cos(waist)+front[i]*Math.sin(waist))),hips=[add(hip,hipRight.map(v=>v*-.19)),add(hip,hipRight.map(v=>v*.19))],shoulders=[add(shoulder,right.map(v=>v*-.36)),add(shoulder,right.map(v=>v*.36))];
 let knees=feet.map((foot,i)=>{let reach=Math.hypot(...foot.map((v,k)=>v-hips[i][k]));let knee=joint(hips[i],foot,Math.max(.53,reach*.52),Math.max(.53,reach*.52),[hips[i][0],.55,.50]);return mix(knee,add(mix(hips[i],foot,.48),[0,.17,-.1]),smooth(blend));});
 const adjusted=separateKnees(solveArms({hip,shoulder,up,right,shoulders,hands,knees}));hands=adjusted.hands;knees=adjusted.knees;let elbows=adjusted.elbows;
 const head=add(shoulder,up.map(v=>v*.40)),headContact=add(shoulder,up.map(v=>v*.73));
 const contact=!attack?null:spin?feet[(Math.round(d/step)%2+2)%2]:attack.type==='kick'?feet[side]:attack.type==='headbutt'?headContact:hands[side];
 return {hip,shoulder,shoulders,hips,hands,elbows,knees,feet,head,up,right,spin:blend,angle,strike,headContact,contact,target,attackWeight:attack?pulse(attack.type==='headbutt'?1.5:.85,attack.type==='headbutt'?1:.52):0,attackDelta:attack?attack.delta:null,attackSide:side,chestYaw:yaw,approachId:approach?approach.id:null,imbalance,weightOnPlant,supportSide,plantAt,flavor:base.flavor,style:base.style,supportWeight:base.weight,footYaw:feet.map((foot,i)=>{let air=smooth((foot[1]-.15)/.15),planted=(i?1:-1)*.12;let base=planted+(yaw*.4+(i?1:-1)*Math.sin(beat*Math.PI/2)*.24-planted)*air;if(!spin)return base;let edge=attack.lastDelta>.13?attack.end-attack.start+.75:-((attack.lead!=null?attack.lead:.75)),edgeAngle=edge*Math.PI/step+i*Math.PI,turn=angle+i*Math.PI+Math.PI*2*Math.round((base-edgeAngle)/(Math.PI*2));return base+(turn-base)*blend;}),handYaw:hands.map((_,i)=>spin?0:(i?1:-1)*Math.sin(beat*Math.PI)*.3)};
}

function localPoint(p,x,y,z){let right=unit(p.right.map((v,i)=>v-p.up[i]*p.right.reduce((n,v,j)=>n+v*p.up[j],0))),up=p.up,front=[right[1]*up[2]-right[2]*up[1],right[2]*up[0]-right[0]*up[2],right[0]*up[1]-right[1]*up[0]];return p.shoulder.map((v,i)=>v+right[i]*x+up[i]*y+front[i]*z);}
function tieAt(t){return {neck:1-smooth((t-5.7)/.45),held:smooth((t-5.7)/.45)*(1-smooth((t-6.45)/.3)),wrap:smooth((t-6.45)/1.2),knot:smooth((t-7.55)/.35),flutter:Math.sin(t*tempo/60*Math.PI*2-.6)*.06+Math.sin(t*7)*.025};}
function skeleton(p){const f=axes(p);p.up=f.up;p.right=f.right;p.hips=[add(p.hip,p.right.map(v=>v*-.19)),add(p.hip,p.right.map(v=>v*.19))];p.shoulders=[add(p.shoulder,p.right.map(v=>v*-.36)),add(p.shoulder,p.right.map(v=>v*.36))];p.knees=p.feet.map((v,i)=>{let reach=Math.hypot(...v.map((n,k)=>n-p.hips[i][k]));return joint(p.hips[i],v,Math.max(.55,reach*.52),Math.max(.55,reach*.52),[v[0],.55,.2]);});solveArms(p);separateKnees(p);p.head=add(p.shoulder,p.up.map(v=>v*.40));p.headContact=add(p.shoulder,p.up.map(v=>v*.73));return p;}

function costume(p,t,attack=null){let beat=t*tempo/60,lag=p.attackDelta===null||p.attackDelta===undefined?0:Math.exp(-Math.pow((p.attackDelta-.10)/.22,2)),lean=p.shoulder[0]-p.hip[0],turnLag=0;
 if(!p.intro&&!p.fallen&&t>=intro.duration){let prior=attack?Object.assign({},attack,{delta:attack.delta-.10,lastDelta:attack.lastDelta-.10}):null,past=dancePose(t-intro.duration-.10,prior),angle=Math.atan2(past.right[2],past.right[0])-Math.atan2(p.right[2],p.right[0]);turnLag=clamp(Math.atan2(Math.sin(angle),Math.cos(angle)),-.5,.5);}
 p.tie=tieAt(t);p.tie.flutter+=turnLag*.10;p.belly={x:Math.sin(beat*Math.PI*2-.55)*.018-lean*.055+(p.attackSide?1:-1)*lag*.016+turnLag*.10,y:Math.sin(beat*Math.PI*4-.8)*.018-lag*.025,scale:1+.018*Math.sin(beat*Math.PI*2-.8)+lag*.035,twist:turnLag*.22,hem:turnLag*.035};p.bag=t<5.25?add(p.hands[0],[0,-.33,0]):[-1.12,.25,-.55];return p;}

function pose(t,attack){
 t=Math.max(0,t);
 if(!intro.duration||t>=intro.duration){
  let p=Object.assign({},dancePose(t-intro.duration,attack),{intro:false,headTilt:0});p.headTilt=(Math.sin((t-intro.duration)*tempo/60*Math.PI/2-.8)*.07+Math.sin((t-intro.duration)*tempo/60*Math.PI+.7)*.025)*(1-p.strike)*(1-p.spin)*(attack&&attack.type==='headbutt'?0:1);
  const impact=intro.duration+((intro.fallBeat!=null?intro.fallBeat:60))*60/tempo,fall=smooth((t-impact-.1)/.65);
  if(fall){let after=t-impact,kick=.18*Math.exp(-Math.pow((after-1.28)/.09,2))+.09*Math.exp(-Math.pow((after-1.57)/.08,2));
   p.hip=mix(p.hip,[.25,.39,-.15],fall);p.shoulder=mix(p.shoulder,[-.52,.40,-.15],fall);p.right=unit(mix(p.right,[0,.38,-1],fall));
   p.hands=p.hands.map((v,i)=>mix(v,[i?-.45:-.65,.14,i?.68:-.92],fall));p.feet=p.feet.map((v,i)=>mix(v,[i?1.25:1.08,.15+kick*(i?1:.6),i?.16:-.55],fall));
   skeleton(p);p.fallen=fall;p.footYaw=p.footYaw.map(v=>v+Math.atan2(Math.sin(Math.PI/2-v),Math.cos(Math.PI/2-v))*fall);p.headTilt*=1-fall;p.spin=0;p.style='fallen';p.gag={stun:fall*(1-smooth((after-1.05)/.20)),cross:fall*smooth((after-1.05)/.20),tongue:fall*smooth((after-1.28)/.18)};
  }
  return costume(p,t,attack);
 }
 let p=dancePose(0,null),walk=1-smooth((t-3.6)/.6),stumble=Math.exp(-Math.pow((t-1.65)/.23,2));
 let dx=track([[0,[-1.6]],[.9,[-1.25]],[1.7,[-1.05]],[2.5,[-.62]],[3.3,[-.25]],[4.2,[0]]],t)[0],sway=(Math.sin(t*3.6)*.17+stumble*.16)*walk;
 let look=smooth((t-3.65)/.4)*(1-smooth((t-5.5)/.3)),bend=smooth((t-4.5)/.45)*(1-smooth((t-5.25)/.45));
 p.hip=add(p.hip,[dx+sway,-.08*walk-.19*stumble-.25*bend,0]);p.shoulder=add(p.hip,[.17*Math.sin(t*3.6+.8)*walk,.79-.1*look,.10*look+.22*bend]);
 p.right=unit([1,.09*Math.sin(t*2)*walk,Math.sin(t*1.6)*.23*walk]);
 p.hands=[[p.hip[0]-.48,1.1+.12*Math.sin(t*4),-.4],[p.hip[0]+.52+.25*stumble,1.1-.16*Math.sin(t*4)+.3*stumble,-.35]];
 p.feet=[[-.42+dx+.15*stumble,.15+Math.max(0,Math.sin(t*4.2))*.22*walk,-.6+Math.cos(t*4.2)*.24*walk],[.52+dx+.30*stumble,.15+Math.max(0,-Math.sin(t*4.2))*.22*walk,-.6-Math.cos(t*4.2)*.24*walk]];
 if(t>=4.5&&t<=5.6)p.hands[0]=track([[4.5,p.hands[0]],[5.2,[-1.12,.58,-.55]],[5.25,[-1.12,.58,-.55]],[5.6,[p.hip[0]-.48,1.1,-.4]]],t);
 skeleton(p);
 if(t>=5.6&&t<8.6){let tie=tieAt(t),q=tie.wrap;
  let left=localPoint(p,-.22-.30*Math.sin(q*Math.PI),.58,.39*Math.cos(q*Math.PI)),right=localPoint(p,.22+.30*Math.sin(q*Math.PI),.58,.39*Math.cos(q*Math.PI));
  let readyHands=[localPoint(p,-.28,-.53,.53),localPoint(p,.06,-.14,.34)];
  if(t<6.45){let u=smooth((t-6.05)/.4);left=mix(readyHands[0],left,u);right=mix(readyHands[1],right,u);}
  let take=smooth((t-5.6)/.25)*(1-smooth((t-8.05)/.55));p.hands=p.hands.map((v,i)=>mix(v,i?right:left,take));
 }
 let roll=smooth((t-8.05)/.3)*(1-smooth((t-9.5)/.4));p.shoulder[0]+=Math.sin(t*7)*.12*roll;p.shoulder[2]+=Math.cos(t*7)*.14*roll;
 let ready=dancePose(t-intro.duration,null),u=smooth((t-8.6)/1.4);
 for(let key of ['hip','shoulder','right'])p[key]=mix(p[key],ready[key],u);for(let key of ['hands','feet'])p[key]=p[key].map((v,i)=>mix(v,ready[key][i],u));
 skeleton(p);p.hands=p.hands.map((v,i)=>mix(v,ready.hands[i],u));for(let key of ['hips','shoulders','elbows','knees'])p[key]=p[key].map((v,i)=>mix(v,ready[key][i],u));
 p.footYaw=ready.footYaw.map(v=>v*u);p.handYaw=ready.handYaw.map(v=>v*u);p.headTilt=(.12*walk+.48*look)*(1-u);p.intro=true;p.style='entrance';p.contact=null;p.attackWeight=0;p.spin=0;p.strike=0;return costume(p,t);
}
function shotAt(t){let shot=intro.shots[0]||{kind:'wide',text:''};for(let item of intro.shots)if(t>=item.time)shot=item;return t<intro.duration?shot:{kind:'wide',text:''};}
function camera(t,p){
 const wide={eye:[0,Math.cos(.13)*.6+Math.sin(.13)*9.8,-Math.sin(.13)*.6+Math.cos(.13)*9.8],aim:[0,Math.cos(.13)*.6,-Math.sin(.13)*.6]};
 if(t>=intro.duration)return wide;
 const shotPose=kind=>kind==='shoes'?{eye:[p.hip[0]+.3,.48,2.7],aim:[p.hip[0],.32,-.45]}:kind==='face'?{eye:[p.head[0]+.25,2.1,3.2],aim:[p.head[0],p.head[1],p.head[2]]}:kind==='flower'?{eye:[.45,1.05,3.8],aim:[0,.72,1.25]}:kind==='wide'?wide:{eye:[.25,1.75,6.6],aim:[0,1.10,-.3]};
 let i=0;for(let j=0;j<intro.shots.length;j++)if(t>=intro.shots[j].time)i=j;
 let current=intro.shots[i],prev=intro.shots[Math.max(0,i-1)],a=shotPose(prev.kind),b=shotPose(current.kind),u=smooth((t-current.time)/(current.kind==='wide'?1.7:.55));return {eye:mix(a.eye,b.eye,u),aim:mix(a.aim,b.aim,u)};
}
const api={target,pose,attackAt,joint,configure,dance,shotAt,tieAt,camera};root.Motion=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:global);
