import * as T from './vendor/package/build/three.module.js';
import { OrbitControls } from './vendor/package/examples/jsm/controls/OrbitControls.js';
import {bounds, walls, wallOpenings, roomAt, placement, itemFrom, round, clamp, walkable, canWalk, corners} from './core.js';

const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:0.8,...extra});
function box(g,w,h,d,x,y,z,color,extra={}){const m=new T.Mesh(new T.BoxGeometry(w,h,d),typeof color==='object'?color:mat(color,extra));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
function cyl(g,r1,r2,h,x,y,z,color){const m=new T.Mesh(new T.CylinderGeometry(r1,r2,h,24),typeof color==='object'?color:mat(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
function orb(g,x,y,z,sx,sy,sz,color){const m=new T.Mesh(new T.IcosahedronGeometry(1,1),mat(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;g.add(m);return m;}
function soft(g,w,h,d,x,y,z,color){
  const radius=Math.min(w,h,d)*0.18,shape=new T.Shape(),a=-w/2,b=-d/2;
  shape.moveTo(a+radius,b);shape.lineTo(a+w-radius,b);shape.quadraticCurveTo(a+w,b,a+w,b+radius);shape.lineTo(a+w,b+d-radius);shape.quadraticCurveTo(a+w,b+d,a+w-radius,b+d);shape.lineTo(a+radius,b+d);shape.quadraticCurveTo(a,b+d,a,b+d-radius);shape.lineTo(a,b+radius);shape.quadraticCurveTo(a,b,a+radius,b);
  const geo=new T.ExtrudeGeometry(shape,{depth:Math.max(.005,h-2*radius),bevelEnabled:true,bevelThickness:radius,bevelSize:radius*.55,bevelSegments:2,steps:1,curveSegments:4});geo.rotateX(-Math.PI/2);geo.translate(0,radius,0);
  const m=new T.Mesh(geo,mat(color));m.position.set(x,y-h/2,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;
}
export function furnitureModel(def,color=def.color){
  const g=new T.Group(),w=def.w,d=def.d,h=def.h,wood='#b7976d',dark='#51493e',cream='#eee8db';
  const legs=(height,spread=.8)=>{for(const x of [-w*spread/2,w*spread/2])for(const z of [-d*spread/2,d*spread/2])cyl(g,.028,.021,height,x,height/2,z,wood);};
  switch(def.model){
    case 'sofa':
      legs(.16);soft(g,w-.07,.25,d-.04,0,.28,0,color);soft(g,w,.43,.17,0,h-.23,-d/2+.075,color);
      for(const x of [-w/2+.11,w/2-.11])soft(g,.2,.42,d,x,.48,0,color);
      for(let i=0;i<3;i++)soft(g,(w-.47)/3,.14,d-.27,-(w-.47)/3+i*(w-.47)/3,.47,.04,color);
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
    case 'rug':box(g,w,h,d,0,.024,0,color);for(let i=0;i<22;i++)box(g,w*.96,.002,.012,0,.04,-d*.46+i*d*.92/21,'#c7bdaa');break;
    case 'plant':
      cyl(g,w*.28,w*.21,h*.23,0,h*.115,0,'#d3c5af');cyl(g,w*.245,w*.245,.01,0,h*.23,0,'#625649');cyl(g,.024,.035,h*.57,0,h*.48,0,wood);
      for(let i=0;i<11;i++){const a=i*2.4;orb(g,Math.cos(a)*w*.21,h*.5+i*h*.036,Math.sin(a)*w*.21,w*.25,h*.12,w*.22,i%2?color:'#667d5e');}break;
    case 'lamp':cyl(g,w*.37,w*.4,.04,0,.025,0,dark);cyl(g,.023,.023,h*.84,0,h*.44,0,wood);cyl(g,w*.18,w*.5,h*.18,0,h*.86,0,color);cyl(g,w*.44,w*.44,.008,0,h*.775,0,mat('#ffddb0',{emissive:'#ffbb63',emissiveIntensity:.5}));break;
    case 'art':box(g,w,h,d,0,h/2,0,wood);box(g,w*.86,h*.91,.015,0,h/2,d/2+.01,cream);orb(g,-w*.14,h*.58,d/2+.025,w*.22,h*.24,.014,color);orb(g,w*.14,h*.37,d/2+.05,w*.25,h*.17,.015,'#8b9b83');break;
    case 'toilet':soft(g,w*.7,h*.62,d*.29,0,h*.59,-d*.35,cream);cyl(g,w*.34,w*.24,h*.43,0,h*.23,d*.13,cream);const seat=cyl(g,w*.48,w*.46,.07,0,h*.49,d*.09,cream);seat.scale.z=1.32;cyl(g,w*.27,w*.27,.006,0,h*.54,d*.12,'#aeb4af');break;
    case 'shower':box(g,w,.07,d,0,.035,0,cream);for(const x of [-w/2,w/2]){box(g,.025,h,.025,x,h/2,-d/2,dark);box(g,.018,h,d,x,h/2,0,mat(color,{transparent:true,opacity:.24,depthWrite:false}));}box(g,w,h,.015,0,h/2,-d/2,mat(color,{transparent:true,opacity:.24,depthWrite:false}));cyl(g,.015,.015,h*.7,0,h*.5,-d*.44,dark);cyl(g,.1,.1,.025,0,h*.86,-d*.28,dark);break;
  }
  return g;
}
function dispose(group){group.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){m.map?.dispose();m.dispose();}}});}
function texture(def){
  const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.fillStyle=def.color;ctx.fillRect(0,0,256,256);
  let seed=13;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  if(def.pattern==='wood'){
    for(let row=0;row<8;row++){const y=row*32;ctx.fillStyle=`rgba(65,39,12,${.025+random()*.08})`;ctx.fillRect(0,y,256,32);ctx.fillStyle='rgba(63,43,24,.18)';ctx.fillRect(0,y,256,1);ctx.fillRect(row%2?100:210,y,1,32);for(let i=0;i<22;i++){ctx.strokeStyle=`rgba(83,56,29,${random()*.13})`;ctx.beginPath();ctx.moveTo(0,y+random()*32);ctx.bezierCurveTo(80,y+random()*32,180,y+random()*32,256,y+random()*32);ctx.stroke();}}
  }else if(def.pattern==='tile'){ctx.strokeStyle='rgba(246,245,237,.65)';ctx.lineWidth=3;for(let i=0;i<=256;i+=64){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,256);ctx.moveTo(0,i);ctx.lineTo(256,i);ctx.stroke();}}
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
    canvas.addEventListener('pointerdown',e=>this.down(e),true);canvas.addEventListener('pointermove',e=>this.move(e),true);canvas.addEventListener('pointerup',e=>this.up(e),true);canvas.addEventListener('pointercancel',()=>this.cancelDrag(),true);
    this.controls=new OrbitControls(this.camera,canvas);this.controls.enableDamping=true;this.controls.dampingFactor=.09;this.controls.minDistance=3;this.controls.maxDistance=45;this.controls.maxPolarAngle=Math.PI/2-.08;this.controls.addEventListener('change',()=>{this.dirty=true;});
    this.ray=new T.Raycaster();this.plane=new T.Plane(new T.Vector3(0,1,0),0);this.mouse=new T.Vector2();
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);this.resize();this.animate();
  }
  resize(){const {width,height}=this.host.getBoundingClientRect(),aspect=width/Math.max(height,1),changed=Math.abs(aspect-this.camera.aspect)>.12;this.renderer.setSize(width,height);this.camera.aspect=aspect;this.camera.updateProjectionMatrix();if(this.plan&&!this.walk&&changed)this.fit(this.viewType||'overview');this.dirty=true;}
  surface(id,w=1,d=1,r={textureScale:1,textureAngle:0}){const def=this.catalog.materials.find(m=>m.id===id),t=texture(def);t.repeat.set(w/2*r.textureScale,d/2*r.textureScale);t.rotation=r.textureAngle*Math.PI/180;t.center.set(.5,.5);return mat('#ffffff',{map:t,roughness:def.roughness});}
  rebuild(plan){
    this.plan=plan;dispose(this.root);this.root.clear();this.items.clear();this.wallGroups=[];this.selector=null;this.handle=null;
    const b=bounds(plan.rooms);
    for(const r of plan.rooms){
      box(this.root,r.w,.22,r.d,r.x+r.w/2,-.14,r.z+r.d/2,'#d2c7b5');
      const floor=box(this.root,r.w-.012,.045,r.d-.012,r.x+r.w/2,-.006,r.z+r.d/2,this.surface(r.floor,r.w,r.d,r));floor.userData={kind:'room',id:r.id};
      // Thin edge defines each room without relying on grid overlays.
      for(const [x,z,w,d]of[[r.x+r.w/2,r.z,r.w,.025],[r.x+r.w/2,r.z+r.d,r.w,.025],[r.x,r.z+r.d/2,.025,r.d],[r.x+r.w,r.z+r.d/2,.025,r.d]])box(this.root,w,.015,d,x,.022,z,'#b9ac97');
    }
    for(const wall of walls(plan)){
      const g=new T.Group(),r=plan.rooms.find(r=>r.id===wall.rooms[0]),open=wallOpenings(plan,wall).sort((a,b)=>a.center-b.center),th=plan.wallThickness,h=plan.wallHeight;
      const part=(a,b,y0,y1)=>{if(b-a<.005||y1-y0<.005)return;const m=box(g,wall.axis==='x'?b-a:th,y1-y0,wall.axis==='x'?th:b-a,wall.axis==='x'?(a+b)/2:wall.line,(y0+y1)/2,wall.axis==='x'?wall.line:(a+b)/2,this.surface(r.wall,b-a,y1-y0,r));if(wall.rooms.length===2){const other=this.plan.rooms.find(x=>x.id===wall.rooms[1]),first=m.material,second=this.surface(other.wall,b-a,y1-y0,other);m.material=[first,first,first,first,first,first];const face=wall.axis==='x'?(wall.sides[1]==='north'?4:5):(wall.sides[1]==='west'?0:1);m.material[face]=second;}m.userData={kind:'wall',id:r.id};};
      let cursor=wall.start;for(const o of open){const left=o.center-o.w/2,right=o.center+o.w/2;part(cursor,left,0,h);part(left,right,0,o.sill);part(left,right,o.sill+o.h,h);
        if(o.type==='window'){const glass=mat('#c7e1dc',{transparent:true,opacity:.3,depthWrite:false,roughness:.1});box(g,wall.axis==='x'?o.w:.025,o.h,wall.axis==='x'?.025:o.w,wall.axis==='x'?o.center:wall.line,o.sill+o.h/2,wall.axis==='x'?wall.line:o.center,glass);for(const t of [-o.w/2,0,o.w/2])box(g,wall.axis==='x'?.045:th+.025,o.h,wall.axis==='x'?th+.025:.045,wall.axis==='x'?o.center+t:wall.line,o.sill+o.h/2,wall.axis==='x'?wall.line:o.center+t,'#e9e0cd');for(const y of [o.sill,o.sill+o.h])box(g,wall.axis==='x'?o.w+.08:th+.08,.05,wall.axis==='x'?th+.08:o.w+.08,wall.axis==='x'?o.center:wall.line,y,wall.axis==='x'?wall.line:o.center,'#e9e0cd');}
        cursor=right;
      }part(cursor,wall.end,0,h);this.root.add(g);this.wallGroups.push({g,wall});
    }
    for(const item of plan.items){const def=this.catalog.furniture.find(f=>f.id===item.catalogId),g=furnitureModel(def,item.color);g.position.set(item.x,0,item.z);g.rotation.y=item.angle*Math.PI/180;g.scale.set(item.w/def.w,item.h/def.h,item.d/def.d);g.traverse(o=>{o.userData={kind:'item',id:item.id};});this.root.add(g);this.items.set(item.id,g);
      const r=plan.rooms.find(r=>r.id===item.roomId);if(!r||!corners(item).every(p=>p.x>=r.x+.04&&p.x<=r.x+r.w-.04&&p.z>=r.z+.04&&p.z<=r.z+r.d-.04)){const helper=new T.BoxHelper(g,'#c55e43');this.root.add(helper);}
    }
    const ground=new T.Mesh(new T.PlaneGeometry(180,180),new T.ShadowMaterial({opacity:.13}));ground.rotation.x=-Math.PI/2;ground.position.set(b.cx,-.26,b.cz);ground.receiveShadow=true;this.root.add(ground);
    this.select(this.selected);this.dirty=true;
  }
  select(selected){this.selected=selected;if(this.selector){this.root.remove(this.selector);dispose(this.selector);this.selector=null;}if(this.handle){this.root.remove(this.handle);dispose(this.handle);this.handle=null;}
    if(selected?.kind==='item'&&this.items.has(selected.id)){this.selector=new T.BoxHelper(this.items.get(selected.id),'#b56b48');this.root.add(this.selector);}
    else if(selected?.kind==='room'){const r=this.plan.rooms.find(r=>r.id===selected.id);if(r){const pts=[[r.x,r.z],[r.x+r.w,r.z],[r.x+r.w,r.z+r.d],[r.x,r.z+r.d],[r.x,r.z]].map(([x,z])=>new T.Vector3(x,.06,z));this.selector=new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:'#b56b48'}));this.root.add(this.selector);if(this.editRooms){this.handle=cyl(this.root,.15,.15,.08,r.x+r.w,.09,r.z+r.d,'#b56b48');this.handle.userData={kind:'resize',id:r.id};}}}
    this.dirty=true;
  }
  fit(type='overview',room=null){this.viewType=type;this.walk=false;this.camera.fov=38;this.camera.updateProjectionMatrix();this.controls.enabled=true;this.controls.enableZoom=true;this.controls.enablePan=true;this.controls.minDistance=2;this.controls.maxDistance=100;this.controls.maxPolarAngle=Math.PI/2-.08;const b=bounds(room?[room]:this.plan.rooms),size=Math.max(b.w,b.d)/Math.min(1,this.camera.aspect),distance=size*1.18+2;this.controls.target.set(b.cx,0,b.cz);if(type==='top')this.camera.position.set(b.cx,.1+distance*1.8,b.cz+.001);else this.camera.position.set(b.cx+distance*.76,distance*1.02,b.cz+distance*1.08);this.controls.update();this.dirty=true;}
  lighting(night){this.night=night;this.hemi.intensity=night?.85:2.6;this.sun.intensity=night?1.8:3.2;this.sun.color.set(night?'#ffc181':'#fff0d4');this.fill.intensity=night?.3:1;this.renderer.toneMappingExposure=night?1.05:1.25;this.dirty=true;}
  point(event){const r=this.renderer.domElement.getBoundingClientRect();this.mouse.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.mouse,this.camera);return this.ray.ray.intersectPlane(this.plane,new T.Vector3());}
  hit(event){this.point(event);return this.ray.intersectObjects(this.root.children,true).find(h=>h.object.userData.kind&&h.object.visible&&h.object.parent?.visible!==false);}
  down(e){
    if(e.button!==0)return;const p=this.point(e);this.start={x:e.clientX,y:e.clientY,point:p?.clone(),yaw:this.yaw,pitch:this.pitch};
    if(this.walk){this.controls.enabled=false;this.renderer.domElement.setPointerCapture(e.pointerId);return;}
    if(this.readonly)return;
    if(this.pending){this.controls.enabled=false;return;}
    const hit=this.hit(e),data=hit?.object.userData;if(data?.kind==='item'&&!this.editRooms){this.cb.select({kind:'item',id:data.id});const o=this.plan.items.find(i=>i.id===data.id);this.drag={kind:'item',id:o.id,original:{...o},candidate:{...o}};this.controls.enabled=false;this.renderer.domElement.setPointerCapture(e.pointerId);}
    else if(this.editRooms&&['room','resize'].includes(data?.kind)){this.cb.select({kind:'room',id:data.id});const r=this.plan.rooms.find(i=>i.id===data.id);this.drag={kind:data.kind,id:r.id,original:{...r},candidate:{...r}};this.controls.enabled=false;this.renderer.domElement.setPointerCapture(e.pointerId);}
  }
  move(e){
    if(this.walk&&this.start&&(e.buttons||e.pointerType==='touch')){this.yaw=this.start.yaw-(e.clientX-this.start.x)*.005;this.pitch=clamp(this.start.pitch+(e.clientY-this.start.y)*.004,-1.1,.9);this.look();return;}
    const p=this.point(e);if(!p)return;
    if(this.pending){this.ghost?.position.set(p.x,.02,p.z);const o=itemFrom(this.pending,roomAt(this.plan,p.x,p.z)||this.plan.rooms[0],p.x,p.z);const valid=placement(this.plan,o,this.catalog);this.ghost?.traverse(m=>{if(m.material){m.material.transparent=true;m.material.opacity=valid?.65:.22;}});this.dirty=true;}
    if(!this.drag||!this.start?.point)return;const dx=p.x-this.start.point.x,dz=p.z-this.start.point.z,o=this.drag.original,snap=n=>this.snap?round(n*10)/10:round(n);
    if(this.drag.kind==='item'){this.drag.candidate={...o,x:snap(o.x+dx),z:snap(o.z+dz)};const g=this.items.get(o.id);g.position.set(this.drag.candidate.x,0,this.drag.candidate.z);this.selector?.update?.();}
    else if(this.drag.kind==='resize'){this.drag.candidate={...o,w:snap(Math.max(1.5,o.w+dx)),d:snap(Math.max(1.5,o.d+dz))};this.handle?.position.set(o.x+this.drag.candidate.w,.09,o.z+this.drag.candidate.d);}
    else{this.drag.candidate={...o,x:snap(o.x+dx),z:snap(o.z+dz)};if(this.selector)this.selector.position.set(this.drag.candidate.x-o.x,0,this.drag.candidate.z-o.z);}
    this.dirty=true;
  }
  up(e){
    if(!this.start)return;const moved=Math.hypot(e.clientX-this.start.x,e.clientY-this.start.y)>5;
    if(this.walk){if(!moved){const p=this.point(e);if(p){if(canWalk(this.plan,this.camera.position,p,this.catalog)){this.camera.position.x=p.x;this.camera.position.z=p.z;this.look();}else this.cb.message('walkBlocked');}}this.start=null;return;}
    if(this.drag){const drag=this.drag;this.drag=null;if(moved)this.cb.move(drag);else this.select(this.selected);}
    else if(!moved&&!this.readonly){if(this.pending){const p=this.point(e);if(p)this.cb.place(this.pending,p);}else{const hit=this.hit(e),data=hit?.object.userData;if(data?.kind==='wall')this.cb.select({kind:'room',id:data.id,surface:'wall'});else if(data?.kind==='room')this.cb.select({kind:'room',id:data.id});else if(!data)this.cb.select(null);}}
    this.controls.enabled=true;this.start=null;this.dirty=true;
  }
  cancelDrag(){this.drag=null;this.start=null;this.controls.enabled=!this.walk;if(this.plan)this.rebuild(this.plan);}
  setPending(def){if(this.ghost){this.scene.remove(this.ghost);dispose(this.ghost);this.ghost=null;}this.pending=def;if(def){this.ghost=furnitureModel(def);this.ghost.visible=true;const b=bounds(this.plan.rooms);this.ghost.position.set(b.cx,.03,b.cz);this.ghost.traverse(o=>{if(o.material){o.material.transparent=true;o.material.opacity=.45;o.castShadow=false;}});this.scene.add(this.ghost);}this.controls.enabled=true;this.dirty=true;}
  enter(room,corner=false){
    let target=null;const candidates=[{x:room.x+room.w/2,z:room.z+room.d*.72},{x:room.x+.4,z:room.z+room.d-.4}];if(corner)candidates.reverse();
    for(let z=room.z+.3;z<room.z+room.d-.2;z+=.35)for(let x=room.x+.3;x<room.x+room.w-.2;x+=.35)candidates.push({x,z});target=candidates.find(p=>walkable(this.plan,p.x,p.z,this.catalog));if(!target){this.cb.message('walkNoSpace');return false;}
    if(!this.walk)this.savedCamera={position:this.camera.position.clone(),target:this.controls.target.clone()};this.walk=true;this.controls.enabled=false;this.camera.fov=72;this.camera.updateProjectionMatrix();this.camera.position.set(target.x,1.58,target.z);this.yaw=Math.atan2(room.x+room.w/2-target.x,-(room.z+room.d/2-target.z));this.pitch=.19;this.look();this.select(null);return true;
  }
  look(){this.camera.lookAt(this.camera.position.x+Math.sin(this.yaw)*Math.cos(this.pitch),this.camera.position.y-Math.sin(this.pitch),this.camera.position.z-Math.cos(this.yaw)*Math.cos(this.pitch));this.dirty=true;}
  exit(){this.walk=false;this.camera.fov=38;this.camera.updateProjectionMatrix();this.controls.enabled=true;if(this.savedCamera){this.camera.position.copy(this.savedCamera.position);this.controls.target.copy(this.savedCamera.target);this.controls.update();}this.dirty=true;}
  animate(){requestAnimationFrame(()=>this.animate());if(!this.walk)this.controls.update();if(!this.dirty||document.hidden)return;
    for(const {g,wall}of this.wallGroups){let scale=1;if(!this.walk){if(wall.rooms.length>1)scale=.23;else{const near=wall.axis==='x'?(wall.sides[0]==='south'?this.camera.position.z>wall.line:this.camera.position.z<wall.line):(wall.sides[0]==='east'?this.camera.position.x>wall.line:this.camera.position.x<wall.line);if(near)scale=.08;}if(this.camera.position.y>30)scale=.04;}g.scale.y=scale;}
    this.renderer.render(this.scene,this.camera);this.dirty=false;
  }
  async capture(){const bg=this.scene.background;this.scene.background=new T.Color(this.night?'#c6cbbb':'#eaece1');if(this.selector)this.selector.visible=false;if(this.handle)this.handle.visible=false;if(this.ghost)this.ghost.visible=false;try{this.renderer.render(this.scene,this.camera);return await new Promise((resolve,reject)=>this.renderer.domElement.toBlob(blob=>blob?resolve(blob):reject(new Error('Capture failed')),'image/png'));}finally{this.scene.background=bg;if(this.selector)this.selector.visible=true;if(this.handle)this.handle.visible=true;if(this.ghost)this.ghost.visible=true;this.dirty=true;}}
  thumbnails(){
    const renderer=new T.WebGLRenderer({antialias:true,alpha:true});renderer.setSize(200,150);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
    const scene=new T.Scene();scene.add(new T.HemisphereLight('#fff7e8','#c1b6a0',3));const light=new T.DirectionalLight('#ffffff',3);light.position.set(-3,5,5);scene.add(light);const camera=new T.PerspectiveCamera(32,4/3,.1,30),images=new Map();
    for(const def of this.catalog.furniture){const g=furnitureModel(def);scene.add(g);const size=Math.max(def.w,def.d,def.h),dist=size*2.2+.3;camera.position.set(dist*.85,dist*.75,dist);camera.lookAt(0,def.h*.4,0);renderer.render(scene,camera);images.set(def.id,renderer.domElement.toDataURL('image/png'));scene.remove(g);dispose(g);}renderer.dispose();return images;
  }
}
