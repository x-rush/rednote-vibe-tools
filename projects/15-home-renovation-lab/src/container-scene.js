import * as T from './vendor/package/build/three.module.js';
import {RoomScene as BaseScene} from './scene.js';
import {bounds,roomAt,itemFrom,placement,round} from './core.js';

function release(mesh){mesh.geometry?.dispose();if(mesh.material)mesh.material.dispose();}
function snapshot(canvas){const copy=document.createElement('canvas');let scale=Math.min(1,1024/Math.max(canvas.width,canvas.height));for(let i=0;i<4;i++){copy.width=Math.max(1,Math.round(canvas.width*scale));copy.height=Math.max(1,Math.round(canvas.height*scale));copy.getContext('2d').drawImage(canvas,0,0,copy.width,copy.height);const data=copy.toDataURL('image/png');if((data.length-data.indexOf(',')-1)*.75<=1024*1024)return data;scale*=.7;}throw new Error('Image exceeds the container memory budget');}
function mergeMeshes(meshes,parent){
  const pos=[],normal=[],colors=[],ranges=[],normalMatrix=new T.Matrix3();let triangle=0;
  for(const mesh of meshes){if(!mesh.isMesh)continue;const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];if(materials.some(m=>m.transparent||m.map))continue;
    const geo=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry,pa=geo.attributes.position,na=geo.attributes.normal,matrix=mesh.matrixWorld.clone();if(parent){const inverse=parent.matrixWorld.clone().invert();matrix.premultiply(inverse);}normalMatrix.getNormalMatrix(matrix);const p=new T.Vector3(),n=new T.Vector3();
    for(let i=0;i<pa.count;i++){const group=materials.length>1?geo.groups.find(g=>i>=g.start&&i<g.start+g.count):null,co=materials[group?group.materialIndex:0].color;p.fromBufferAttribute(pa,i).applyMatrix4(matrix);pos.push(p.x,p.y,p.z);if(na)n.fromBufferAttribute(na,i).applyNormalMatrix(normalMatrix);else n.set(0,1,0);normal.push(n.x,n.y,n.z);colors.push(co.r,co.g,co.b);}
    ranges.push({first:triangle,last:triangle+pa.count/3,data:mesh.userData});triangle+=pa.count/3;mesh.visible=false;if(geo!==mesh.geometry)geo.dispose();
  }
  if(!pos.length)return null;
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('normal',new T.Float32BufferAttribute(normal,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));const mesh=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:.85}));mesh.userData={kind:'batch',ranges};mesh.castShadow=false;mesh.receiveShadow=false;return mesh;
}

class BudgetScene extends BaseScene{
  constructor(host,catalog,callbacks){
    super(host,catalog,callbacks);this.ready=true;this.batches=[];this.samples=[];this.tier=0;this.renderer.shadowMap.enabled=false;this.sun.castShadow=false;this.lost=false;
    this.renderer.debug.onShaderError=()=>this.fail('shader');
    this.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;this.fail('context-lost');});
    this.renderer.domElement.addEventListener('webglcontextrestored',()=>{this.lost=false;});
    this.visibility=()=>{if(document.hidden){cancelAnimationFrame(this.frame);this.frame=null;}else if(!this.stopped){this.samples=[];this.dirty=true;this.animate();}};document.addEventListener('visibilitychange',this.visibility);
    this.resize();
  }
  resize(){super.resize();const r=this.host.getBoundingClientRect(),limit=this.tier?1000000:2000000,dpr=Math.min(devicePixelRatio||1,this.tier?1:1.5,Math.sqrt(limit/Math.max(1,r.width*r.height)));this.renderer.setPixelRatio(dpr);this.renderer.setSize(r.width,r.height);}
  surface(id,w,d,r){const def=this.catalog.materials.find(m=>m.id===id);if(def.pattern==='paint')return new T.MeshStandardMaterial({color:def.color,roughness:.95});return super.surface(id,w,d,r);}
  rebuild(plan){this.rebuilding=true;this.removeBatches();super.rebuild(plan);this.rebuilding=false;this.batch();this.samples=[];}
  select(selected){if(!this.rebuilding)this.removeBatches();super.select(selected);if(!this.rebuilding&&this.plan)this.batch();}
  removeBatches(){if(!this.batches)return;for(const b of this.batches){b.parent?.remove(b);release(b);}this.batches=[];this.root.traverse(o=>{if(o.isMesh)o.visible=true;});}
  batch(){
    this.root.updateMatrixWorld(true);const furniture=[];for(const [id,g]of this.items){if(id!==this.selected?.id)g.traverse(o=>{if(o.isMesh)furniture.push(o);});}
    const add=(meshes,parent)=>{const m=mergeMeshes(meshes,parent);if(m){parent.add(m);this.batches.push(m);}};add(furniture,this.root);
    const standalone=this.root.children.filter(o=>o.isMesh&&o!==this.handle&&!this.batches.includes(o));add(standalone,this.root);
    for(const {g}of this.wallGroups){const meshes=[];g.traverse(o=>{if(o.isMesh)meshes.push(o);});add(meshes,g);}
    this.dirty=true;
  }
  hit(e){this.point(e);const hits=this.ray.intersectObjects(this.root.children,true);for(const h of hits){if(!h.object.visible||h.object.parent?.visible===false)continue;let data=h.object.userData;if(data.kind==='batch'){data=data.ranges.find(r=>h.faceIndex>=r.first&&h.faceIndex<r.last)?.data;if(!data?.kind)continue;return{...h,object:{userData:data}};}if(data.kind)return h;}return undefined;}
  thumbnails(){return new Map(this.catalog.furniture.map(f=>[f.id,`./assets/furniture/${f.id}.png`]));}
  animate(){
    if(!this.ready){this.frame=requestAnimationFrame(()=>this.animate());return;}if(this.stopped||document.hidden)return;this.frame=requestAnimationFrame(()=>this.animate());if(!this.walk)this.controls.update();if(!this.dirty||this.lost)return;
    const start=performance.now();for(const {g,wall}of this.wallGroups){let scale=1;if(!this.walk){if(wall.rooms.length>1)scale=.23;else{const near=wall.axis==='x'?(wall.sides[0]==='south'?this.camera.position.z>wall.line:this.camera.position.z<wall.line):(wall.sides[0]==='east'?this.camera.position.x>wall.line:this.camera.position.x<wall.line);if(near)scale=.08;}if(this.camera.position.y>30)scale=.04;}g.scale.y=scale;}
    try{this.renderer.render(this.scene,this.camera);}catch{this.fail('render');return;}this.dirty=false;const info=this.renderer.info.render,elapsed=performance.now()-start;this.samples.push(elapsed);if(this.samples.length>36)this.samples.shift();
    window.ROOMISH_RENDER_STATS={tier:this.tier,calls:info.calls,triangles:info.triangles,pixels:this.renderer.domElement.width*this.renderer.domElement.height,textures:this.renderer.info.memory.textures};
    const tooMany=info.calls>(this.tier?50:100)||info.triangles>(this.tier?50000:100000),slow=this.samples.length>=30&&this.samples.reduce((a,b)=>a+b,0)/this.samples.length>(this.tier?50:34);
    if(tooMany||slow){if(!this.tier){this.tier=1;this.renderer.shadowMap.enabled=false;this.resize();this.samples=[];this.dirty=true;}else this.fail('budget');}
  }
  fail(reason){if(this.stopped)return;this.stopped=true;cancelAnimationFrame(this.frame);this.onFallback?.(reason);}
  destroy(){this.stopped=true;cancelAnimationFrame(this.frame);document.removeEventListener('visibilitychange',this.visibility);this.resizeObserver.disconnect();this.controls.dispose();const done=new Set();this.scene.traverse(o=>{if(o.geometry&&!done.has(o.geometry)){o.geometry.dispose();done.add(o.geometry);}for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){if(m.map&&!done.has(m.map)){m.map.dispose();done.add(m.map);}if(!done.has(m)){m.dispose();done.add(m);}}});this.renderer.dispose();this.renderer.domElement.remove();}
  async capture(){const bg=this.scene.background;this.scene.background=new T.Color(this.night?'#c6cbbb':'#eaece1');if(this.selector)this.selector.visible=false;if(this.handle)this.handle.visible=false;if(this.ghost)this.ghost.visible=false;try{this.renderer.render(this.scene,this.camera);return snapshot(this.renderer.domElement);}finally{this.scene.background=bg;if(this.selector)this.selector.visible=true;if(this.handle)this.handle.visible=true;if(this.ghost)this.ghost.visible=true;this.dirty=true;}}
}

class FlatScene{
  constructor(host,catalog,cb){this.host=host;this.catalog=catalog;this.cb=cb;this.canvas=document.createElement('canvas');this.canvas.className='flat-canvas';host.appendChild(this.canvas);this.ctx=this.canvas.getContext('2d');this.walk=false;this.editRooms=false;this.readonly=false;this.snap=true;this.resizeObserver=new ResizeObserver(()=>this.draw());this.resizeObserver.observe(host);this.canvas.addEventListener('pointerdown',e=>this.down(e));this.canvas.addEventListener('pointermove',e=>this.move(e));this.canvas.addEventListener('pointerup',e=>this.up(e));this.canvas.addEventListener('pointercancel',()=>{this.drag=null;this.draw();});window.ROOMISH_RENDER_STATS={tier:2,renderer:'canvas2d'};}
  rebuild(p){this.plan=p;this.draw();}select(s){this.selected=s;this.draw();}fit(){this.draw();}lighting(n){this.night=n;this.draw();}exit(){this.walk=false;}enter(){this.cb.message('flatMode');return false;}setPending(f){this.pending=f;this.draw();}thumbnails(){return new Map(this.catalog.furniture.map(f=>[f.id,`./assets/furniture/${f.id}.png`]));}
  point(e){const rect=this.canvas.getBoundingClientRect();return{x:(e.clientX-rect.left-this.offsetX)/this.scale,z:(e.clientY-rect.top-this.offsetZ)/this.scale};}
  draw(){if(!this.plan||document.hidden)return;const rect=this.host.getBoundingClientRect(),w=rect.width,h=rect.height,dpr=Math.min(devicePixelRatio||1,1.5);this.canvas.width=Math.max(1,w*dpr);this.canvas.height=Math.max(1,h*dpr);this.canvas.style.width=w+'px';this.canvas.style.height=h+'px';const ctx=this.ctx;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle=this.night?'#c8cfbd':'#eaece1';ctx.fillRect(0,0,w,h);const b=bounds(this.plan.rooms);this.scale=Math.min((w-48)/b.w,(h-260)/b.d);this.scale=Math.max(8,this.scale);this.offsetX=(w-b.w*this.scale)/2-b.x*this.scale;this.offsetZ=(h-b.d*this.scale)/2-b.z*this.scale;
    const x=v=>this.offsetX+v*this.scale,z=v=>this.offsetZ+v*this.scale;ctx.lineJoin='round';for(const r of this.plan.rooms){ctx.fillStyle=this.catalog.materials.find(m=>m.id===r.floor).color;ctx.fillRect(x(r.x),z(r.z),r.w*this.scale,r.d*this.scale);ctx.strokeStyle=this.selected?.id===r.id?'#a76345':'#fbf8ed';ctx.lineWidth=4;ctx.strokeRect(x(r.x),z(r.z),r.w*this.scale,r.d*this.scale);ctx.fillStyle='#596149';ctx.font='11px sans-serif';ctx.fillText(r.name,x(r.x)+8,z(r.z)+17);if(this.editRooms&&this.selected?.id===r.id){ctx.fillStyle='#a76345';ctx.beginPath();ctx.arc(x(r.x+r.w),z(r.z+r.d),8,0,Math.PI*2);ctx.fill();}}
    for(const item of this.plan.items){const o=this.drag?.id===item.id?this.drag.candidate:item;ctx.save();ctx.translate(x(o.x),z(o.z));ctx.rotate(-o.angle*Math.PI/180);ctx.fillStyle=o.color;ctx.globalAlpha=o.catalogId==='rug'?.55:1;ctx.fillRect(-o.w*this.scale/2,-o.d*this.scale/2,o.w*this.scale,o.d*this.scale);ctx.strokeStyle=this.selected?.id===o.id?'#a76345':'#716e5f';ctx.lineWidth=this.selected?.id===o.id?2:1;ctx.strokeRect(-o.w*this.scale/2,-o.d*this.scale/2,o.w*this.scale,o.d*this.scale);ctx.restore();}
    ctx.fillStyle='#69765e';ctx.font='11px sans-serif';ctx.fillText(this.catalog.ui.flatMode,18,h-185);
  }
  down(e){if(this.readonly)return;const p=this.point(e);if(this.pending){this.cb.place(this.pending,p);return;}const r=roomAt(this.plan,p.x,p.z);let o=this.plan.items.slice().reverse().find(i=>Math.abs(i.x-p.x)<i.w/2&&Math.abs(i.z-p.z)<i.d/2);if(this.editRooms&&r){this.cb.select({kind:'room',id:r.id});this.drag={kind:Math.abs(p.x-r.x-r.w)<.35&&Math.abs(p.z-r.z-r.d)<.35?'resize':'room',id:r.id,original:{...r},candidate:{...r},start:p};}else if(o){this.cb.select({kind:'item',id:o.id});this.drag={kind:'item',id:o.id,original:{...o},candidate:{...o},start:p};}else this.cb.select(r?{kind:'room',id:r.id}:null);this.canvas.setPointerCapture(e.pointerId);}
  move(e){if(!this.drag)return;const p=this.point(e),o=this.drag.original,dx=p.x-this.drag.start.x,dz=p.z-this.drag.start.z,snap=v=>this.snap?round(v*10)/10:round(v);this.drag.moved=Math.hypot(dx,dz)>.06;this.drag.candidate=this.drag.kind==='resize'?{...o,w:Math.max(1.5,snap(o.w+dx)),d:Math.max(1.5,snap(o.d+dz))}:{...o,x:snap(o.x+dx),z:snap(o.z+dz)};this.draw();}
  up(){const d=this.drag;this.drag=null;if(d?.moved)this.cb.move(d);this.draw();}
  async capture(){this.draw();return snapshot(this.canvas);}
}

export class RoomScene{
  constructor(host,catalog,callbacks){let current;const fallback=reason=>{const old=current,plan=old?.plan,selected=old?.selected;old?.destroy?.();host.innerHTML='';current=new FlatScene(host,catalog,callbacks);if(plan)current.rebuild(plan);if(selected)current.select(selected);current.editRooms=old?.editRooms||false;current.readonly=old?.readonly||false;current.snap=old?.snap!==false;callbacks.message('flatMode');window.ROOMISH_RENDER_STATS={tier:2,renderer:'canvas2d',reason};};
    try{current=new BudgetScene(host,catalog,callbacks);current.onFallback=fallback;}catch{fallback('webgl-unavailable');}
    return new Proxy({},{get(_target,key){const value=current[key];return typeof value==='function'?value.bind(current):value;},set(_target,key,value){current[key]=value;return true;}});
  }
}
