(function(){
const mul=(a,b)=>{let o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;};
const id=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
function matrix(x,y,z,sx,sy,sz,rx=0,ry=0,rz=0){let m=id();m[12]=x;m[13]=y;m[14]=z;for(let [axis,a] of [[0,rx],[1,ry],[2,rz]]){let r=id(),c=Math.cos(a),s=Math.sin(a);if(axis===0){r[5]=c;r[6]=s;r[9]=-s;r[10]=c;}if(axis===1){r[0]=c;r[2]=-s;r[8]=s;r[10]=c;}if(axis===2){r[0]=c;r[1]=s;r[4]=-s;r[5]=c;}m=mul(m,r);}let scale=id();scale[0]=sx;scale[5]=sy;scale[10]=sz;return mul(m,scale);}
function lookAt(eye,center){const norm=v=>{let l=Math.hypot(...v);return v.map(n=>n/l);};let z=norm(eye.map((v,i)=>v-center[i])),x=norm([z[2],0,-z[0]]),y=[z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-z[1]*x[0]];const dot=v=>v.reduce((a,n,i)=>a+n*eye[i],0);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x),-dot(y),-dot(z),1]);}
window.makeScene=function(canvas){let low=false,disposed=false,lost=false;const policy=CONTENT.rendering;const stats={drawCalls:0,triangles:0,pixels:0,dpr:0,quality:'default'};const gl=canvas.getContext('webgl',{antialias:true,alpha:false});if(!gl)throw Error('此设备暂不支持 WebGL 3D');
function shader(type,src){let s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
let p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,'attribute vec3 a;attribute vec3 n;attribute vec3 tint;varying vec3 rgb;uniform mat4 m;uniform mat4 vp;uniform float span;varying vec3 normal;varying vec3 pos;void main(){rgb=tint;vec3 vertex=a;vertex.y+=(step(0.,a.y)*2.-1.)*span;vec4 w=m*vec4(vertex,1.);pos=w.xyz;vec3 scales=vec3(dot(m[0].xyz,m[0].xyz),dot(m[1].xyz,m[1].xyz),dot(m[2].xyz,m[2].xyz));normal=normalize(mat3(m)*(n/scales));gl_Position=vp*w;}'));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,'precision mediump float;varying vec3 rgb;varying vec3 normal;varying vec3 pos;void main(){float l=.60+.40*max(0.,dot(normalize(normal),normalize(vec3(-.5,1.,.8))));vec3 col=rgb*l;float fog=smoothstep(8.,22.,length(pos));gl_FragColor=vec4(mix(col,vec3(.14,.20,.25),fog*.65),1.);}'));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error('3D shader link failed');gl.useProgram(p);let loc={tint:gl.getAttribLocation(p,'tint'),a:gl.getAttribLocation(p,'a'),n:gl.getAttribLocation(p,'n'),m:gl.getUniformLocation(p,'m'),vp:gl.getUniformLocation(p,'vp'),color:gl.getUniformLocation(p,'color'),span:gl.getUniformLocation(p,'span')};
let vertices=[];const steps=12,rings=8;function point(u,v){return [Math.sin(v)*Math.cos(u),Math.cos(v),Math.sin(v)*Math.sin(u)];}for(let j=0;j<rings;j++)for(let i=0;i<steps;i++){let a=point(i/steps*Math.PI*2,j/rings*Math.PI),b=point((i+1)/steps*Math.PI*2,j/rings*Math.PI),c=point((i+1)/steps*Math.PI*2,(j+1)/rings*Math.PI),d=point(i/steps*Math.PI*2,(j+1)/rings*Math.PI);for(let v of [a,b,c,a,c,d])vertices.push(...v,...v);}let buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);for(let [l,off]of [[loc.a,0],[loc.n,12]]){gl.enableVertexAttribArray(l);gl.vertexAttribPointer(l,3,gl.FLOAT,false,24,off);}gl.enable(gl.DEPTH_TEST);
// Capsule hemispheres have separate equators, so the central band keeps full joint thickness.
let capsuleVertices=[];
function capPoint(i,j){let ring=j>rings/2?j-1:j,v=point(i/steps*Math.PI*2,ring/rings*Math.PI);if(j===rings/2)v[1]=.000001;if(j===rings/2+1)v[1]=-.000001;return v;}
for(let j=0;j<rings+1;j++)for(let i=0;i<steps;i++){let a=capPoint(i,j),b=capPoint(i+1,j),c=capPoint(i+1,j+1),d=capPoint(i,j+1);for(let v of [a,b,c,a,c,d])capsuleVertices.push(...v,...v);}
const capsuleBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,capsuleBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(capsuleVertices),gl.STATIC_DRAW);
// Reused vertex/color staging buffer merges the entire opaque scene into one draw.
let batch=new Float32Array(3000000),used=0;const batchBuffer=gl.createBuffer();
function append(data,m,color,span=0){let count=data.length/6,need=used+count*9;if(need>batch.length){let next=new Float32Array(Math.max(need,batch.length*2));next.set(batch);batch=next;}const xScale=m[0]*m[0]+m[1]*m[1]+m[2]*m[2],yScale=m[4]*m[4]+m[5]*m[5]+m[6]*m[6],zScale=m[8]*m[8]+m[9]*m[9]+m[10]*m[10];for(let j=0;j<data.length;j+=6){let x=data[j],y=data[j+1]+(data[j+1]>=0?span:-span),z=data[j+2],nx=data[j+3]/xScale,ny=data[j+4]/yScale,nz=data[j+5]/zScale;batch[used++]=m[0]*x+m[4]*y+m[8]*z+m[12];batch[used++]=m[1]*x+m[5]*y+m[9]*z+m[13];batch[used++]=m[2]*x+m[6]*y+m[10]*z+m[14];batch[used++]=m[0]*nx+m[4]*ny+m[8]*nz;batch[used++]=m[1]*nx+m[5]*ny+m[9]*nz;batch[used++]=m[2]*nx+m[6]*ny+m[10]*nz;batch[used++]=color[0];batch[used++]=color[1];batch[used++]=color[2];}}
function flush(){gl.bindBuffer(gl.ARRAY_BUFFER,batchBuffer);gl.bufferData(gl.ARRAY_BUFFER,batch.subarray(0,used),gl.DYNAMIC_DRAW);for(let pair of [[loc.a,0],[loc.n,12],[loc.tint,24]]){gl.enableVertexAttribArray(pair[0]);gl.vertexAttribPointer(pair[0],3,gl.FLOAT,false,36,pair[1]);}gl.uniform1f(loc.span,0);gl.uniformMatrix4fv(loc.m,false,id());gl.drawArrays(gl.TRIANGLES,0,used/9);stats.drawCalls=1;stats.triangles=used/27;}
function coarsePrimitive(capsule){let data=[],steps=8,rings=6;function at(i,j){let ring=capsule&&j>3?j-1:j,v=point(i/steps*Math.PI*2,ring/rings*Math.PI);if(capsule&&j===3)v[1]=.000001;if(capsule&&j===4)v[1]=-.000001;return v;}for(let j=0;j<rings+(capsule?1:0);j++)for(let i=0;i<steps;i++)for(let v of [at(i,j),at(i+1,j),at(i+1,j+1),at(i,j),at(i+1,j+1),at(i,j+1)])data.push(...v,...v);return data;}
let lowVertices=null,lowCapsules=null;
let parent=id();function ball(x,y,z,sx,sy,sz,color,rx=0,ry=0,rz=0){append(low?lowVertices:vertices,mul(parent,matrix(x,y,z,sx,sy,sz,rx,ry,rz)),color);}
function limb(a,b,width,color){let y=b.map((v,i)=>v-a[i]),len=Math.hypot(...y);if(len<.00001)return;y=y.map(v=>v/len);let x=Math.abs(y[1])<.99?[y[2],0,-y[0]]:[1,0,0],l=Math.hypot(...x);x=x.map(v=>v/l);let z=[x[1]*y[2]-x[2]*y[1],x[2]*y[0]-x[0]*y[2],x[0]*y[1]-x[1]*y[0]],m=new Float32Array([x[0]*width,x[1]*width,x[2]*width,0,y[0]*width,y[1]*width,y[2]*width,0,z[0]*width,z[1]*width,z[2]*width,0,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,1]);append(low?lowCapsules:capsuleVertices,mul(parent,m),color,len/(2*width));}
function flatMesh(data,color){append(data,parent,color);}
function addPoint(a,b,u){return a.map((v,i)=>v+b[i]*u);}
function ribbon(rows,widths,color){let data=[];for(let j=0;j<rows.length-1;j++){let a=rows[j],b=rows[j+1],w=widths[j],v=widths[j+1],points=[[a[0]-w,a[1],a[2]],[a[0]+w,a[1],a[2]],[b[0]+v,b[1],b[2]],[b[0]-v,b[1],b[2]]];for(let k of [0,1,2,0,2,3])data.push(...points[k],0,0,1);}flatMesh(data,color);}
let model=Character.create();
const look=window.CONTENT.appearance;const skin=look.skin,shirt=look.jacket,pants=look.pants,shoe=look.shoe,accent=look.accent;
return {stats,setLow(){if(!low){low=true;stats.quality='low';model=Character.create(.085);lowVertices=coarsePrimitive(false);lowCapsules=coarsePrimitive(true);}},dispose(){disposed=true;gl.deleteBuffer(buffer);gl.deleteBuffer(capsuleBuffer);gl.deleteBuffer(batchBuffer);gl.deleteProgram(p);},render(t,attack,feedback={}){if(disposed||lost)return;used=0;const hero=feedback.hero||{head:[0,.86,1.25],roll:0,dodge:0,hurt:0,result:null},dodge=hero.dodge,hurt=hero.hurt;const pose=Motion.pose(t,attack),p=pose,rig=Character.rig(p);let w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,low?1:policy.defaultDpr,Math.sqrt((low?policy.lowPixels:policy.defaultPixels)/Math.max(1,w*h)));if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}stats.pixels=canvas.width*canvas.height;stats.dpr=dpr;gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.14,.20,.25,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);let asp=w/h,f=Math.min(1/Math.tan(.70/2),asp*4.5),proj=new Float32Array([f/asp,0,0,0,0,f,0,0,0,0,-1.002,-1,0,0,-.2002,0]);let view=matrix(0,-.6,-9.8,1,1,1,.13,0,0);
const cam=Motion.camera(t,p);let shake=feedback.shake||[0,0,0];view=lookAt(cam.eye.map((v,i)=>v+shake[i]),cam.aim.map((v,i)=>v+shake[i]));
gl.uniformMatrix4fv(loc.vp,false,mul(proj,view));parent=id();ball(0,-.22,0,12,.2,12,[.24,.29,.31]);for(let i=low?0:-3;i<(low?0:4);i++)for(let j=-2;j<3;j++)ball(i*1.8,-.05,j*1.5, .87,.045,.71,[(i+j)%2?.28:.32,.35,.35]);ball(0,.02,1.2,.65,.025,.43,[.26,.31,.23]);
for(let i=0;i<2;i++){let foot=p.feet[i],contact=1-Math.min(1,Math.max(0,foot[1]-.15)/.7);ball(foot[0],.004,foot[2]+.06,.20+.05*contact,.008,.31+.07*contact,[.19+.05*(1-contact),.24+.04*(1-contact),.25+.04*(1-contact)],0,p.footYaw[i],0);}
// The tiny hero sits closest to the camera; all attack tips converge here.
// Root remains planted; the flower and upper stem arc away only after a successful judgement.
let head=hero.head.slice();if(!attack&&!dodge&&!hurt)head[0]+=Math.sin(t*3)*.018;
const root=[0,.04,1.25],tip=[head[0],head[1]-.055,head[2]-.07],control=[head[0]*.12,.48,1.25];
const stem=u=>root.map((v,k)=>v*(1-u)*(1-u)+2*control[k]*(1-u)*u+tip[k]*u*u);let last=root;
for(let i=1;i<=10;i++){let next=stem(i/10);limb(last,next,.035,[.23,.43,.16]);last=next;}
// Petioles start on the very same bent stem, rather than on an independent leaf group.
for(let i=0;i<4;i++){
 let sign=i%2?1:-1,a=stem(.13+i*.14),middle=[a[0]+sign*.13,a[1]+.045,a[2]+.025],end=[a[0]+sign*(.39-i*.035),a[1]+.11,a[2]-.04];limb(a,middle,.021,[.26,.46,.17]);
 let axis=end.map((v,k)=>v-middle[k]),length=Math.hypot(axis[0],axis[1]),side=[-axis[1]/length,axis[0]/length,0],rows=Array.from({length:9},(_,j)=>{let u=j/8,row=addPoint(middle,axis,u);row[1]+=.025*Math.sin(u*Math.PI);return row;}),widths=rows.map((_,j)=>.08*Math.pow(Math.sin(j/8*Math.PI),.8)),data=[];
 for(let j=0;j<rows.length-1;j++){let a=rows[j],b=rows[j+1],w=widths[j],v=widths[j+1],points=[addPoint(a,side,-w),[a[0],a[1],a[2]+w*.35],addPoint(a,side,w),addPoint(b,side,-v),[b[0],b[1],b[2]+v*.35],addPoint(b,side,v)];for(let k of [0,1,4,0,4,3,1,2,5,1,5,4])data.push(...points[k],0,.25,1);}
 flatMesh(data,[.30,.51,.18]);limb(middle,end,.008,[.50,.65,.28]);
}
ball(...tip,.08,.10,.07,[.30,.48,.16]);parent=matrix(...head,1,1,1,0,0,hero.roll);
ball(0,0,0,.145,.14,.12,hurt?[.95,.36,.18]:[.98,.72,.12]);for(let ring=0;ring<2;ring++)for(let i=0;i<22;i++){let a=i*Math.PI*2/22+ring*.14,r=ring?.12:.20;ball(Math.cos(a)*r,Math.sin(a)*r,(ring?-.01:-.025)+(hero.near||0)*Math.sin(a*2+t*32)*.015,.035,ring?.075:.095,.028,hurt?[1,.51,.12]:[1,.83,.18],0,0,a-Math.PI/2);}
for(let side of [-1,1]){if(hurt){ball(side*.05,.015,.125,.014,.035,.012,[.20,.27,.12],0,0,.65);ball(side*.05,.015,.125,.014,.035,.012,[.20,.27,.12],0,0,-.65);}else ball(side*.05,.015,.125,.018,dodge&&side===1?.008:.027,.012,[.16,.24,.13]);}ball(0,-.06,.13,.027,.008,.009,[.29,.31,.12]);parent=id();
if(hurt){for(let i=0;i<6;i++){let a=i*Math.PI/3;limb([head[0]+Math.cos(a)*.25,head[1]+Math.sin(a)*.25,head[2]+.16],[head[0]+Math.cos(a)*.38,head[1]+Math.sin(a)*.38,head[2]+.16],.02,[1,.27,.12]);}}
// Shared world-space skeleton: attack tips use Motion.target, never a separate visual offset.
function frameAt(pos,up,right){let dot=right.reduce((s,v,i)=>s+v*up[i],0);let x=right.map((v,i)=>v-dot*up[i]),len=Math.hypot(...x);x=x.map(v=>v/len);let z=[x[1]*up[2]-x[2]*up[1],x[2]*up[0]-x[0]*up[2],x[0]*up[1]-x[1]*up[0]];return new Float32Array([...x,0,...up,0,...z,0,...pos,1]);}
// Welded garment surfaces share smooth skin weights; there are no separate shoulder or knee balls.
parent=id();flatMesh(Character.deform(model.pants,p,'pants',rig),pants);flatMesh(Character.deform(model.shirt,p,'shirt',rig),shirt);for(let i=0;i<2;i++)flatMesh(Character.deform(model.arms[i],p,'arm'+i,rig),skin);
for(let i=0;i<2;i++){
 parent=id();
 let shoeSize=attack&&attack.type==='kick'&&(attack.side||0)===i?.90+.15*p.strike:.90;parent=matrix(...p.feet[i],shoeSize,shoeSize,shoeSize,0,p.footYaw[i],0);
 ball(0,-.07,.05,.245,.06,.40,[.075,.07,.065]);flatMesh(model.shoe.data,shoe);
 ball(0,.14,.02,.18,.018,.18,[.20,.18,.17]);for(let j=0;j<7;j++){let a=j*Math.PI/6;ball(Math.cos(a)*.17,.11,.16+Math.sin(a)*.12,.013,.009,.013,[.36,.30,.24]);}
 parent=id();
 let hand=p.hands[i],handSize=attack&&attack.type==='slap'&&(attack.side||0)===i?.65+(.20+.25*p.strike)*p.attackWeight:.65+.18*p.spin;parent=matrix(...hand,handSize,handSize,handSize,p.spin<.1?-.3*(1-p.strike):0,p.handYaw[i],p.spin<.1?(i?.22:-.22):0);
 ball(0,0,0,.29,.085,.24,skin);ball(0,.025,0,.26,.08,.20,[.90,.65,.45]);
 for(let j=0;j<4;j++){let x=-.20+j*.13,z=.22+(.08-Math.abs(j-1.5)*.025);ball(x,0,z,.056,.07,.17,skin);ball(x,-.006,z+.12,.052,.065,.09,[.89,.63,.43]);ball(x,.053,z+.15,.033,.012,.043,[.96,.80,.65]);ball(x,.064,z,.048,.012,.012,[.75,.49,.32]);}
 ball(-.31,-.01,.025,.12,.07,.075,skin,0,-.7,0);ball(-.37,-.01,.09,.075,.065,.10,skin,0,-.5,0);
}
parent=id();
// Buttons, placket and folds sample the same deformed shirt surface.
for(let j=0;j<3;j++)ball(...Character.cloth(p,.02,-.27-j*.17,.012),.018,.018,.012,[.48,.48,.45]);
for(let j=0;j<12;j++)limb(Character.cloth(p,0,-.14-j*.05),Character.cloth(p,0,-.19-j*.05),.004,[.80,.81,.76]);
let pocket=[];for(let [x,y] of [[.15,-.22],[.33,-.22],[.31,-.42],[.15,-.22],[.31,-.42],[.16,-.42]])pocket.push(...Character.cloth(p,x,y,.012),...rig.f.front);flatMesh(pocket,[.86,.87,.81]);limb(Character.cloth(p,.15,-.22,.02),Character.cloth(p,.33,-.22,.02),.006,[.64,.65,.60]);
for(let side of [-1,1])for(let j=0;j<2;j++)limb(Character.cloth(p,side*(.27+j*.035),-.67+j*.055,.012),Character.cloth(p,side*(.39+j*.025),-.63+j*.055,.012),.004,[.76,.77,.71]);
parent=frameAt(p.shoulder,p.up,p.right);
// Shirt hem covers the belt instead of a floating belt primitive crossing the cloth.
ribbon([[-.015,.015,.16],[-.13,-.08,.26],[-.08,-.17,.29]],[.06,.075,0],shirt);ribbon([[.015,.015,.16],[.13,-.08,.26],[.08,-.17,.29]],[.06,.075,0],shirt);
if(p.tie.neck>.001){let n=p.tie.neck,sway=p.tie.flutter,rows=Array.from({length:21},(_,j)=>{let u=j/20,width=(.045+.035*u)*(1-Math.max(0,(u-.85)/.15));return [sway*u*2,-.18-.55*n*u,width*n];}),data=[];parent=id();ball(...Character.cloth(p,0,-.13,.05),.055*n,.065*n,.035,accent);for(let j=0;j<rows.length-1;j++){let [x,y,w]=rows[j],[x2,y2,w2]=rows[j+1],points=[Character.cloth(p,x-w,y,.045),Character.cloth(p,x+w,y,.045),Character.cloth(p,x2+w2,y2,.045),Character.cloth(p,x2-w2,y2,.045)];for(let k of [0,1,2,0,2,3])data.push(...points[k],...rig.f.front);}flatMesh(data,accent);parent=frameAt(p.shoulder,p.up,p.right);}

parent=mul(parent,mul(matrix(0,.08,0,1,1,1,p.headTilt||0,0,0),matrix(0,-.08,0,1,1,1)));
ball(0,.05,0,.135,.15,.135,skin);flatMesh(model.head.data,skin);
const gag=p.gag||{stun:0,cross:0,tongue:0};
for(let side of [-1,1]){ball(side*.34,.4,0,.09,.13,.075,skin);ball(side*.36,.4,.045,.045,.08,.022,[.76,.42,.32]);ball(side*.12,.46,.273,.095,.065+gag.stun*.025,.035,[.98,.96,.88]);ball(side*(.12-.035*gag.cross),.44+gag.stun*.02,.307,.030,.030,.018,pants);ball(side*.12,.50+gag.stun*.05,.29,.10,.035,.027,skin);ball(side*.12,.37,.285,.08,.018,.018,[.71,.46,.35]);ball(side*.12,.57+gag.stun*.055,.277,.11,.024,.028,pants,0,0,side*(-.12+p.strike*.25+gag.stun*.35-gag.cross*.25));ball(side*.23,.33,.263,.11,.065,.024,[.80,.31,.27]);}
ball(0,.37,.31,.085,.10,.08,skin);ball(0,.22,.27,.15-gag.stun*.08,.065+gag.stun*.035,.035,pants);if(gag.tongue>.001){ball(.025,.17-gag.tongue*.035,.31,.09*gag.tongue,.105*gag.tongue,.025,[.85,.32,.35],0,0,.3);limb([.025,.14,.337],[.025,.18,.337],.004,[.62,.18,.24]);}else ball(0,.235,.302,.12*(1-gag.stun*.8),.022,.018,shoe);for(let side of [-1,1])ball(side*.075,.31,.284,.10,.025,.025,pants,0,0,side*.18);
if(gag.stun>.01){ball(-.30,.55,.28,.037*gag.stun,.075*gag.stun,.025,[.48,.80,.86]);ball(-.30,.62,.28,.018*gag.stun,.035*gag.stun,.018,[.62,.90,.94]);}
// Receding hairline, sideburns and sleepy flushed face; no cap or headphones.
for(let side of [-1,1]){ball(side*.28,.58,-.08,.09,.20,.25,pants);ball(side*.30,.40,.03,.045,.10,.08,pants);}
ball(0,.62,-.22,.26,.13,.13,pants);for(let j=0;j<5;j++)ball(-.12+j*.055,.75,.01,.022,.08,.028,pants,0,0,.4);
for(let j=0;j<9;j++){let a=j*Math.PI/8;ball(Math.cos(a)*.19,.19-Math.sin(a)*.035,.22+Math.sin(a)*.05,.013,.020,.012,[.36,.31,.28]);}
if(p.tie.wrap>.001){let data=[],n=32,progress=p.tie.wrap;for(let j=0;j<n;j++){let a=-Math.PI*progress+2*Math.PI*progress*j/n,b=-Math.PI*progress+2*Math.PI*progress*(j+1)/n;for(let [angle,dy]of [[a,-.045],[a,.045],[b,.045],[a,-.045],[b,.045],[b,-.045]])data.push(Math.sin(angle)*.355,.58+dy,Math.cos(angle)*.325,Math.sin(angle),0,Math.cos(angle));}flatMesh(data,accent);}
if(p.tie.knot>.001){let k=p.tie.knot,w=p.tie.flutter;ball(0,.58,-.35,.075*k,.065*k,.06,accent);ribbon([[0,.58,-.35],[.25*k,.58-.05*k,-.35-.08*k],[(.51+w)*k,.58+(-.14+w)*k,-.35-.13*k],[(.67+w)*k,.58-.18*k,-.35-.09*k]],[.05*k,.055*k,.05*k,0],accent);ribbon([[0,.56,-.35],[-.18*k,.56-.13*k,-.35-.08*k],[(-.36-w)*k,.56+(-.26-w)*k,-.35-.09*k],[(-.48-w)*k,.56-.30*k,-.35-.03*k]],[.045*k,.05*k,.045*k,0],accent);}
parent=id();
if(p.tie.held>.001){let a=p.hands[0],b=p.hands[1],mid=a.map((v,i)=>(v+b[i])*.5+(i===1?-.14:0)),dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1,side=[-dy/l,dx/l,0],rows=[a,mid,b],data=[];for(let j=0;j<2;j++){let corners=[addPoint(rows[j],side,-.045),addPoint(rows[j],side,.045),addPoint(rows[j+1],side,.045),addPoint(rows[j+1],side,-.045)];for(let k of [0,1,2,0,2,3])data.push(...corners[k],0,0,1);}flatMesh(data,accent);}
let bag=p.bag;ball(...bag,.30,.23,.09,[.19,.13,.09]);for(let side of [-1,1])limb([bag[0]+side*.11,bag[1]+.18,bag[2]],[bag[0]+side*.11,bag[1]+.33,bag[2]],.022,[.14,.09,.06]);limb([bag[0]-.11,bag[1]+.33,bag[2]],[bag[0]+.11,bag[1]+.33,bag[2]],.022,[.14,.09,.06]);
if(p.fallen){for(let j=0;j<5;j++){let a=t*3+j*Math.PI*2/5,x=p.head[0]+Math.cos(a)*.32,y=p.head[1]+.38,z=p.head[2]+Math.sin(a)*.28;ball(x,y,z,.025,.08,.025,[1,.85,.2],0,0,.6);ball(x,y,z,.08,.025,.025,[1,.85,.2]);}}
parent=id();
if(feedback.cue){let cue=feedback.cue,point=cue.type==='slap'?p.hands[cue.side]:cue.type==='headbutt'?p.head:p.feet[cue.side],r=cue.type==='headbutt'?.35:.25;for(let i=0;i<3;i++){let a=-.8+i*.65;limb([point[0]+Math.cos(a)*r,point[1]+Math.sin(a)*r,point[2]+.12],[point[0]+Math.cos(a+.28)*r,point[1]+Math.sin(a+.28)*r,point[2]+.12],.009,[1,.70,.30]);}}
if(!low&&p.spin>.9){for(let j=1;j<7;j++){let a=p.angle-j*.11;ball(1.7*Math.sin(a),.86,-.45+1.7*Math.cos(a),.055,.025,.09,[.96,.88,.62],0,a,0);}}


flush();
}};
};})();
