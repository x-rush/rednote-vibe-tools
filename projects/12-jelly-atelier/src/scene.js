import {contourSolid,contourSurface} from './custom-geometry.js';
import {customScale,interiorSpot} from './contour.js';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {sampleUnmold,pokeWave,clamp,smooth,mulberry32,moldPoint} from './engine.js';

export function createAtelier(element, content, callbacks) {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(devicePixelRatio);
  renderer.setClearColor('#f5eee6');
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.94;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  element.append(renderer.domElement);
  const scene=new THREE.Scene();
  scene.background=new THREE.Color('#f5eee6');
  scene.fog=new THREE.Fog('#f5eee6',16,32);
  const camera=new THREE.PerspectiveCamera(33,1,.1,60);
  const composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.12,.38,2.0);
  composer.addPass(bloom);composer.addPass(new OutputPass());
  const envScene=new RoomEnvironment();
  const pmrem=new THREE.PMREMGenerator(renderer);
  const env=pmrem.fromScene(envScene,.025);
  scene.environment=env.texture;
  scene.environmentIntensity=.8;
  envScene.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight('#fff5e7','#cc9f9f',1.15));
  const key=new THREE.DirectionalLight('#fff5ea',3.1);
  key.position.set(-3.8,7,4.5);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-5;key.shadow.camera.right=5;key.shadow.camera.top=5;key.shadow.camera.bottom=-5;
  key.shadow.normalBias=.025;key.shadow.bias=-.0003;key.shadow.radius=5;
  scene.add(key);
  const rim=new THREE.DirectionalLight('#ffd8d7',2.4);rim.position.set(4,3,-3);scene.add(rim);
  const fill=new THREE.DirectionalLight('#e5ebff',1.2);fill.position.set(1,3,6);scene.add(fill);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(150,150),new THREE.MeshStandardMaterial({color:'#d2bfb0',roughness:.82,metalness:0}));
  ground.rotation.x=-Math.PI/2;ground.position.y=-.045;ground.receiveShadow=true;scene.add(ground);

  // All surfaces and textures are authored locally; no external environment images.
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=256;shadowCanvas.height=256;
  const shadowCtx=shadowCanvas.getContext('2d');
  const shadowGrad=shadowCtx.createRadialGradient(128,128,10,128,128,128);
  shadowGrad.addColorStop(0,'rgba(100,46,59,.25)');shadowGrad.addColorStop(.45,'rgba(100,46,59,.13)');shadowGrad.addColorStop(1,'rgba(100,46,59,0)');shadowCtx.fillStyle=shadowGrad;shadowCtx.fillRect(0,0,256,256);
  const shadowTexture=new THREE.CanvasTexture(shadowCanvas);
  const contact=new THREE.Mesh(new THREE.PlaneGeometry(5.8,5.8),new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}));
  contact.rotation.x=-Math.PI/2;contact.position.y=-.035;scene.add(contact);

  const group=new THREE.Group();scene.add(group);
  const ceramic=new THREE.MeshPhysicalMaterial({color:'#fff8ef',roughness:.19,metalness:.03,clearcoat:1,clearcoatRoughness:.16,envMapIntensity:.8});
  const plateProfile=[[0,.06],[1.15,.06],[1.5,.085],[1.76,.15],[1.98,.25],[2.08,.29],[2.11,.25],[2.04,.18],[1.78,.08],[1.5,.015],[.75,.005],[0,.005]].map(([x,y])=>new THREE.Vector2(x,y));
  const plate=new THREE.Mesh(new THREE.LatheGeometry(plateProfile,160),ceramic);plate.castShadow=true;plate.receiveShadow=true;group.add(plate);
  const gold=new THREE.MeshPhysicalMaterial({color:'#cdb289',metalness:.82,roughness:.24});
  const lip=new THREE.Mesh(new THREE.TorusGeometry(2.075,.009,10,160),gold);lip.rotation.x=Math.PI/2;lip.position.y=.271;group.add(lip);
  const innerLip=new THREE.Mesh(new THREE.TorusGeometry(1.6,.004,8,128),gold);innerLip.rotation.x=Math.PI/2;innerLip.position.y=.118;group.add(innerLip);
  const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(.86,.87,.09,96),ceramic);pedestal.position.y=-.009;group.add(pedestal);

  const syrupMat=new THREE.MeshPhysicalMaterial({color:content.flavors[0].syrup,roughness:.12,metalness:.02,transmission:.5,thickness:.1,transparent:true,opacity:.65,clearcoat:1});
  const syrup=new THREE.Mesh(new THREE.CircleGeometry(1.43,128),syrupMat);syrupeffect(syrup);group.add(syrup);
  function syrupeffect(mesh){mesh.rotation.x=-Math.PI/2;mesh.position.y=.107;const a=mesh.geometry.attributes.position;for(let i=1;i<a.count;i++){const x=a.getX(i),y=a.getY(i),ang=Math.atan2(y,x),s=1+Math.sin(ang*7)*.012+Math.cos(ang*3)*.02;a.setXY(i,x*s,y*s)}a.needsUpdate=true;}

  const profile=new THREE.CatmullRomCurve3([[0,.14,0],[1.02,.14,0],[1.18,.19,0],[1.26,.3,0],[1.24,.48,0],[1.13,1.12,0],[.98,1.65,0],[.83,1.79,0],[.60,1.815,0],[0,1.815,0]].map(x=>new THREE.Vector3(...x)));
  const profilePoints=profile.getPoints(82).map(v=>new THREE.Vector2(Math.max(0,v.x),v.y));
  let geometry=new THREE.LatheGeometry(profilePoints,160);
  let pos=geometry.attributes.position;
  const circular=Float32Array.from(pos.array);
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),angle=Math.atan2(z,x);const ribs=1+.065*Math.cos(angle*12)*smooth(Math.hypot(x,z)/.4);pos.setXYZ(i,x*ribs,y,z*ribs)}
  geometry.computeVertexNormals();
  let base=Float32Array.from(pos.array);
  geometry.setAttribute("restHeight",new THREE.Float32BufferAttribute(Array.from({length:pos.count},(_,i)=>base[i*3+1]),1));
  const jellyMat=new THREE.MeshPhysicalMaterial({color:content.flavors[0].color,roughness:.1,metalness:0,transmission:.78,thickness:1.65,ior:1.38,attenuationColor:content.flavors[0].attenuation,attenuationDistance:1.45,clearcoat:1,clearcoatRoughness:.09,iridescence:.06,iridescenceIOR:1.3,envMapIntensity:1.25,side:THREE.FrontSide});
  const liquidUniforms={uFill:{value:1.83},uSplit:{value:.98},uBottom:{value:new THREE.Color(content.flavors[0].color)},uTop:{value:new THREE.Color(content.flavors[1].color)}};
  jellyMat.color.set('#ffffff');
  jellyMat.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,liquidUniforms);
    shader.vertexShader='attribute float restHeight; varying float vRestHeight;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRestHeight=restHeight;');
    shader.fragmentShader='varying float vRestHeight; uniform float uFill; uniform float uSplit; uniform vec3 uBottom; uniform vec3 uTop;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nif(vRestHeight>uFill)discard; diffuseColor.rgb *= mix(uBottom,uTop,smoothstep(uSplit-.012,uSplit+.012,vRestHeight));');
  };
  const jelly=new THREE.Mesh(geometry,jellyMat);jelly.castShadow=false;jelly.receiveShadow=true;group.add(jelly);
  const jellyGroup=new THREE.Group();group.add(jellyGroup);

  // Tiny trapped air bubbles give the solid a visible depth.
  const random=mulberry32(47);
  const bubbleGeo=new THREE.SphereGeometry(1,12,8);
  const bubbleMat=new THREE.MeshPhysicalMaterial({color:'#fff6e4',roughness:.02,metalness:.08,transmission:.6,thickness:.015,ior:1.07,transparent:true,opacity:.42});
  const bubbles=new THREE.InstancedMesh(bubbleGeo,bubbleMat,46);
  const temp=new THREE.Object3D();
  for(let i=0;i<46;i++){const a=random()*Math.PI*2,r=.45+random()*.4;temp.position.set(Math.cos(a)*r,.35+random()*1.18,Math.sin(a)*r);temp.scale.setScalar(.008+random()*.021);temp.updateMatrix();bubbles.setMatrixAt(i,temp.matrix)}jellyGroup.add(bubbles);

  const garnish=new THREE.Group();garnish.position.y=1.82;group.add(garnish);
  const berryMat=new THREE.MeshPhysicalMaterial({color:'#ad294b',roughness:.25,clearcoat:.65,clearcoatRoughness:.2});
  function berry(x,y,z,size){const berryGroup=new THREE.Group();const berryRandom=mulberry32(89);for(let i=0;i<55;i++){const a=i*2.399963,b=Math.acos(1-2*(i+.5)/55);const bead=new THREE.Mesh(new THREE.SphereGeometry(.033,10,8),berryMat);bead.position.set(Math.cos(a)*Math.sin(b)*.135,Math.cos(b)*.15,Math.sin(a)*Math.sin(b)*.135);bead.scale.setScalar(.9+berryRandom()*.2);berryGroup.add(bead)}berryGroup.scale.setScalar(size);berryGroup.position.set(x,y,z);berryGroup.rotation.z=.28;garnish.add(berryGroup);}

  const mintMat=new THREE.MeshPhysicalMaterial({color:'#577849',roughness:.46,side:THREE.DoubleSide,clearcoat:.2});
  function leaf(x,y,z,angle,scale){const shape=new THREE.Shape();shape.moveTo(0,0);shape.bezierCurveTo(-.15,.10,-.22,.31,0,.52);shape.bezierCurveTo(.22,.30,.15,.09,0,0);const geo=new THREE.ShapeGeometry(shape,20);const p=geo.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,Math.sin(p.getY(i)*5)*.07+Math.abs(p.getX(i))*.15);geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,mintMat);mesh.rotation.x=-Math.PI/2+.16;mesh.rotation.z=angle;mesh.scale.setScalar(scale);mesh.position.set(x,y,z);garnish.add(mesh);const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,.005),new THREE.Vector3(0,.25,.065),new THREE.Vector3(0,.5,.045)]);const vein=new THREE.Mesh(new THREE.TubeGeometry(curve,18,.004,5,false),new THREE.MeshBasicMaterial({color:'#adc393'}));mesh.add(vein);}

  function sugarStar(x,z){const shape=new THREE.Shape();for(let i=0;i<10;i++){const a=i*Math.PI/5,r=i%2?.055:.13;const px=Math.sin(a)*r,py=Math.cos(a)*r;i?shape.lineTo(px,py):shape.moveTo(px,py)}shape.closePath();const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.024,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:.009,bevelThickness:.009}),gold);mesh.rotation.x=-Math.PI/2;mesh.rotation.z=x*5;mesh.position.set(x,.025,z);garnish.add(mesh);}


  const mold=new THREE.Group();group.add(mold);
  let moldGeo=geometry.clone();let moldPos=moldGeo.attributes.position;
  for(let i=0;i<moldPos.count;i++)moldPos.setXYZ(i,moldPos.getX(i)*1.055,moldPos.getY(i)*1.025+.018,moldPos.getZ(i)*1.055);
  const openIndices=[];const oldIndices=moldGeo.index.array;
  for(let i=0;i<oldIndices.length;i+=3){if([oldIndices[i],oldIndices[i+1],oldIndices[i+2]].some(n=>moldPos.getY(n)<1.72))openIndices.push(oldIndices[i],oldIndices[i+1],oldIndices[i+2]);}
  moldGeo.setIndex(openIndices);moldGeo.computeVertexNormals();
  const moldMat=new THREE.MeshPhysicalMaterial({color:'#e6cbcc',roughness:.06,transmission:0,thickness:.09,ior:1.46,clearcoat:1,envMapIntensity:1.6,transparent:true,opacity:.18,side:THREE.DoubleSide,depthWrite:false});
  const shell=new THREE.Mesh(moldGeo,moldMat);mold.add(shell);
  const rimMat=new THREE.MeshPhysicalMaterial({color:'#d8b9ae',roughness:.13,transmission:.65,thickness:.13,ior:1.46,transparent:true,opacity:.65});
  const moldRim=new THREE.Mesh(new THREE.TorusGeometry(1.28,.055,16,160),rimMat);moldRim.rotation.x=Math.PI/2;moldRim.position.y=.16;mold.add(moldRim);

  const surfaceMat=new THREE.MeshPhysicalMaterial({color:content.flavors[0].color,roughness:.09,transmission:.7,thickness:.22,ior:1.38,clearcoat:1,side:THREE.DoubleSide});
  const surface=new THREE.Mesh(new THREE.CircleGeometry(1,160),surfaceMat);surface.rotation.x=-Math.PI/2;group.add(surface);
  let surfaceBase=Float32Array.from(surface.geometry.attributes.position.array);
  const preset={geometry,pos,base,moldGeo,moldPos,surfaceGeo:surface.geometry,surfaceBase};
  let customOutline=null,outlineKey='',pourPoint={x:-.35,z:0};
  const streamMat=surfaceMat.clone();
  const pitcher=new THREE.Group();pitcher.position.set(-.8,2.90,0);pitcher.rotation.z=.65;group.add(pitcher);
  const glass=new THREE.MeshPhysicalMaterial({color:'#fff8f1',roughness:.08,transmission:.92,thickness:.06,ior:1.46,side:THREE.DoubleSide});
  const jug=new THREE.Mesh(new THREE.CylinderGeometry(.29,.23,.7,48,1,true),glass);pitcher.add(jug);
  const jugLiquid=new THREE.Mesh(new THREE.CylinderGeometry(.265,.21,.45,48),streamMat);jugLiquid.position.y=-.1;pitcher.add(jugLiquid);
  const jugHandle=new THREE.Mesh(new THREE.TorusGeometry(.23,.033,12,40,Math.PI*1.4),glass);jugHandle.position.set(-.31,0,0);jugHandle.rotation.z=1;pitcher.add(jugHandle);
  const stream=new THREE.Mesh(new THREE.CylinderGeometry(.037,.06,1,16,24,true),streamMat);group.add(stream);
  let fillAmount=0,splitAmount=.5,craftStage='mold',pouring=false,moldId='flower',firstColor=content.flavors[0].color,secondColor=content.flavors[1].color;
  function outlineGeometry(){
    if(geometry!==preset.geometry){geometry.dispose();moldGeo.dispose();surface.geometry.dispose();}
    if(moldId==='custom'){
      geometry=contourSolid(customOutline);pos=geometry.attributes.position;base=Float32Array.from(pos.array);jelly.geometry=geometry;
      moldGeo=contourSolid(customOutline,{open:true});moldPos=moldGeo.attributes.position;
      for(let i=0;i<moldPos.count;i++)moldPos.setXYZ(i,moldPos.getX(i)*1.055,moldPos.getY(i)+.025,moldPos.getZ(i)*1.055);
      moldGeo.computeVertexNormals();shell.geometry=moldGeo;
      surface.geometry=contourSurface(customOutline);surfaceBase=Float32Array.from(surface.geometry.attributes.position.array);
      const points=customOutline.map(p=>new THREE.Vector3(p.x*customScale(1)*1.055,1.84,p.z*customScale(1)*1.055));points.push(points[0].clone());
      moldRim.geometry.dispose();moldRim.geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,true),customOutline.length*2,.024,10,true);moldRim.rotation.set(0,0,0);moldRim.position.y=0;
      pourPoint=interiorSpot(customOutline)||{x:0,z:0};
      for(let i=0;i<46;i++){const point=interiorSpot(customOutline,i)||pourPoint,h=.15+(i%11)/15;temp.position.set(point.x*customScale(h)/customScale(1),.14+h*1.675,point.z*customScale(h)/customScale(1));temp.scale.setScalar(.012);temp.updateMatrix();bubbles.setMatrixAt(i,temp.matrix)}bubbles.instanceMatrix.needsUpdate=true;
      return;
    }
    ({geometry,pos,base,moldGeo,moldPos,surfaceBase}=preset);jelly.geometry=geometry;shell.geometry=moldGeo;surface.geometry=preset.surfaceGeo;pourPoint={x:-.35,z:0};
    const seed=mulberry32(47);for(let i=0;i<46;i++){const a=seed()*Math.PI*2,r=.45+seed()*.4;temp.position.set(Math.cos(a)*r,.35+seed()*1.18,Math.sin(a)*r);temp.scale.setScalar(.008+seed()*.021);temp.updateMatrix();bubbles.setMatrixAt(i,temp.matrix)}bubbles.instanceMatrix.needsUpdate=true;
    for(let i=0;i<pos.count;i++){const ix=i*3,x=circular[ix],y=circular[ix+1],z=circular[ix+2];const p=moldPoint(Math.atan2(z,x),Math.hypot(x,z),moldId);base[ix]=p.x;base[ix+1]=y;base[ix+2]=p.z;moldPos.setXYZ(i,p.x*1.055,y*1.025+.018,p.z*1.055);}
    moldPos.needsUpdate=true;moldGeo.computeVertexNormals();moldGeo.computeBoundingSphere();
    const points=Array.from({length:161},(_,i)=>{const p=moldPoint(i/160*Math.PI*2,1.01,moldId);return new THREE.Vector3(p.x,1.73,p.z)});
    moldRim.geometry.dispose();moldRim.geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,true),160,.025,10,true);moldRim.rotation.set(0,0,0);moldRim.position.y=0;
  }
  function updateSurface(){
    const y=.14+fillAmount*1.675;
    let radius=.1;
    for(let i=1;i<profilePoints.length;i++){const a=profilePoints[i-1],b=profilePoints[i];if((a.y<=y&&b.y>=y)||(b.y<=y&&a.y>=y)){const t=clamp((y-a.y)/(b.y-a.y||1));radius=Math.max(radius,a.x+(b.x-a.x)*t);}}
    const positions=surface.geometry.attributes.position;
    for(let i=0;i<positions.count;i++){const x=surfaceBase[i*3],z=-surfaceBase[i*3+1],p=moldId==='custom'?{x:x*customScale(fillAmount),z:z*customScale(fillAmount)}:moldPoint(Math.atan2(z,x),Math.hypot(x,z)*radius,moldId);positions.setXYZ(i,p.x,-p.z,0);}
    positions.needsUpdate=true;surface.position.y=y+.004;
    liquidUniforms.uFill.value=fillAmount>=1?2:.14+fillAmount*1.675;
    liquidUniforms.uSplit.value=.14+(craftStage==='pour1'?fillAmount:splitAmount)*1.675+.001;
    surfaceMat.color.set(craftStage==='pour2'&&fillAmount>splitAmount+1e-6?secondColor:firstColor);
  }
  let lastToppings=null;
  function setToppings(toppings){
    const signature=JSON.stringify(toppings);if(signature===lastToppings)return;lastToppings=signature;
    for(const child of [...garnish.children]){child.traverse(o=>{if(o.isMesh){o.geometry.dispose();if(![berryMat,mintMat,gold].includes(o.material))o.material.dispose()}});garnish.remove(child)}
    for(const t of toppings){if(t.kind==='berry')berry(t.x,.15,t.z,.9);else if(t.kind==='mint')leaf(t.x,.03,t.z,1.1,.65);else sugarStar(t.x,t.z);}
  }
  outlineGeometry();updateSurface();

  // Delicate syrup beads on the porcelain, with genuine environment highlights.
  for(let i=0;i<5;i++){const drop=new THREE.Mesh(new THREE.SphereGeometry(.04+random()*.035,20,14),syrupeffectMaterial());drop.position.set(1.36+random()*.30,.15,-.22+i*.18);drop.scale.y=.42;group.add(drop)}
  const splashDrops=[];
  for(let i=0;i<22;i++){const a=i/22*Math.PI*2;const drop=new THREE.Mesh(new THREE.SphereGeometry(.024+random()*.016,16,10),syrupMat);drop.userData={angle:a,speed:.6+random()*.5,up:.75+random()*.8};drop.visible=false;group.add(drop);splashDrops.push(drop);}
  function syrupeffectMaterial(){return syrupMat;}
  const spoonMat=new THREE.MeshPhysicalMaterial({color:'#d7b992',metalness:.94,roughness:.22,clearcoat:.4});
  const spoon=new THREE.Group();const bowl=new THREE.Mesh(new THREE.SphereGeometry(1,40,28,0,Math.PI*2,Math.PI*.46,Math.PI*.50),spoonMat);bowl.scale.set(.24,.07,.37);bowl.rotation.z=Math.PI;spoon.add(bowl);
  const handleCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,.30),new THREE.Vector3(0,.03,.7),new THREE.Vector3(.02,.015,1.35)]);
  const handle=new THREE.Mesh(new THREE.TubeGeometry(handleCurve,40,.043,12,false),spoonMat);handle.scale.x=1.4;spoon.add(handle);spoon.position.set(2.20,.08,-.50);spoon.rotation.y=-.24;spoon.traverse(o=>{if(o.isMesh)o.castShadow=true});group.add(spoon);

  const caustic=new THREE.Mesh(new THREE.PlaneGeometry(5,5),new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:{value:0},tint:{value:new THREE.Color(content.flavors[0].color)}},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform float time;uniform vec3 tint;void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float a=atan(p.y,p.x);float bands=pow(max(0.,sin(r*40.+sin(a*12.+time*.5)*1.4)),10.);float halo=exp(-pow((r-.57)*10.,2.));gl_FragColor=vec4(mix(vec3(1.,.9,.75),tint,.3),halo*bands*.18);}' }));caustic.rotation.x=-Math.PI/2;caustic.position.y=-.024;scene.add(caustic);

  let mode='molded',start=0,time=0,last=performance.now(),landed=false,onDone=null,drag=null,orbit=0,targetOrbit=0,hover=new THREE.Vector2(),width=1,height=1;
  const pokes=[];const raycaster=new THREE.Raycaster();const pointer=new THREE.Vector2();
  function resize(){width=element.clientWidth;height=element.clientHeight;if(!width||!height)return;renderer.setSize(width,height,false);composer.setSize(width,height);camera.aspect=width/height;camera.clearViewOffset();if(width>640&&!callbacks.preview)camera.setViewOffset(width,height,-width*.145,0,width,height);camera.updateProjectionMatrix();}
  const observer=new ResizeObserver(resize);observer.observe(element);resize();
  function pointerRay(event){const rect=element.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObject(jelly)[0];}
  function poke(point=new THREE.Vector3(.4,1.35,1)){if(mode!=='ready')return false;const local=group.worldToLocal(point.clone());pokes.push({time,point:local});if(pokes.length>content.motion.maxPokes)pokes.shift();callbacks.onPoke?.();return true;}
  element.addEventListener('pointerdown',event=>{const hit=pointerRay(event);if(craftStage==='decorate'&&hit){const point=group.worldToLocal(hit.point.clone());callbacks.onPlace?.({x:point.x,z:point.z,top:point.y>=1.74});return;}if(hit&&mode==='ready'){poke(hit.point);return}drag={x:event.clientX,angle:targetOrbit};element.setPointerCapture(event.pointerId);});
  element.addEventListener('pointermove',event=>{hover.set(event.clientX/width-.5,event.clientY/height-.5);if(drag)targetOrbit=clamp(drag.angle+(event.clientX-drag.x)*.004,-.6,.6);element.style.cursor=(mode==='ready'||craftStage==='decorate')&&pointerRay(event)?'pointer':drag?'grabbing':'grab';});
  function release(){drag=null;}element.addEventListener('pointerup',release);element.addEventListener('pointercancel',release);element.addEventListener('lostpointercapture',release);
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();callbacks.onContextLost?.();});
  const resetFrameClock=()=>{last=performance.now()};document.addEventListener('visibilitychange',resetFrameClock);
  let raf=0;
  function frame(now){raf=requestAnimationFrame(frame);const elapsed=(now-last)/1000,dt=Math.min(elapsed,.05);last=now;if(document.hidden||!element.clientWidth||!element.clientHeight)return;time+=elapsed;
    const duration=reduced.matches?content.motion.reducedUnmoldDuration:content.motion.unmoldDuration;
    const progress=mode==='unmolding'?clamp((time-start)/duration):mode==='ready'?1:0;
    const state=sampleUnmold(progress);
    mold.position.set(state.moldX,state.moldY,0);mold.rotation.z=-state.moldAngle;mold.rotation.x=state.moldAngle*.3;
    moldMat.opacity=state.moldOpacity*(craftStage==='mold'?.35:.18);rimMat.opacity=state.moldOpacity*.65;mold.visible=state.moldOpacity>.001;
    if(mode==='unmolding'&&progress>=.49&&!landed){landed=true;callbacks.onLand?.();}
    if(mode==='unmolding'&&progress>=1){mode='ready';onDone?.();onDone=null;}
    const splashAge=(progress-.49)*duration;
    for(const drop of splashDrops){const d=drop.userData;drop.visible=!reduced.matches&&splashAge>0&&splashAge<.85;const t=clamp(splashAge,0,.85),r=1.18+t*d.speed;drop.position.set(Math.sin(d.angle)*r,.15+Math.max(0,d.up*t-2.5*t*t),Math.cos(d.angle)*r);drop.scale.setScalar(1-smooth((t-.5)/.35));}
    const garnishReveal=craftStage==='decorate'?1:mode==='unmolding'?1:mode==='ready'?1:0;garnish.scale.setScalar(garnishReveal);garnish.visible=garnishReveal>.001;
    while(pokes.length&&time-pokes[0].time>content.motion.pokeDuration)pokes.shift();
    let totalWave=0;
    for(let i=0;i<pos.count;i++){const ix=i*3,x=base[ix],y=base[ix+1],z=base[ix+2],h=clamp((y-.14)/1.68),angle=Math.atan2(z,x);let wave=0,localPress=0;
      for(const pk of pokes){const age=time-pk.time,dist=Math.hypot(x-pk.point.x,(y-pk.point.y)*.7,z-pk.point.z);wave+=pokeWave(age,h,dist)*(reduced.matches?.28:1);localPress+=Math.exp(-dist*dist*7)*Math.sin(clamp(age/.18)*Math.PI)*.14;}
      const breathe=reduced.matches?0:Math.sin(time*1.5+h*1.5)*.0025*h;
      const bounce=state.bounce*(reduced.matches?.35:1);const sx=1+wave+Math.sin(angle*2+time*13)*wave*.23-bounce*.52+localPress*.2;
      pos.setXYZ(i,x*sx+Math.sin(h*Math.PI*.55)*wave*.35,y+state.stretch*h+state.jellyLift+bounce*h+Math.cos(angle)*wave*.12+breathe-localPress,z*(1+wave-bounce*.52));totalWave=wave;
    }
    pos.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
    jelly.visible=fillAmount>.005;jellyGroup.visible=fillAmount>=1;surface.visible=fillAmount>.005&&fillAmount<1;
    syrup.visible=mode==='ready'||mode==='unmolding';
    pitcher.visible=craftStage==='pour1'||craftStage==='pour2';stream.visible=pitcher.visible&&pouring;
    const surfaceY=.14+fillAmount*1.675;
    pitcher.rotation.z=-.35-(pouring?.65:0)+Math.sin(time*2)*.018;
    const px=pourPoint.x*(moldId==='custom'?customScale(fillAmount)/customScale(1):1),pz=pourPoint.z*(moldId==='custom'?customScale(fillAmount)/customScale(1):1);pitcher.position.set(px-.45,2.90,pz);stream.position.set(px,(2.84+surfaceY)/2,pz);stream.scale.y=2.84-surfaceY;stream.scale.x=1+Math.sin(time*20)*.1;
    if(pouring)callbacks.onPourFrame?.(elapsed);
    jellyGroup.position.y=state.jellyLift;jellyGroup.scale.y=1+state.stretch+state.bounce*.3;
    garnish.position.y=1.82+state.jellyLift+state.stretch+state.bounce+totalWave;
    garnish.rotation.z=reduced.matches?0:pokes.reduce((v,pk)=>v+Math.sin((time-pk.time)*14)*Math.exp(-(time-pk.time)*2.8)*.075,0);
    orbit+=(targetOrbit-orbit)*Math.min(dt*5,1);group.rotation.y=orbit;
    const mobile=width<=640;const distance=callbacks.preview?6:mobile?height/width*(moldId==='custom'?6.6:7.5):9.0;const elevation=callbacks.preview?8:moldId==='custom'?distance*.88:mobile?distance*.565:5.25;
    camera.position.set(Math.sin(orbit*.16)*.4+(reduced.matches?0:hover.x*.10),elevation-state.camera*.35,distance-state.camera*.6);
    camera.lookAt(0,mobile?.91:.84,0);
    caustic.material.uniforms.time.value=time;
    composer.render();
  }
  raf=requestAnimationFrame(frame);
  return {
    setRecipe(recipe,stage,amount=1){
      craftStage=stage;fillAmount=amount;splitAmount=recipe.split;
      const nextKey=recipe.mold+JSON.stringify(recipe.outline||[]);if(outlineKey!==nextKey){outlineKey=nextKey;moldId=recipe.mold;customOutline=recipe.outline||null;outlineGeometry();}
      const first=content.flavors.find(f=>f.id===recipe.first),second=content.flavors.find(f=>f.id===recipe.second);
      firstColor=first.color;secondColor=second.color;liquidUniforms.uBottom.value.set(first.color);liquidUniforms.uTop.value.set(second.color);
      jellyMat.attenuationColor.set('#f8d9d1');jellyMat.attenuationDistance=3.5;
      streamMat.color.set(stage==='pour2'?second.color:first.color);syrupMat.color.set(first.syrup);
      caustic.material.uniforms.tint.value.set(first.color);setToppings(recipe.toppings);updateSurface();
      if(stage==='ready'){mode='ready';pokes.length=0;}
    },
    setFill(amount,split){fillAmount=amount;splitAmount=split;updateSurface();},
    setPouring(value){pouring=value;},
    unmold(done){if(mode==='unmolding')return;mode='unmolding';start=time;landed=false;onDone=done;},
    reset(){mode='molded';craftStage='mold';pouring=false;fillAmount=0;updateSurface();pokes.length=0;garnish.visible=false;landed=false;onDone=null;targetOrbit=0;},
    poke(){const point=moldId==='custom'?(interiorSpot(customOutline)||pourPoint):{x:.45,z:.9};return poke(new THREE.Vector3(point.x,1.35,point.z).applyMatrix4(group.matrixWorld));},
    setFlavor(flavor){jellyMat.color.set(flavor.color);jellyMat.attenuationColor.set(flavor.attenuation);syrupMat.color.set(flavor.syrup);berryMat.color.set(flavor.syrup);caustic.material.uniforms.tint.value.set(flavor.color);},
    get state(){return mode;},
    dispose(){const geometries=new Set([preset.geometry,preset.moldGeo,preset.surfaceGeo]),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m)});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();shadowTexture.dispose();document.removeEventListener('visibilitychange',resetFrameClock);cancelAnimationFrame(raf);observer.disconnect();env.dispose();composer.dispose();renderer.dispose();}
  };
}
