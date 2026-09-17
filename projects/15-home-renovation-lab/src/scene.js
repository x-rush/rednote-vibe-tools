import * as T from './vendor/package/build/three.module.js';
import { OrbitControls } from './vendor/package/examples/jsm/controls/OrbitControls.js';
import {bounds, walls, wallOpenings, roomAt, placement, itemFrom, round, clamp, walkable, canWalk, corners,validRoom} from './core.js';
import {walkingPath,entryPoint,blockedDoorItems} from './circulation.js';
import {snapFurniture,snapRoom,snapRoomEdge} from './interaction.js';
import {viewportRect} from './orientation.js';

const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:0.8,...extra});
function box(g,w,h,d,x,y,z,color,extra={}){const m=new T.Mesh(new T.BoxGeometry(w,h,d),typeof color==='object'?color:mat(color,extra));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
function cyl(g,r1,r2,h,x,y,z,color){const m=new T.Mesh(new T.CylinderGeometry(r1,r2,h,24),typeof color==='object'?color:mat(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
function orb(g,x,y,z,sx,sy,sz,color){const m=new T.Mesh(new T.SphereGeometry(1,12,8),mat(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;g.add(m);return m;}
function soft(g,w,h,d,x,y,z,color){
  const radius=Math.min(w,h,d)*0.18,shape=new T.Shape(),a=-w/2,b=-d/2;
  shape.moveTo(a+radius,b);shape.lineTo(a+w-radius,b);shape.quadraticCurveTo(a+w,b,a+w,b+radius);shape.lineTo(a+w,b+d-radius);shape.quadraticCurveTo(a+w,b+d,a+w-radius,b+d);shape.lineTo(a+radius,b+d);shape.quadraticCurveTo(a,b+d,a,b+d-radius);shape.lineTo(a,b+radius);shape.quadraticCurveTo(a,b,a+radius,b);
  const geo=new T.ExtrudeGeometry(shape,{depth:Math.max(.005,h-2*radius),bevelEnabled:true,bevelThickness:radius,bevelSize:radius*.55,bevelSegments:3,steps:1,curveSegments:5});geo.rotateX(-Math.PI/2);geo.translate(0,radius,0);
  const m=new T.Mesh(geo,mat(color));m.position.set(x,y-h/2,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;
}
export function furnitureModel(def,color=def.color){
  const g=new T.Group(),w=def.w,d=def.d,h=def.h,wood='#b7976d',dark='#51493e',cream='#eee8db';
  const legs=(height,spread=.8)=>{for(const x of [-w*spread/2,w*spread/2])for(const z of [-d*spread/2,d*spread/2])cyl(g,.028,.021,height,x,height/2,z,wood);};
    switch(def.model){
    case 'chaise':legs(.14);soft(g,w,.26,d,0,.28,0,color);soft(g,w,.43,.16,0,h-.22,-d/2+.08,color);soft(g,.12,.25,d*.72,-w/2+.06,.49,-d*.1,color);soft(g,w*.7,.12,d*.66,.03,.47,d*.1,color);soft(g,.42,.25,.15,.06,.61,-d*.32,cream);break;
    case 'sideboard':legs(.14);soft(g,w,h-.18,d,0,(h+.14)/2,0,color);for(let i=0;i<18;i++)box(g,.018,h*.64,.015,-w*.46+i*w*.92/17,h*.52,d/2+.006,wood);for(const x of [-w*.16,w*.16])cyl(g,.024,.024,.04,x,h*.63,d*.48,dark).rotation.x=Math.PI/2;break;
    case 'mirror':legs(.12);box(g,w,.03,d,0,.06,0,wood);soft(g,w,h-.1,.075,0,h/2+.05,0,color);soft(g,w-.075,h-.18,.01,0,h/2+.05,.043,mat('#bccdcc',{metalness:.65,roughness:.18}));break;
    case 'washer':soft(g,w,h,d,0,h/2,0,color);box(g,w*.9,.12,.018,0,h*.86,d/2,dark);cyl(g,w*.08,w*.08,.024,w*.28,h*.86,d/2+.015,cream).rotation.x=Math.PI/2;cyl(g,w*.33,w*.33,.035,0,h*.43,d/2+.01,dark).rotation.x=Math.PI/2;cyl(g,w*.25,w*.25,.04,0,h*.43,d/2+.025,'#879e9f').rotation.x=Math.PI/2;break;
    case 'bathtub':soft(g,w*.8,.12,d*.88,0,.09,0,cream);for(const x of [-w*.43,w*.43])soft(g,w*.14,h,d,x,h/2,0,color);for(const z of [-d*.45,d*.45])soft(g,w,h,d*.1,0,h/2,z,color);soft(g,w*.71,.04,d*.78,0,.16,0,'#b5cecb');cyl(g,.018,.018,.32,-w*.28,h+.1,-d*.33,dark);box(g,.14,.025,.025,-w*.2,h+.25,-d*.33,dark);break;
    case 'trolley':for(const y of [.16,h-.04]){soft(g,w,.045,d,0,y,0,color);for(const z of [-d*.46,d*.46])box(g,w,.07,.02,0,y+.03,z,wood);}for(const x of [-w*.44,w*.44])for(const z of [-d*.4,d*.4]){cyl(g,.015,.015,h-.1,x,h/2,z,dark);orb(g,x,.055,z,.045,.045,.035,dark);}cyl(g,.065,.065,.14,-w*.22,h+.05,0,cream);break;
    case 'sofa':
      legs(.16);soft(g,w-.07,.25,d-.04,0,.28,0,color);soft(g,w,.43,.17,0,h-.23,-d/2+.075,color);
      for(const x of [-w/2+.11,w/2-.11])soft(g,.2,.42,d,x,.48,0,color);
      {const count=w<2?2:3,seat=(w-.47)/count;for(let i=0;i<count;i++)soft(g,seat-.012,.14,d-.27,-(count-1)*seat/2+i*seat,.47,.04,color);}
      soft(g,.32,.3,.13,-w*.27,.64,-d*.15,'#a5ae92').rotation.z=.16;soft(g,.3,.28,.13,w*.25,.63,-d*.14,'#bc856b').rotation.z=-.18;break;
    case 'chair':legs(h*.43);soft(g,w,h*.16,d,0,h*.47,0,color);soft(g,w,h*.45,.09,0,h*.76,-d*.4,color);if(w>.6){for(const x of [-w*.45,w*.45])soft(g,.09,h*.2,d*.8,x,h*.65,0,wood);}break;
    case 'bed':legs(.12);soft(g,w,.24,d,0,.25,0,wood);soft(g,w,.25,d-.08,0,.45,.03,cream);soft(g,w+.02,h,.09,0,h/2,-d/2+.04,color);soft(g,w+.01,.14,d*.62,0,.6,d*.17,color);for(const x of [-w*.25,w*.25])soft(g,w*.4,.14,.39,x,.64,-d*.3,cream);box(g,w*.96,.025,.2,0,.68,d*.29,'#b98970');break;
    case 'coffee':case 'table':case 'desk':case 'bench':legs(h-.08);soft(g,w,.08,d,0,h-.04,0,color);if(def.model==='coffee'){box(g,.25,.045,.19,-.15,h+.025,.02,'#839589');cyl(g,.06,.05,.11,.2,h+.06,0,cream);}break;
    case 'round':cyl(g,w*.47,w*.47,.07,0,h-.035,0,color);cyl(g,w*.12,w*.19,h-.06,0,(h-.06)/2,0,color);break;
    case 'pouf':cyl(g,w*.48,w*.46,h,0,h/2,0,color);cyl(g,w*.46,w*.46,.035,0,h,0,color);break;
    case 'cabinet':case 'wardrobe':case 'fridge':case 'island':case 'kitchen':case 'sink':case 'tv':{
      const bh=def.model==='tv'?.43:h;
      soft(g,w,bh-.07,d,0,bh/2+.035,0,color);
      if(def.model==='tv'){box(g,w*.84,.75,.045,0,.96,-d*.08,'#323d3b');box(g,w*.78,.66,.01,0,.96,-d*.08+.026,'#687e79');box(g,.12,.19,.09,0,.51,0,dark);box(g,.4,.035,.19,0,.43,0,dark);}
      else if(def.model==='fridge'){box(g,w*.91,.015,.01,0,h*.65,d/2+.004,dark);box(g,.035,.26,.05,-w*.32,h*.43,d/2+.025,wood);box(g,.035,.2,.05,-w*.32,h*.8,d/2+.025,wood);}
      else {const n=w>1?3:2;for(let i=1;i<n;i++)box(g,.008,bh*.82,.012,-w/2+i*w/n,bh/2,d/2+.01,wood);for(let i=0;i<n;i++)box(g,.12,.025,.035,-w/2+(i+.5)*w/n,bh*.7,d/2+.025,dark);}
      if(['kitchen','island','sink'].includes(def.model)){box(g,w+.035,.055,d+.035,0,h+.012,0,cream);if(def.model==='sink'){cyl(g,.18,.13,.07,0,h+.05,0,cream);cyl(g,.13,.13,.006,0,h+.089,0,'#b1b6ac');cyl(g,.015,.015,.25,0,h+.17,-d*.3,dark);box(g,.02,.025,.16,0,h+.28,-d*.14,dark);}else if(def.model==='kitchen'){box(g,.55,.012,.4,w*.25,h+.05,0,dark);for(const x of [w*.25-.13,w*.25+.13])for(const z of [-.1,.1])cyl(g,.075,.075,.01,x,h+.06,z,'#778079');box(g,.44,.015,.35,-w*.26,h+.05,0,'#aeb5ae');}}
      break;}
    case 'shelf':
      box(g,w,h,.045,0,h/2,-d/2,color);for(const x of [-w/2,w/2])box(g,.04,h,d,x,h/2,0,color);for(let i=0;i<5;i++){const y=.04+i*(h-.08)/4;box(g,w,.035,d,0,y,0,color);if(i<4)for(let j=0;j<5;j++)box(g,.055,.19+(j%2)*.06,d*.65,-w*.35+j*.095,y+.13,0,['#859a8a','#c48c70','#ddd4ba','#607e87','#b9aa91'][j]);}break;
    case 'rug':soft(g,w,Math.max(.012,h),d,0,.022,0,color);break;
    case 'plant':
      cyl(g,w*.28,w*.21,h*.23,0,h*.115,0,'#d3c5af');cyl(g,w*.245,w*.245,.01,0,h*.23,0,'#625649');cyl(g,.024,.035,h*.57,0,h*.48,0,wood);
      for(let i=0;i<11;i++){const a=i*2.4;orb(g,Math.cos(a)*w*.21,h*.5+i*h*.036,Math.sin(a)*w*.21,w*.25,h*.12,w*.22,i%2?color:'#667d5e');}break;
    case 'lamp':cyl(g,w*.37,w*.4,.04,0,.025,0,dark);cyl(g,.023,.023,h*.84,0,h*.44,0,wood);cyl(g,w*.18,w*.5,h*.18,0,h*.86,0,color);cyl(g,w*.44,w*.44,.008,0,h*.775,0,mat('#ffddb0',{emissive:'#ffbb63',emissiveIntensity:.5}));break;
    case 'art':box(g,w,h,d,0,h/2,0,wood);box(g,w*.86,h*.91,.015,0,h/2,d/2+.01,cream);orb(g,-w*.14,h*.58,d/2+.025,w*.22,h*.24,.014,color);orb(g,w*.14,h*.37,d/2+.05,w*.25,h*.17,.015,'#8b9b83');break;
    case 'toilet':soft(g,w*.7,h*.62,d*.29,0,h*.59,-d*.35,cream);cyl(g,w*.34,w*.24,h*.43,0,h*.23,d*.13,cream);const seat=cyl(g,w*.48,w*.46,.07,0,h*.49,d*.09,cream);seat.scale.z=1.32;cyl(g,w*.27,w*.27,.006,0,h*.54,d*.12,'#aeb4af');break;
    case 'shower':box(g,w,.07,d,0,.035,0,cream);for(const x of [-w/2,w/2]){box(g,.025,h,.025,x,h/2,-d/2,dark);box(g,.018,h,d,x,h/2,0,mat(color,{transparent:true,opacity:.24,depthWrite:false}));}box(g,w,h,.015,0,h/2,-d/2,mat(color,{transparent:true,opacity:.24,depthWrite:false}));cyl(g,.015,.015,h*.7,0,h*.5,-d*.44,dark);cyl(g,.1,.1,.025,0,h*.86,-d*.28,dark);break;
  }
  finishFurniture(g,def,color);
  return g;
}
function finishFurniture(group,def,color){
  const upholstered=['sofa','chair','bed','pouf','rug'].includes(def.model),wooden=['coffee','table','desk','bench','cabinet','wardrobe','shelf','round','tv'].includes(def.model);
  const base=new T.Color(color).getHex(),wood=new T.Color('#b7976d').getHex(),cream=new T.Color('#eee8db').getHex();let clothMap,woodMap;
  function makeTexture(kind){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,128,128);let seed=19;const rand=()=>{seed=seed*16807%2147483647;return seed/2147483647;};
    if(kind==='cloth'){for(let i=0;i<128;i+=4){ctx.fillStyle='rgba(60,52,42,.08)';ctx.fillRect(i,0,1,128);ctx.fillStyle='rgba(70,60,50,.05)';ctx.fillRect(0,i,128,1);}for(let i=0;i<700;i++){ctx.fillStyle='rgba(40,36,30,.04)';ctx.fillRect(rand()*128,rand()*128,1,1);}}
    else{for(let i=0;i<40;i++){const y=rand()*128;ctx.strokeStyle='rgba(80,58,32,'+(.025+rand()*.07)+')';ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(0,y);ctx.bezierCurveTo(35,y+rand()*6,85,y-rand()*6,128,y);ctx.stroke();}}
    const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(kind==='cloth'?5:2,kind==='cloth'?5:2);return t;
  }
  group.traverse(mesh=>{if(!mesh.isMesh||!mesh.material||Array.isArray(mesh.material))return;const m=mesh.material;if(m.transparent||m.emissiveIntensity>0||!m.color)return;const hex=m.color.getHex();
    if(upholstered&&(hex===base||hex===cream||hex===new T.Color('#a5ae92').getHex()||hex===new T.Color('#bc856b').getHex())){clothMap=clothMap||makeTexture('cloth');m.map=clothMap;m.roughness=.98;}
    else if(hex===wood||(wooden&&hex===base)){woodMap=woodMap||makeTexture('wood');m.map=woodMap;m.roughness=.65;}
    else if(['sink','toilet','fridge','kitchen','island'].includes(def.model))m.roughness=.42;
  });
}
function dispose(group){group.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){m.map?.dispose();m.dispose();}}});}
function texture(def){
  const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.fillStyle=def.color;ctx.fillRect(0,0,256,256);
  let seed=13;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  if(def.pattern==='wood'){
    for(let row=0;row<8;row++){const y=row*32;ctx.fillStyle=`rgba(65,39,12,${.025+random()*.08})`;ctx.fillRect(0,y,256,32);ctx.fillStyle='rgba(63,43,24,.18)';ctx.fillRect(0,y,256,1);ctx.fillRect(row%2?100:210,y,1,32);for(let i=0;i<22;i++){ctx.strokeStyle=`rgba(83,56,29,${random()*.13})`;ctx.beginPath();ctx.moveTo(0,y+random()*32);ctx.bezierCurveTo(80,y+random()*32,180,y+random()*32,256,y+random()*32);ctx.stroke();}}
  }else if(def.pattern==='checker'){for(let y=0;y<4;y++)for(let x=0;x<4;x++){if((x+y)%2===0){ctx.fillStyle='#f2eadc';ctx.fillRect(x*64,y*64,64,64);}ctx.strokeStyle='#ece6da';ctx.lineWidth=1;ctx.strokeRect(x*64,y*64,64,64);}}
  else if(def.pattern==='terrazzo'){for(let i=0;i<180;i++){const x=random()*256,y=random()*256,s=2+random()*6;ctx.fillStyle=['#eee8da','#aa8e79','#8e9c91','#d1b9a0'][i%4];ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+s,y-s*.4);ctx.lineTo(x+s*.7,y+s);ctx.lineTo(x-s*.4,y+s*.6);ctx.closePath();ctx.fill();}}
  else if(def.pattern==='linen'){for(let i=0;i<256;i+=3){ctx.fillStyle='rgba(255,255,255,.16)';ctx.fillRect(i,0,1,256);ctx.fillStyle='rgba(74,56,36,.1)';ctx.fillRect(0,i,256,1);}}
  else if(def.pattern==='herringbone'){ctx.save();ctx.translate(128,128);ctx.rotate(Math.PI/4);for(let y=-16;y<16;y++)for(let x=-16;x<16;x++){if(((x-y)%4+4)%4!==0)continue;ctx.fillStyle=`rgba(70,42,20,${.03+random()*.12})`;ctx.fillRect(x*16,y*16,64,16);ctx.fillRect(x*16,y*16+16,16,64);ctx.strokeStyle='rgba(69,49,26,.28)';ctx.lineWidth=.7;ctx.strokeRect(x*16,y*16,64,16);ctx.strokeRect(x*16,y*16+16,16,64);}ctx.restore();}
  else if(def.pattern==='tile'){ctx.strokeStyle='rgba(246,245,237,.65)';ctx.lineWidth=3;for(let i=0;i<=256;i+=64){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,256);ctx.moveTo(0,i);ctx.lineTo(256,i);ctx.stroke();}}
  else if(def.pattern==='stripe'){for(let i=0;i<256;i+=18){ctx.fillStyle='rgba(255,255,255,.22)';ctx.fillRect(i,0,8,256);}}
  for(let i=0;i<2500;i++){ctx.fillStyle=`rgba(${random()>.5?'255,255,255':'30,25,20'},${def.pattern==='stone'?.065:.025})`;ctx.fillRect(random()*256,random()*256,1+random()*2,1+random()*2);}
  const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;return t;
}
export class RoomScene{
  constructor(host,catalog,callbacks){
    this.host=host;this.catalog=catalog;this.cb=callbacks;this.items=new Map();this.wallGroups=[];this.editRooms=false;this.snap=true;this.walk=false;this.readonly=false;this.pending=null;this.dirty=true;
    this.renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;this.renderer.domElement.setAttribute('aria-label',catalog.title);this.renderer.domElement.tabIndex=0;host.append(this.renderer.domElement);
    this.scene=new T.Scene();this.camera=new T.PerspectiveCamera(38,1,.05,200);this.camera.position.set(13,12,17);
    this.root=new T.Group();this.scene.add(this.root);this.hemi=new T.HemisphereLight('#fff8e9','#a6aa96',2.6);this.scene.add(this.hemi);this.sun=new T.DirectionalLight('#fff0d4',3.2);this.sun.position.set(-6,14,5);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-20,right:20,top:20,bottom:-20,near:.5,far:60});this.sun.shadow.normalBias=.035;this.scene.add(this.sun);
    this.fill=new T.DirectionalLight('#dfeaff',1);this.fill.position.set(10,7,-7);this.scene.add(this.fill);
    const canvas=this.renderer.domElement;
    canvas.addEventListener('pointerdown',e=>this.down(e),true);canvas.addEventListener('pointermove',e=>this.move(e),true);canvas.addEventListener('pointerup',e=>this.up(e),true);canvas.addEventListener('pointercancel',e=>{this.activePointers?.delete(e.pointerId);this.cancelDrag();},true);
    this.controls=new OrbitControls(this.camera,canvas);this.controls.enableDamping=true;this.controls.dampingFactor=.09;this.controls.minDistance=3;this.controls.maxDistance=45;this.controls.maxPolarAngle=Math.PI/2-.08;this.controls.addEventListener('change',()=>{this.dirty=true;});
    this.ray=new T.Raycaster();this.plane=new T.Plane(new T.Vector3(0,1,0),0);this.mouse=new T.Vector2();
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.resize();this.animate();
  }
  resize(){const {width,height}=viewportRect(this.host),aspect=width/Math.max(height,1),changed=Math.abs(aspect-this.camera.aspect)>.12;this.renderer.setSize(width,height);this.camera.aspect=aspect;this.camera.updateProjectionMatrix();const landscape=document.body.classList.contains('forced-landscape'),switched=this.landscape!==undefined&&this.landscape!==landscape;this.landscape=landscape;
if(this.plan&&!this.walk&&(switched||(landscape&&changed))){const item=this.plan.items.find(o=>o.id===this.selected?.id),room=this.plan.rooms.find(r=>r.id===(this.selected?.kind==='room'?this.selected.id:item?.roomId));this.frameAvailable(room);}else this.ensureSelectionVisible();
this.dirty=true;}
  surface(id,w=1,d=1,r={textureScale:1,textureAngle:0}){const def=this.catalog.materials.find(m=>m.id===id),t=texture(def);t.repeat.set(w/2*r.textureScale,d/2*r.textureScale);t.rotation=r.textureAngle*Math.PI/180;t.center.set(.5,.5);return mat('#ffffff',{map:t,roughness:def.roughness});}
  rebuild(plan){
    this.plan=plan;dispose(this.root);this.root.clear();this.items.clear();this.wallGroups=[];this.selector=null;this.handle=null;this.doorPreview=null;this.sideHandles=[];this.guides=null;
    const b=bounds(plan.rooms);
    for(const r of plan.rooms){
      box(this.root,r.w,.22,r.d,r.x+r.w/2,-.14,r.z+r.d/2,'#d2c7b5');
      const floor=box(this.root,r.w-.012,.045,r.d-.012,r.x+r.w/2,-.006,r.z+r.d/2,this.surface(r.floor,r.w,r.d,r));floor.userData={kind:'room',id:r.id};
      // Thin edge defines each room without relying on grid overlays.
      for(const [x,z,w,d]of[[r.x+r.w/2,r.z,r.w,.025],[r.x+r.w/2,r.z+r.d,r.w,.025],[r.x,r.z+r.d/2,.025,r.d],[r.x+r.w,r.z+r.d/2,.025,r.d]])box(this.root,w,.015,d,x,.022,z,'#b9ac97');
    }
    for(const wall of walls(plan)){
      const g=new T.Group(),r=plan.rooms.find(r=>r.id===wall.rooms[0]),open=wallOpenings(plan,wall).sort((a,b)=>a.center-b.center),th=wall.thickness||plan.wallThickness,h=plan.wallHeight;
      const part=(a,b,y0,y1)=>{if(b-a<.005||y1-y0<.005)return;const m=box(g,wall.axis==='x'?b-a:th,y1-y0,wall.axis==='x'?th:b-a,wall.axis==='x'?(a+b)/2:wall.line,(y0+y1)/2,wall.axis==='x'?wall.line:(a+b)/2,this.surface(r.wall,b-a,y1-y0,r));if(wall.rooms.length===2){const other=this.plan.rooms.find(x=>x.id===wall.rooms[1]),first=m.material,second=this.surface(other.wall,b-a,y1-y0,other);m.material=[first,first,first,first,first,first];const face=wall.axis==='x'?(wall.sides[1]==='north'?4:5):(wall.sides[1]==='west'?0:1);m.material[face]=second;}m.userData={kind:'wall',id:r.id};};
      let cursor=wall.start;for(const o of open){const left=o.center-o.w/2,right=o.center+o.w/2;part(cursor,left,0,h);part(left,right,0,o.sill);part(left,right,o.sill+o.h,h);
        if(o.type==='window'){const glass=mat('#c7e1dc',{transparent:true,opacity:.3,depthWrite:false,roughness:.1});box(g,wall.axis==='x'?o.w:.025,o.h,wall.axis==='x'?.025:o.w,wall.axis==='x'?o.center:wall.line,o.sill+o.h/2,wall.axis==='x'?wall.line:o.center,glass);for(const t of [-o.w/2,0,o.w/2])box(g,wall.axis==='x'?.045:th+.025,o.h,wall.axis==='x'?th+.025:.045,wall.axis==='x'?o.center+t:wall.line,o.sill+o.h/2,wall.axis==='x'?wall.line:o.center+t,'#e9e0cd');for(const y of [o.sill,o.sill+o.h])box(g,wall.axis==='x'?o.w+.08:th+.08,.05,wall.axis==='x'?th+.08:o.w+.08,wall.axis==='x'?o.center:wall.line,y,wall.axis==='x'?wall.line:o.center,'#e9e0cd');}
        if(o.type==='door'){const frame=mat('#d4c4ae');for(const [center,y,width,height]of[[left,.5*o.h,.035,o.h],[right,.5*o.h,.035,o.h],[o.center,o.h,o.w+.035,.035]]){const m=box(g,wall.axis==='x'?width:th+.035,height,wall.axis==='x'?th+.035:width,wall.axis==='x'?center:wall.line,y,wall.axis==='x'?wall.line:center,frame);m.userData={kind:'opening',id:o.id,roomId:o.roomId};}const target=box(g,wall.axis==='x'?o.w:th+.04,o.h,wall.axis==='x'?th+.04:o.w,wall.axis==='x'?o.center:wall.line,o.h/2,wall.axis==='x'?wall.line:o.center,new T.MeshBasicMaterial({colorWrite:false,depthWrite:false}));target.castShadow=false;target.receiveShadow=false;target.userData={kind:'opening',id:o.id,roomId:o.roomId};}
        cursor=right;
      }part(cursor,wall.end,0,h);this.root.add(g);this.wallGroups.push({g,wall});
    }
    for(const item of plan.items){const def=this.catalog.furniture.find(f=>f.id===item.catalogId),g=furnitureModel(def,item.color);g.position.set(item.x,0,item.z);g.rotation.y=item.angle*Math.PI/180;g.scale.set(item.w/def.w,item.h/def.h,item.d/def.d);g.traverse(o=>{o.userData={kind:'item',id:item.id};});this.root.add(g);this.items.set(item.id,g);
      const r=plan.rooms.find(r=>r.id===item.roomId);if(!r||!corners(item).every(p=>p.x>=r.x+.04&&p.x<=r.x+r.w-.04&&p.z>=r.z+.04&&p.z<=r.z+r.d-.04)){const helper=new T.BoxHelper(g,'#c55e43');this.root.add(helper);}
    }
    const ground=new T.Mesh(new T.PlaneGeometry(180,180),new T.ShadowMaterial({opacity:.13}));ground.rotation.x=-Math.PI/2;ground.position.set(b.cx,-.26,b.cz);ground.receiveShadow=true;this.root.add(ground);
    this.select(this.selected);this.dirty=true;
  }
  previewOpening(opening,valid=true){
    const room=this.plan.rooms.find(r=>r.id===opening.roomId);if(!room)return;
    if(!this.doorPreview){this.doorPreview=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1,1,1)),new T.LineBasicMaterial({color:'#727d61',depthTest:false,transparent:true,opacity:.95}));this.doorPreview.renderOrder=20;this.root.add(this.doorPreview);}
    const horizontal=opening.side==='north'||opening.side==='south',line=horizontal?room.z+(opening.side==='south'?room.d:0):room.x+(opening.side==='east'?room.w:0),center=(horizontal?room.x:room.z)+opening.offset;
    this.doorPreview.position.set(horizontal?center:line,opening.sill+opening.h/2,horizontal?line:center);this.doorPreview.scale.set(horizontal?opening.w:this.plan.wallThickness+.03,opening.h,horizontal?this.plan.wallThickness+.03:opening.w);this.doorPreview.material.color.set(valid?'#727d61':'#c55e43');this.dirty=true;
  }
  select(selected){if(this.doorPreview){this.root.remove(this.doorPreview);dispose(this.doorPreview);this.doorPreview=null;}if(selected?.openingId&&!this.walk&&!this.readonly){const opening=this.plan?.openings.find(o=>o.id===selected.openingId);if(opening)this.previewOpening(opening);}for(const handle of this.sideHandles||[]){this.root.remove(handle);dispose(handle);}this.sideHandles=[];if(this.guides){this.root.remove(this.guides);dispose(this.guides);this.guides=null;}this.selected=selected;if(this.selector){this.root.remove(this.selector);dispose(this.selector);this.selector=null;}if(this.handle){this.root.remove(this.handle);dispose(this.handle);this.handle=null;}
    if(selected?.kind==='item'&&this.items.has(selected.id)){this.selector=new T.BoxHelper(this.items.get(selected.id),'#b56b48');this.root.add(this.selector);}
    else if(selected?.kind==='room'){const r=this.plan.rooms.find(r=>r.id===selected.id);if(r){const pts=[[r.x,r.z],[r.x+r.w,r.z],[r.x+r.w,r.z+r.d],[r.x,r.z+r.d],[r.x,r.z]].map(([x,z])=>new T.Vector3(x,.06,z));this.selector=new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:'#b56b48'}));this.root.add(this.selector);if(this.editRooms){this.handle=cyl(this.root,.15,.15,.08,r.x+r.w,.09,r.z+r.d,'#b56b48');this.handle.userData={kind:'resize',id:r.id};this.handle.material.depthTest=false;this.handle.renderOrder=30;for(const [side,x,z]of[['north',r.x+r.w/2,r.z],['south',r.x+r.w/2,r.z+r.d],['west',r.x,r.z+r.d/2],['east',r.x+r.w,r.z+r.d/2]]){const handle=cyl(this.root,.12,.12,.06,x,.09,z,'#b56b48');handle.userData={kind:'resize-side',side,id:r.id};handle.material.depthTest=false;handle.renderOrder=30;this.sideHandles.push(handle);}}}}
    this.dirty=true;
  }
  fit(type='overview',room=null){this.viewType=type;this.walk=false;this.camera.fov=38;this.camera.updateProjectionMatrix();this.controls.enabled=true;this.controls.enableZoom=true;this.controls.enablePan=true;this.controls.minDistance=2;this.controls.maxDistance=100;this.controls.maxPolarAngle=Math.PI/2-.08;const b=bounds(room?[room]:this.plan.rooms),size=Math.max(b.w,b.d)/Math.min(1,this.camera.aspect),distance=size*1.18+2;this.controls.target.set(b.cx,0,b.cz);if(type==='top')this.camera.position.set(b.cx,.1+distance*1.8,b.cz+.001);else this.camera.position.set(b.cx+distance*.76,distance*1.02,b.cz+distance*1.08);this.controls.update();if(document.body.classList.contains('forced-landscape'))this.frameAvailable(room);this.dirty=true;}
  lighting(night){this.night=night;this.hemi.intensity=night?.85:2.6;this.sun.intensity=night?1.8:3.2;this.sun.color.set(night?'#ffc181':'#fff0d4');this.fill.intensity=night?.3:1;this.renderer.toneMappingExposure=night?1.05:1.25;this.dirty=true;}
  point(event){const r=viewportRect(this.renderer.domElement);this.mouse.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.mouse,this.camera);return this.ray.ray.intersectPlane(this.plane,new T.Vector3());}
  resizeHit(event){
    if(!this.editRooms||this.readonly||this.pending||this.walk)return null;
    const rect=viewportRect(this.renderer.domElement),radius=event.pointerType==='mouse'?14:24;let best=null,distance=radius;
    for(const handle of [this.handle,...(this.sideHandles||[])]){if(!handle||!handle.visible)continue;const world=handle.getWorldPosition(new T.Vector3()),p=world.clone().project(this.camera);if(p.z < -1||p.z > 1)continue;const x=rect.left+(p.x+1)*rect.width/2,y=rect.top+(1-p.y)*rect.height/2,d=Math.hypot(event.clientX-x,event.clientY-y);if(d<distance){distance=d;best={object:handle,point:world};}}
    return best;
  }
  hit(event){const resize=this.resizeHit(event);if(resize)return resize;this.point(event);return this.ray.intersectObjects(this.root.children,true).find(h=>h.object.userData.kind&&h.object.visible&&h.object.parent?.visible!==false);}
  down(e){
    if(e.button!==0)return;this.activePointers=this.activePointers||new Set();this.activePointers.add(e.pointerId);if(this.activePointers.size>1){this.cancelDrag();this.start=null;return;}const p=this.point(e);this.start={x:e.clientX,y:e.clientY,point:p?.clone(),yaw:this.yaw,pitch:this.pitch};
    if(this.walk){this.controls.enabled=false;this.renderer.domElement.setPointerCapture(e.pointerId);return;}
    if(this.readonly)return;
    if(this.pending){this.controls.enabled=false;return;}
    const hit=this.hit(e),data=hit?.object.userData;if(this.selected?.openingId)return;if(['item','room','resize','resize-side'].includes(data?.kind)&&this.selected?.id!==data.id)return;if(data?.kind==='item'){if(this.cb.select({kind:'item',id:data.id})===false)return;const o=this.plan.items.find(i=>i.id===data.id);this.drag={kind:'item',id:o.id,original:{...o},candidate:{...o}};this.controls.enabled=false;this.renderer.domElement.setPointerCapture(e.pointerId);}
    else if(this.editRooms&&['room','resize','resize-side'].includes(data?.kind)){if(this.cb.select({kind:'room',id:data.id})===false)return;const r=this.plan.rooms.find(i=>i.id===data.id);this.drag={kind:data.kind,side:data.side,id:r.id,original:{...r},candidate:{...r}};this.controls.enabled=false;this.renderer.domElement.setPointerCapture(e.pointerId);}
  }
  move(e){
    if(this.walk&&this.start&&(e.buttons||e.pointerType==='touch')){if(Math.hypot(e.clientX-this.start.x,e.clientY-this.start.y)>5)this.start.looking=true;if(this.start.looking){this.yaw=this.start.yaw-(e.clientX-this.start.x)*.005;this.pitch=clamp(this.start.pitch+(e.clientY-this.start.y)*.004,-1.1,.9);this.look();}return;}
    if(this.start&&Math.hypot(e.clientX-this.start.x,e.clientY-this.start.y)>6){this.start.moved=true;if(!this.drag&&!this.pending&&!this.readonly&&!this.start.orbit){this.start.orbit=true;this.cb.select(null);}}
    const p=this.point(e);if(!p)return;
    if(this.pending){this.ghost?.position.set(p.x,.02,p.z);const o=itemFrom(this.pending,roomAt(this.plan,p.x,p.z)||this.plan.rooms[0],p.x,p.z);const valid=placement(this.plan,o,this.catalog);this.ghost?.traverse(m=>{if(m.material){m.material.transparent=true;m.material.opacity=valid?.65:.22;}});this.dirty=true;}
    if(!this.drag||!this.start?.point||Math.hypot(e.clientX-this.start.x,e.clientY-this.start.y)<=5)return;const dx=p.x-this.start.point.x,dz=p.z-this.start.point.z,o=this.drag.original,snap=n=>this.snap?round(n*10)/10:round(n);
    if(this.drag.kind==='item'){this.drag.candidate={...o,x:snap(o.x+dx),z:snap(o.z+dz)};if(this.snap)this.drag.candidate=snapFurniture(this.plan,this.drag.candidate,this.catalog);const valid=placement(this.plan,this.drag.candidate,this.catalog);const doorway=blockedDoorItems({...this.plan,items:[this.drag.candidate]},this.catalog).length>0;if(this.selector?.material?.color)this.selector.material.color.set(!valid?'#c55e43':doorway?'#bd8b39':'#727d61');const g=this.items.get(o.id);g.position.set(this.drag.candidate.x,0,this.drag.candidate.z);this.selector?.update?.();}
    else if(this.drag.kind==='resize-side'){const side=this.drag.side,n={...o};if(side==='east')n.w=snap(Math.max(1.5,o.w+dx));if(side==='south')n.d=snap(Math.max(1.5,o.d+dz));if(side==='west'){n.w=snap(Math.max(1.5,o.w-dx));n.x=round(o.x+o.w-n.w);}if(side==='north'){n.d=snap(Math.max(1.5,o.d-dz));n.z=round(o.z+o.d-n.d);}this.drag.candidate=this.snap?snapRoomEdge(this.plan,n,side):n;}
    else if(this.drag.kind==='resize'){
this.drag.candidate={...o,w:snap(Math.max(1.5,o.w+dx)),d:snap(Math.max(1.5,o.d+dz))};if(this.snap)this.drag.candidate=snapRoom(this.plan,this.drag.candidate,o);this.handle?.position.set(o.x+this.drag.candidate.w,.09,o.z+this.drag.candidate.d);}
    else{this.drag.candidate={...o,x:snap(o.x+dx),z:snap(o.z+dz)};if(this.snap)this.drag.candidate=snapRoom(this.plan,this.drag.candidate,o);if(this.selector)this.selector.position.set(this.drag.candidate.x-o.x,0,this.drag.candidate.z-o.z);}
    if(this.drag.kind!=='item')this.showRoomGuides(this.drag.candidate);this.dirty=true;
  }
  showRoomGuides(candidate){
    if(this.guides){this.root.remove(this.guides);dispose(this.guides);}
    const b=bounds([...this.plan.rooms.filter(r=>r.id!==candidate.id),candidate]),points=[],line=(x,z,x2,z2)=>points.push(new T.Vector3(x,.08,z),new T.Vector3(x2,.08,z2));
    for(const r of this.plan.rooms){if(r.id===candidate.id)continue;for(const x of [candidate.x,candidate.x+candidate.w])if([r.x,r.x+r.w].some(v=>Math.abs(v-x)<.012))line(x,b.z-.4,x,b.z+b.d+.4);for(const z of [candidate.z,candidate.z+candidate.d])if([r.z,r.z+r.d].some(v=>Math.abs(v-z)<.012))line(b.x-.4,z,b.x+b.w+.4,z);}
    const {x,z,w,d}=candidate;line(x,z,x+w,z);line(x+w,z,x+w,z+d);line(x+w,z+d,x,z+d);line(x,z+d,x,z);
    this.guides=new T.LineSegments(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:validRoom(this.plan,candidate)?'#727d61':'#c55e43',depthTest:false,transparent:true,opacity:.85}));this.guides.renderOrder=10;this.root.add(this.guides);
    for(const handle of this.sideHandles||[]){const side=handle.userData.side;handle.position.set(side==='west'?x:side==='east'?x+w:x+w/2,.09,side==='north'?z:side==='south'?z+d:z+d/2);}this.handle?.position.set(x+w,.09,z+d);
  }
  frameAvailable(room=null){
    if(!this.plan||this.walk||!this.controls)return;
    const b=bounds(room?[room]:this.plan.rooms),height=this.plan.wallHeight,center=new T.Vector3(b.cx,height*.28,b.cz),direction=this.camera.position.clone().sub(this.controls.target).normalize();
    if(direction.lengthSq()<.1)direction.set(.5,.65,.6).normalize();
    this.camera.position.copy(center).add(direction);this.camera.lookAt(center);this.camera.updateMatrixWorld(true);
    const right=new T.Vector3(1,0,0).applyQuaternion(this.camera.quaternion),up=new T.Vector3(0,1,0).applyQuaternion(this.camera.quaternion),vertical=Math.tan(this.camera.fov*Math.PI/360)*.76,horizontal=vertical*this.camera.aspect;let distance=2;
    for(const x of [b.x,b.x+b.w])for(const z of [b.z,b.z+b.d])for(const y of [0,height]){const offset=new T.Vector3(x,y,z).sub(center),depth=offset.dot(direction);distance=Math.max(distance,depth+Math.abs(offset.dot(right))/horizontal,depth+Math.abs(offset.dot(up))/vertical);}
    this.camera.position.copy(center).addScaledVector(direction,distance);this.controls.target.copy(center);this.controls.update();this.dirty=true;
  }
  ensureSelectionVisible(){
    if(!this.selected||!this.plan||this.walk||!this.controls)return;const o=this.selected.kind==='item'?this.plan.items.find(i=>i.id===this.selected.id):this.plan.rooms.find(r=>r.id===this.selected.id);if(!o)return;
    const target=new T.Vector3(o.x+(this.selected.kind==='room'?o.w/2:0),0,o.z+(this.selected.kind==='room'?o.d/2:0)),p=target.clone().project(this.camera);if(Math.abs(p.x)<=.72&&Math.abs(p.y)<=.72)return;
    const delta=target.clone().sub(this.controls.target);this.camera.position.add(delta);this.controls.target.copy(target);this.controls.update();
  }
  up(e){
    this.activePointers?.delete(e.pointerId);if(this.activePointers?.size){this.start=null;return;}if(!this.start)return;const moved=!!(this.start.looking||this.start.moved)||Math.hypot(e.clientX-this.start.x,e.clientY-this.start.y)>5;
    if(this.walk){if(!moved){const p=this.point(e);if(p){const route=walkingPath(this.plan,this.camera.position,p,this.catalog);this.markDestination(p,!!route);if(route)this.walkRoute={points:route,index:0,last:performance.now(),travelled:0};else this.cb.message('walkBlocked');}}this.start=null;return;}
    if(this.drag){const drag=this.drag;this.drag=null;if(moved&&JSON.stringify(drag.candidate)!==JSON.stringify(drag.original))this.cb.move(drag);else this.rebuild(this.plan);}
    else if(!moved&&!this.readonly){if(this.pending){const p=this.point(e);if(p)this.cb.place(this.pending,p);}else{const hit=this.hit(e),data=hit?.object.userData;if(data?.kind==='item')this.cb.select({kind:'item',id:data.id});else if(data?.kind==='wall')this.cb.select({kind:'room',id:data.id,surface:'wall'});else if(data?.kind==='room')this.cb.select({kind:'room',id:data.id});else if(!data)this.cb.select(null);}}
    this.controls.enabled=true;this.start=null;this.dirty=true;
  }
  cancelDrag(){this.drag=null;this.start=null;this.controls.enabled=!this.walk;if(this.plan)this.rebuild(this.plan);}
  setPending(def){if(this.ghost){this.scene.remove(this.ghost);dispose(this.ghost);this.ghost=null;}this.pending=def;if(def){this.ghost=furnitureModel(def);this.ghost.visible=true;const b=bounds(this.plan.rooms);this.ghost.position.set(b.cx,.03,b.cz);this.ghost.traverse(o=>{if(o.material){o.material.transparent=true;o.material.opacity=.45;o.castShadow=false;}});this.scene.add(this.ghost);}this.controls.enabled=true;this.dirty=true;}
  enter(room,corner=false){
    const target=entryPoint(this.plan,room,this.catalog,corner);if(!target){this.cb.message('walkNoSpace');return false;}
    if(!this.walk)this.savedCamera={position:this.camera.position.clone(),target:this.controls.target.clone()};this.walkRoute=null;this.clearDestination();this.walk=true;this.controls.enabled=false;this.camera.fov=60;this.camera.updateProjectionMatrix();this.camera.position.set(target.x,1.58,target.z);this.yaw=Math.atan2(room.x+room.w/2-target.x,-(room.z+room.d/2-target.z));this.pitch=.12;this.select(null);
    if(!this.walkDecorations){this.walkDecorations=[];this.root.traverse(o=>{if(o.isLine||o.isLineSegments){this.walkDecorations.push([o,o.visible]);o.visible=false;}});}this.look();return true;
  }
  clearDestination(){if(this.destination){this.root.remove(this.destination);dispose(this.destination);this.destination=null;}}
  stopWalking(){this.walkRoute=null;this.clearDestination();this.dirty=true;}
  markDestination(point,valid){this.clearDestination();const mesh=new T.Mesh(new T.RingGeometry(.12,.18,24),new T.MeshBasicMaterial({color:valid?'#727d61':'#c55e43',transparent:true,opacity:.8,depthWrite:false,side:T.DoubleSide}));mesh.rotation.x=-Math.PI/2;mesh.position.set(point.x,.055,point.z);this.root.add(mesh);this.destination=mesh;this.destinationUntil=performance.now()+1600;this.dirty=true;}
  advanceWalk(){
    const walking=!!(this.walk&&this.walkRoute);if(walking!==this.walkingNotified){this.walkingNotified=walking;this.cb.walking?.(walking);}
    if(this.destination&&performance.now()>this.destinationUntil){this.clearDestination();this.dirty=true;}
    const route=this.walkRoute;if(!this.walk||!route)return;const now=performance.now(),dt=Math.min(.05,(now-route.last)/1000);route.last=now;const point=route.points[route.index];if(!point){this.walkRoute=null;return;}const dx=point.x-this.camera.position.x,dz=point.z-this.camera.position.z,distance=Math.hypot(dx,dz),last=route.index===route.points.length-1,speed=1.65*Math.min(1,.3+route.travelled/.4,last?.3+distance/.4:1),step=Math.min(distance,speed*dt);if(distance>0){this.camera.position.x+=dx/distance*step;this.camera.position.z+=dz/distance*step;route.travelled+=step;}if(distance<=step+.001)route.index++;this.look();
  }

  look(){this.camera.lookAt(this.camera.position.x+Math.sin(this.yaw)*Math.cos(this.pitch),this.camera.position.y-Math.sin(this.pitch),this.camera.position.z-Math.cos(this.yaw)*Math.cos(this.pitch));this.dirty=true;}
  exit(){this.walkRoute=null;this.clearDestination();for(const [object,visible]of this.walkDecorations||[])object.visible=visible;this.walkDecorations=null;this.walk=false;this.camera.fov=38;this.camera.updateProjectionMatrix();this.controls.enabled=true;if(this.savedCamera){this.camera.position.copy(this.savedCamera.position);this.controls.target.copy(this.savedCamera.target);this.controls.update();}this.dirty=true;}
  animate(){requestAnimationFrame(()=>this.animate());this.advanceWalk();if(!this.walk)this.controls.update();if(!this.dirty||document.hidden)return;
    for(const {g,wall}of this.wallGroups){let scale=1;if(!this.walk){if(wall.rooms.length>1)scale=.23;else{const near=wall.axis==='x'?(wall.sides[0]==='south'?this.camera.position.z>wall.line:this.camera.position.z<wall.line):(wall.sides[0]==='east'?this.camera.position.x>wall.line:this.camera.position.x<wall.line);if(near)scale=.08;}if(this.camera.position.y>30)scale=.04;}g.scale.y=scale;}
    this.renderer.render(this.scene,this.camera);this.dirty=false;
  }
  async capture(){const decorations=[...(this.sideHandles||[]),this.guides,this.doorPreview].filter(Boolean),visibility=decorations.map(o=>o.visible);decorations.forEach(o=>o.visible=false);const bg=this.scene.background;this.scene.background=new T.Color(this.night?'#c6cbbb':'#eaece1');if(this.selector)this.selector.visible=false;if(this.handle)this.handle.visible=false;if(this.ghost)this.ghost.visible=false;try{this.renderer.render(this.scene,this.camera);return await new Promise((resolve,reject)=>this.renderer.domElement.toBlob(blob=>blob?resolve(blob):reject(new Error('Capture failed')),'image/png'));}finally{decorations.forEach((o,i)=>o.visible=visibility[i]);this.scene.background=bg;if(this.selector)this.selector.visible=true;if(this.handle)this.handle.visible=true;if(this.ghost)this.ghost.visible=true;this.dirty=true;}}
  thumbnails(){
    const renderer=new T.WebGLRenderer({antialias:true,alpha:true});renderer.setSize(200,150);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
    const scene=new T.Scene();scene.add(new T.HemisphereLight('#fff7e8','#c1b6a0',3));const light=new T.DirectionalLight('#ffffff',3);light.position.set(-3,5,5);scene.add(light);const camera=new T.PerspectiveCamera(32,4/3,.1,30),images=new Map();
    for(const def of this.catalog.furniture){const g=furnitureModel(def);scene.add(g);const size=Math.max(def.w,def.d,def.h),dist=size*2.2+.3;camera.position.set(dist*.85,dist*.75,dist);camera.lookAt(0,def.h*.4,0);renderer.render(scene,camera);images.set(def.id,renderer.domElement.toDataURL('image/png'));scene.remove(g);dispose(g);}renderer.dispose();return images;
  }
}
