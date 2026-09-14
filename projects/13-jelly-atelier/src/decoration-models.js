import * as THREE from 'three';
import {raspberry,mintSprig,sugarStar} from './toppings.js';
import {mulberry32} from './engine.js';
const material=(color,roughness=.45)=>new THREE.MeshPhysicalMaterial({color,roughness,clearcoat:.25});
function ball(group,x,y,z,r,mat,scale=[1,1,1]){const o=new THREE.Mesh(new THREE.SphereGeometry(r,24,16),mat);o.position.set(x,y,z);o.scale.set(...scale);group.add(o);return o;}
function path(group,points,r,mat){const o=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),40,r,10,false),mat);group.add(o);return o;}
function shapeBody(group,type,mat,size=.18){const shape=new THREE.Shape();if(type==='heart'){shape.moveTo(0,-.12);shape.bezierCurveTo(-.29,.05,-.16,.26,0,.12);shape.bezierCurveTo(.16,.26,.29,.05,0,-.12);}else{for(let i=0;i<10;i++){const a=i*Math.PI/5,r=i%2?.085:.18;i?shape.lineTo(Math.sin(a)*r,Math.cos(a)*r):shape.moveTo(Math.sin(a)*r,Math.cos(a)*r);}shape.closePath();}const o=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.055,bevelEnabled:true,bevelSize:.018,bevelThickness:.014,bevelSegments:4,steps:1}),mat);o.scale.setScalar(size/.18);group.add(o);return o;}
const numerals={0:[[0,.36],[-.08,.31],[-.09,.11],[0,.05],[.09,.11],[.08,.31],[0,.36]],1:[[-.05,.29],[.02,.36],[.02,.05]],2:[[-.085,.29],[-.045,.355],[.06,.34],[.09,.27],[-.08,.055],[.09,.055]],3:[[-.075,.34],[.06,.34],[.08,.27],[0,.21],[.08,.16],[.06,.07],[-.08,.065]],4:[[.07,.055],[.07,.36],[-.09,.15],[.11,.15]],5:[[.09,.35],[-.075,.35],[-.075,.22],[.045,.22],[.095,.15],[.05,.065],[-.075,.065]],6:[[.075,.35],[-.035,.32],[-.09,.17],[-.055,.065],[.055,.06],[.09,.15],[.045,.22],[-.085,.18]],7:[[-.09,.35],[.09,.35],[-.035,.055]],8:[[0,.205],[-.085,.27],[-.04,.35],[.05,.35],[.085,.27],[0,.205],[-.09,.13],[-.04,.055],[.055,.055],[.09,.13],[0,.205]],9:[[.08,.2],[-.04,.2],[-.09,.28],[-.04,.35],[.055,.34],[.09,.25],[.065,.08],[-.055,.055]]};
export function isCandle(kind){return ['candle','spiral','number','heartCandle','starCandle','flowerCandle'].includes(kind);}
function flame(group,x,y,lit){const wick=new THREE.Mesh(new THREE.CylinderGeometry(.004,.004,.045,8),material('#403031'));wick.position.set(x,y+.015,0);group.add(wick);const f=new THREE.Group();f.position.set(x,y+.074,0);f.visible=lit;f.userData.flame=true;ball(f,0,0,0,.033,new THREE.MeshBasicMaterial({color:'#ffbf59',transparent:true,opacity:.8}),[.7,1.9,.7]);ball(f,0,-.012,0,.019,new THREE.MeshBasicMaterial({color:'#fff1bb'}),[.65,1.65,.65]);group.add(f);}
function candle(t){const group=new THREE.Group(),wax=material(t.color||'#ed789e',.52);wax.transmission=0;wax.clearcoat=.08;wax.clearcoatRoughness=.5;wax.envMapIntensity=.55;
  if(t.kind==='number'){const digits=t.digits||'0';[...digits].forEach((digit,i)=>{const x=(i-(digits.length-1)/2)*.25;path(group,numerals[digit].map(([px,y])=>[px+x,y+.16,0]),.027,wax);path(group,[[x,0,0],[x,.20,0]],.009,material('#dfcaa8'));flame(group,x,.54,t.lit!==false);});}
  else if(t.kind==='heartCandle'||t.kind==='starCandle'){const body=shapeBody(group,t.kind==='heartCandle'?'heart':'star',wax);body.position.y=.30;path(group,[[0,0,0],[0,.3,0]],.009,material('#dfcaa8'));flame(group,0,.51,t.lit!==false);}
  else if(t.kind==='flowerCandle'){path(group,[[0,0,0],[0,.3,0]],.009,material('#dfcaa8'));for(let i=0;i<6;i++){const a=i*Math.PI/3;ball(group,Math.cos(a)*.10,.31+Math.sin(a)*.10,0,.08,wax,[1,1,.55]);}ball(group,0,.31,.036,.058,material('#f5d477'));flame(group,0,.49,t.lit!==false);}
  else{const body=new THREE.Mesh(new THREE.CylinderGeometry(.038,.041,.49,24),wax);body.position.y=.245;group.add(body);const stripe=material('#fff2d8');const pts=Array.from({length:100},(_,i)=>{const a=i/99*Math.PI*10;return[Math.cos(a)*.04,.025+i/99*.44,Math.sin(a)*.04]});path(group,pts,t.kind==='spiral'?.009:.0035,stripe);flame(group,0,.50,t.lit!==false);}
  return group;
}
export function decorationModel(t,seed){
  let group=new THREE.Group();const random=mulberry32(seed);
  if(t.kind==='berry')group=raspberry(seed);else if(t.kind==='mint')group=mintSprig(seed);else if(t.kind==='gold')group=sugarStar(seed);else if(isCandle(t.kind))group=candle(t);
  else if(t.kind==='blueberry'){const mat=material('#38446c',.75);for(let i=0;i<3;i++){const x=(i-1)*.10,z=(i%2)*.10;ball(group,x,.075,z,.076,mat);const crown=new THREE.Mesh(new THREE.TorusGeometry(.016,.005,5,5),material('#252c46'));crown.rotation.x=Math.PI/2;crown.position.set(x,.145,z);group.add(crown);}}
  else if(t.kind==='cherry'){const mat=material('#a91538',.23);for(const x of [-.075,.075]){ball(group,x,.09,0,.09,mat);path(group,[[x,.16,0],[x*.5,.30,-.015],[.02,.40,0]],.004,material('#647345'));}}
  else if(t.kind==='strawberry'){
    const profile=[[.008,0],[.045,.045],[.092,.12],[.125,.20],[.115,.245],[.065,.265],[0,.26]].map(([x,y])=>new THREE.Vector2(x,y));
    const skin=new THREE.Mesh(new THREE.LatheGeometry(profile,40,Math.PI/2,Math.PI),material('#c92b42',.36));group.add(skin);
    const cut=new THREE.Shape();cut.moveTo(0,0);cut.bezierCurveTo(-.035,.015,-.14,.16,-.115,.235);cut.bezierCurveTo(-.09,.28,.09,.28,.115,.235);cut.bezierCurveTo(.14,.16,.035,.015,0,0);
    const face=new THREE.Mesh(new THREE.ShapeGeometry(cut,24),material('#ed7b80',.58));face.position.z=.002;group.add(face);
    for(let i=0;i<20;i++){const a=random()*Math.PI+Math.PI/2,h=.05+random()*.18,r=.025+h*.40;ball(group,Math.sin(a)*r,h,Math.cos(a)*r,.004,material('#e4c48b'),[.65,1.4,.65]);}
    const core=material('#f3c1aa',.7);path(group,[[0,.025,.004],[0,.12,.005],[0,.245,.004]],.008,core);
    for(const sign of [-1,1])for(let j=0;j<4;j++){const h=.075+j*.04;path(group,[[0,h,.005],[sign*.025,h+.018,.005],[sign*(.032+j*.015),h+.035,.005]],.0015,core);}
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;path(group,[[0,.26,0],[Math.cos(a)*.04,.273,Math.sin(a)*.035],[Math.cos(a)*.07,.25,Math.sin(a)*.06]],.008,material('#537c43'));}
    group.rotation.x=-.3;
  }
  else if(t.kind==='orange'){
    const slice=new THREE.Shape();slice.moveTo(-.17,0);slice.absarc(0,0,.17,Math.PI,0,true);slice.lineTo(-.17,0);const mat=material('#efa64c',.43);mat.transmission=.12;mat.thickness=.025;
    const body=new THREE.Mesh(new THREE.ExtrudeGeometry(slice,{depth:.035,bevelEnabled:true,bevelSize:.007,bevelThickness:.007,bevelSegments:3,steps:1}),mat);body.rotation.x=-Math.PI/2;body.position.y=.015;group.add(body);
    const pith=material('#f7d79a',.65);path(group,Array.from({length:25},(_,i)=>[Math.cos(i/24*Math.PI)*.17,.058,-Math.sin(i/24*Math.PI)*.17]),.004,pith);
    for(let i=1;i<7;i++){const a=i*Math.PI/7;path(group,[[0,.059,0],[Math.cos(a)*.075,.059,-Math.sin(a)*.075],[Math.cos(a)*.155,.059,-Math.sin(a)*.155]],.002,pith);}
  }
  else if(t.kind==='cream'){const mat=material('#fff4de',.67);for(let i=0;i<9;i++){const h=i/8;for(let j=0;j<7;j++){const a=j/7*Math.PI*2+h*3;ball(group,Math.cos(a)*.08*(1-h),.028+h*.19,Math.sin(a)*.08*(1-h),.053*(1-h*.78),mat);}}}
  else if(t.kind==='sprinkles'){const colors=['#f2c76a','#d990ad','#a5c8b2','#acbce3'];for(let i=0;i<22;i++){const a=random()*6.28,r=Math.sqrt(random())*.16;const stick=new THREE.Mesh(new THREE.CapsuleGeometry(.006,.025,3,6),material(colors[i%4]));stick.position.set(Math.cos(a)*r,.012,Math.sin(a)*r);stick.rotation.set(Math.PI/2,0,random()*6.28);group.add(stick);}}
  else if(t.kind==='heartCandy'){const mat=material('#df6f91',.3);mat.transmission=.25;mat.thickness=.05;const body=shapeBody(group,'heart',mat,.13);body.rotation.x=-Math.PI/2;body.position.y=.025;}
  else if(t.kind==='bear'){const mat=material('#c39560',.86);ball(group,0,.027,0,.13,mat,[1,.25,1]);for(const x of [-.09,.09])ball(group,x,.027,-.095,.049,mat,[1,.7,1]);for(const x of [-.044,.044])ball(group,x,.062,-.016,.009,material('#6c4634'));ball(group,0,.064,.033,.017,material('#e0bb88'),[1,.3,.75]);for(let i=0;i<12;i++){const a=random()*6.28,r=random()*.09;ball(group,Math.cos(a)*r,.059,Math.sin(a)*r,.0025,material('#9b704d'));}}
  else if(t.kind==='daisy'){const mat=material('#fff9e8',.58);for(let i=0;i<10;i++){const a=i*Math.PI/5,o=ball(group,Math.cos(a)*.085,.018,Math.sin(a)*.085,.06,mat,[1,.25,.45]);o.rotation.y=-a;}ball(group,0,.03,0,.048,material('#e6bc59'),[1,.55,1]);}
  else if(t.kind==='bow'){const mat=material('#e9a0b6',.46);for(const sign of [-1,1]){const loop=ball(group,sign*.084,.048,0,.087,mat,[1,.42,.72]);loop.rotation.y=sign*.35;path(group,[[sign*.025,.04,.015],[sign*.06,.025,.08],[sign*.11,.015,.13]],.025,mat);}ball(group,0,.055,0,.04,material('#d787a1'));}
  else if(t.kind==='cloud'){const mat=material('#fff5e5',.65);for(const [x,z,r] of [[-.10,0,.075],[0,-.02,.105],[.105,0,.073],[.02,.05,.085]])ball(group,x,.035,z,r,mat,[1,.48,1]);}
  else if(t.kind==='sakura'){const mat=material('#f1c1d1',.62);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const petal=ball(group,Math.cos(a)*.075,.02,Math.sin(a)*.075,.073,mat,[1,.23,.65]);petal.rotation.y=-a;}ball(group,0,.045,0,.029,material('#e2b964'),[1,.4,1]);}
  else if(t.kind==='peachSlice'){const mat=material('#f1b7a5',.48);const body=ball(group,0,.04,0,.14,mat,[1,.32,.75]);path(group,[[-.12,.057,-.02],[0,.068,-.105],[.12,.057,-.02]],.015,material('#df8291'));}
  else if(t.kind==='moon'){const mat=material('#f0d695',.53);for(let i=0;i<15;i++){const a=-Math.PI*.60+i/14*Math.PI*1.2,r=.105;ball(group,Math.cos(a)*r-.035,.033,Math.sin(a)*r,.025+.021*Math.sin(i/14*Math.PI),mat,[1,.55,1]);}}
  group.traverse(o=>{if(o.isMesh){let owner=o;while(owner&&!owner.userData.flame)owner=owner.parent;o.castShadow=!owner;o.receiveShadow=!owner;}});return group;
}
