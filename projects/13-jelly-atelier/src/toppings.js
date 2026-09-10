import * as THREE from 'three';
import {mulberry32} from './engine.js';

function finish(group){group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});return group;}
function tube(points,radius,material){return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),24,radius,6,false),material);}

export function raspberry(seed=89){
  const group=new THREE.Group(),random=mulberry32(seed);
  const materials=Array.from({length:5},(_,i)=>new THREE.MeshPhysicalMaterial({color:new THREE.Color().setHSL(.96+i*.004,.80,.25+i*.022).convertSRGBToLinear(),roughness:.39,clearcoat:.22,clearcoatRoughness:.35,transmission:.08,thickness:.045,ior:1.36}));
  const beadGeometry=new THREE.SphereGeometry(1,20,14);
  // A tapered, open fruit: each drupelet has its own size and ruby tone.
  const rows=[{r:.065,y:.03,n:8},{r:.115,y:.074,n:13},{r:.145,y:.124,n:16},{r:.151,y:.178,n:17},{r:.14,y:.23,n:16},{r:.119,y:.274,n:14},{r:.103,y:.307,n:12}];
  for(let row=0;row<rows.length;row++){const {r,y,n}=rows[row];for(let i=0;i<n;i++){
    const angle=(i+(row%2)*.5)/n*Math.PI*2+(random()-.5)*.06;
    const bead=new THREE.Mesh(beadGeometry,materials[Math.floor(random()*materials.length)]);
    bead.position.set(Math.cos(angle)*r,y+(random()-.5)*.008,Math.sin(angle)*r);
    bead.scale.set(.029+random()*.006,.025+random()*.008,.029+random()*.006);bead.rotation.set(random()*.4,angle,random()*.4);group.add(bead);
  }}
  const innerProfile=[[.012,.02],[.065,.035],[.088,.09],[.092,.17],[.077,.26],[.075,.302]].map(([x,y])=>new THREE.Vector2(x,y));
  const inside=new THREE.Mesh(new THREE.LatheGeometry(innerProfile,48),new THREE.MeshStandardMaterial({color:'#701a32',roughness:.78,side:THREE.DoubleSide}));group.add(inside);
  const fuzz=[];for(let i=0;i<95;i++){const a=random()*Math.PI*2,y=.06+random()*.23,r=.13+Math.sin((y-.07)*11)*.025;const x=Math.cos(a)*r,z=Math.sin(a)*r;fuzz.push(x,y,z,x+Math.cos(a)*.009,y+.006,z+Math.sin(a)*.009);}
  const hair=new THREE.BufferGeometry();hair.setAttribute('position',new THREE.Float32BufferAttribute(fuzz,3));group.add(new THREE.LineSegments(hair,new THREE.LineBasicMaterial({color:'#e9a29a',transparent:true,opacity:.22})));
  group.rotation.z=.12;return finish(group);
}

export function mintSprig(seed=37){
  const group=new THREE.Group(),random=mulberry32(seed);
  const veinMaterial=new THREE.MeshStandardMaterial({color:'#81a65a',roughness:.8});
  const leafMaterial=new THREE.MeshPhysicalMaterial({color:'#ffffff',vertexColors:true,roughness:.62,side:THREE.DoubleSide,clearcoat:.08,transmission:.025,thickness:.012});
  function leaf(length,width,angle){
    const leafGroup=new THREE.Group(),vertices=[],colors=[],indices=[],rows=42,cols=12;
    function point(t,u){const serration=1+.065*Math.cos(t*Math.PI*28);const w=Math.pow(Math.sin(Math.PI*t),.8)*width*serration;return new THREE.Vector3(u*w,.016+Math.sin(t*Math.PI)*.046+u*u*.025+Math.sin(t*9)*u*.009,t*length);}
    for(let j=0;j<=rows;j++){const t=j/rows;for(let i=0;i<=cols;i++){const u=i/cols*2-1,p=point(t,u);vertices.push(p.x,p.y,p.z);const c=new THREE.Color().setHSL(.26+random()*.018,.40+random()*.1,.24+Math.abs(u)*.07+random()*.025).convertSRGBToLinear();colors.push(c.r,c.g,c.b);if(j<rows&&i<cols){const a=j*(cols+1)+i;indices.push(a,a+cols+1,a+1,a+1,a+cols+1,a+cols+2);}}}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();leafGroup.add(new THREE.Mesh(geometry,leafMaterial));
    const mid=Array.from({length:12},(_,i)=>{const p=point(i/11,0);p.y+=.002;return p});leafGroup.add(tube(mid,.0025,veinMaterial));
    for(let i=1;i<8;i++)for(const sign of [-1,1]){const t=i/9;const branch=[point(t,0),point(t+.035,sign*.4),point(Math.min(.97,t+.09),sign*.86)];branch.forEach(p=>p.y+=.0018);leafGroup.add(tube(branch,.0012,veinMaterial));}
    leafGroup.rotation.y=angle;group.add(leafGroup);
  }
  leaf(.39,.115,-.65);leaf(.31,.10,1.0);
  group.add(tube([new THREE.Vector3(0,.018,-.05),new THREE.Vector3(0,.018,0),new THREE.Vector3(.01,.026,.11)],.005,veinMaterial));
  const water=new THREE.MeshPhysicalMaterial({color:'#f4ffe5',roughness:.04,transmission:.85,thickness:.02,ior:1.33,clearcoat:1});const dew=new THREE.Mesh(new THREE.SphereGeometry(.014,16,12),water);dew.position.set(-.1,.066,.16);dew.scale.y=.55;group.add(dew);
  group.rotation.y=seed*.19;return finish(group);
}

export function sugarStar(seed=41){
  const group=new THREE.Group(),random=mulberry32(seed),shape=new THREE.Shape();
  const polygon=[];for(let i=0;i<10;i++){const a=i*Math.PI/5,r=i%2?.07:.155;const p=new THREE.Vector2(Math.sin(a)*r,Math.cos(a)*r);polygon.push(p);i?shape.lineTo(p.x,p.y):shape.moveTo(p.x,p.y);}shape.closePath();
  const material=new THREE.MeshPhysicalMaterial({color:'#e9b850',metalness:.16,roughness:.46,clearcoat:.32,clearcoatRoughness:.34,transmission:.10,thickness:.035,ior:1.46});
  const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.031,bevelEnabled:true,bevelSegments:5,steps:1,bevelSize:.009,bevelThickness:.008}),material);mesh.rotation.x=-Math.PI/2;mesh.position.y=.012;group.add(mesh);
  const grains=new THREE.InstancedMesh(new THREE.OctahedronGeometry(.0032),new THREE.MeshPhysicalMaterial({color:'#ffe6a2',metalness:.08,roughness:.28,transmission:.2,thickness:.003,ior:1.46}),130);const dummy=new THREE.Object3D();
  // Barycentric samples stay inside the actual star, including its narrow tips.
  for(let i=0;i<130;i++){const edge=Math.floor(random()*10),a=polygon[edge],b=polygon[(edge+1)%10];let u=random(),v=random();if(u+v>1){u=1-u;v=1-v;}dummy.position.set(a.x*u+b.x*v,.047,-a.y*u-b.y*v);dummy.rotation.set(random()*3,random()*3,random()*3);dummy.scale.setScalar(.65+random()*.9);dummy.updateMatrix();grains.setMatrixAt(i,dummy.matrix);}group.add(grains);group.rotation.y=seed*.3;return finish(group);
}

export function disposeToppings(group){const geometries=new Set(),materials=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const material of Array.isArray(o.material)?o.material:[o.material])materials.add(material)});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());group.clear();}
