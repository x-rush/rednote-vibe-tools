/** Photograph coordinates remain the world reference; only masked natural materials move. */
export interface EnvironmentProfile {water:number[][];sky:number;sun:number[];foliage:number[][];flow:number;waves:number;mist:number;rain:number;current:number[];surface:number}
export interface Frame {x:number;y:number;w:number;h:number}
const vertex='attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
const fragment=`precision mediump float;
varying vec2 uv;uniform sampler2D photo,regions;uniform float time,flow,waves,mist,rain;uniform vec2 texel,current;uniform float surface;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
void main(){vec2 q=vec2(uv.x,1.-uv.y);vec3 mask=texture2D(regions,q).rgb;
 float t=time;
 // Surface coordinates travel downstream; the photographed bed remains anchored.
 vec2 stream=q-current*t*flow;
 vec2 v=stream;

 float a=v.x*53.+v.y*181.+sin(v.x*13.-v.y*19.)*1.7;
 float b=v.x*-79.+v.y*257.+sin(v.y*17.+t*.27)*1.1;
 float depth=.35+.65*q.y;vec2 ripple=vec2(cos(a)+cos(b)*.48,sin(a)*.42+sin(b)*.3);
 vec2 displacement=ripple*vec2(.004,.0018)*depth*waves*mask.r*(1.-mask.g);
 // Cloud shapes advect and gently spread; their lower edge and sun are pinned by the blue mask.
 displacement+=vec2(sin(t*.043+q.y*3.)*.032+sin(t*.031+q.y*8.)*(q.x-.5)*.018,sin(t*.035+q.x*5.)*.004)*mask.b*(1.-min(1.,mask.g*2.));
 // Only the photographed leaf fans move. Trunks, stone banks and the playable ground stay fixed.
 float gust=sin(t*.73+q.y*4.)*.7+sin(t*1.37-q.x*3.)*.3;
 displacement+=vec2(gust*.008,sin(t*.81+q.x*7.)*.002)*mask.g;
 vec3 col=texture2D(photo,clamp(q+displacement,texel,1.-texel)).rgb;
 float crest=pow(max(0.,sin(a+sin(b)*.6)),18.);float crossing=pow(max(0.,sin(b-a*.19)),24.);
 float bright=dot(col,vec3(.23,.59,.18));
 col+=vec3(.93,.93,.79)*(crest*.025+crossing*.018)*mask.r*waves*(.35+bright);
 col*=1.+sin(a)*sin(b)*.045*mask.r*waves;
 // Broken, travelling reflection ribbons reveal the current even above the pan.
 // Two scales avoid a regular grid, and only the water mask receives highlights.
 vec2 travel=vec2(stream.x*12.,stream.y*29.);
 float meander=noise(vec2(q.y*7.-t*.18,q.x*5.))*1.8;
 float ridge=noise(travel+vec2(meander,0.));
 float detail=noise(travel*2.1+vec2(7.,3.));
 float ribbon=smoothstep(.56,.72,ridge)*(1.-smoothstep(.73,.88,ridge));
 float broken=smoothstep(.32,.67,detail);
 float movingLight=ribbon*broken;
 float water=mask.r*(1.-mask.g);
 col=mix(col,col*.78+vec3(.10,.15,.12),water*surface*.13);
 col+=vec3(.86,.92,.75)*movingLight*water*surface*(.45+bright*.45);

 // Rain arrives as expanding, fading rings on the water, never on the banks.
 if(rain>.01){float ring=0.;for(int i=0;i<5;i++){float fi=float(i),age=fract(t*.43+fi*.217),epoch=floor(t*.43+fi*.217);vec2 center=vec2(hash(vec2(fi,epoch)),.35+hash(vec2(epoch,fi+7.))*.65);float d=length((q-center)*vec2(1.,2.8));ring+=exp(-abs(d-age*.045)*950.)*(1.-age);}col+=ring*.11*rain*mask.r;}
 float veil=(noise(q*vec2(4.,8.)+vec2(t*.025,0.))*.65+noise(q*vec2(11.,6.)-vec2(t*.018,0.))*.35)*mist;
 veil*=smoothstep(.07,.2,q.y)*(1.-smoothstep(.55,.83,q.y));col=mix(col,vec3(.72,.79,.72),veil);
 gl_FragColor=vec4(col,1.);}`;
export class EnvironmentMotion {
 canvas=document.createElement('canvas');private output=document.createElement('canvas');private source=document.createElement('canvas');private mask=document.createElement('canvas');
 private gl:WebGLRenderingContext|null=null;private program:WebGLProgram|null=null;private textures:WebGLTexture[]=[];private locations:Record<string,WebGLUniformLocation|null>={};private key='';private failed=false;
 get mode(){return this.failed?'canvas':'webgl';}
 constructor(){this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.failed=true;});this.canvas.addEventListener('webglcontextrestored',()=>{this.key='';this.failed=false;this.init();});this.init();}
 private init(){try{const g=this.canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,preserveDrawingBuffer:true});if(!g){this.failed=true;return;}this.gl=g;const compile=(type:number,code:string)=>{const s=g.createShader(type)!;g.shaderSource(s,code);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(s)||'environment shader');return s;};const a=compile(g.VERTEX_SHADER,vertex),b=compile(g.FRAGMENT_SHADER,fragment),p=g.createProgram()!;g.attachShader(p,a);g.attachShader(p,b);g.linkProgram(p);g.deleteShader(a);g.deleteShader(b);if(!g.getProgramParameter(p,g.LINK_STATUS))throw Error('environment link');this.program=p;g.useProgram(p);const buffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,buffer);g.bufferData(g.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),g.STATIC_DRAW);const at=g.getAttribLocation(p,'p');g.enableVertexAttribArray(at);g.vertexAttribPointer(at,2,g.FLOAT,false,0,0);this.textures=[];for(let i=0;i<2;i++){const tex=g.createTexture()!;this.textures.push(tex);g.activeTexture(g.TEXTURE0+i);g.bindTexture(g.TEXTURE_2D,tex);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);}for(const n of ['photo','regions','time','flow','waves','mist','rain','texel','current','surface'])this.locations[n]=g.getUniformLocation(p,n);g.uniform1i(this.locations.photo,0);g.uniform1i(this.locations.regions,1);}catch{this.failed=true;}}
 draw(image:HTMLImageElement,frame:Frame,profile:EnvironmentProfile,time:number,low=false,reduced=false):HTMLCanvasElement|null{
  if(!image.complete||!image.naturalWidth)return null;const key=image.src+':'+[frame.x,frame.y,frame.w,frame.h,low].join(',');
  if(key!==this.key){this.key=key;const scale=Math.min(1,(low?480:1024)/Math.max(frame.w,frame.h)),w=Math.max(1,Math.round(frame.w*scale)),h=Math.max(1,Math.round(frame.h*scale));this.source.width=this.mask.width=this.canvas.width=w;this.source.height=this.mask.height=this.canvas.height=h;const c=this.source.getContext('2d')!;c.drawImage(image,frame.x,frame.y,frame.w,frame.h,0,0,w,h);const m=this.mask.getContext('2d')!;m.fillStyle='#000';m.fillRect(0,0,w,h);
   if(profile.water.length){m.fillStyle='#f00';m.beginPath();profile.water.forEach(([x,y],i)=>{if(i)m.lineTo(x*w,y*h);else m.moveTo(x*w,y*h);});m.closePath();m.fill();m.strokeStyle='#000';m.lineWidth=2;m.stroke();}
   m.globalCompositeOperation='lighter';for(const [x,y,rx,ry] of profile.foliage){m.save();m.translate(x*w,y*h);m.scale(rx*w,ry*h);const grad=m.createRadialGradient(0,0,0,0,0,1);grad.addColorStop(0,'rgba(0,255,0,1)');grad.addColorStop(.45,'rgba(0,255,0,.85)');grad.addColorStop(1,'rgba(0,255,0,0)');m.fillStyle=grad;m.fillRect(-1,-1,2,2);m.restore();}
   if(profile.sky>0){const grad=m.createLinearGradient(0,0,0,profile.sky*h);grad.addColorStop(0,'#00f');grad.addColorStop(.7,'#00f');grad.addColorStop(1,'#000');m.fillStyle=grad;m.fillRect(0,0,w,profile.sky*h);if(profile.sun.length===3){m.globalCompositeOperation='source-over';const [x,y,r]=profile.sun,sun=m.createRadialGradient(x*w,y*h,r*w*.4,x*w,y*h,r*w);sun.addColorStop(0,'#000');sun.addColorStop(1,'rgba(0,0,0,0)');m.fillStyle=sun;m.fillRect((x-r)*w,(y-r)*h,r*w*2,r*h*2);}}
   m.globalCompositeOperation='source-over';const g=this.gl;if(g&&!this.failed){g.viewport(0,0,w,h);for(const [i,src] of [this.source,this.mask].entries()){g.activeTexture(g.TEXTURE0+i);g.bindTexture(g.TEXTURE_2D,this.textures[i]);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,src);}}
  }
  const g=this.gl;if(!g||this.failed||!this.program)return this.fallback(profile,time,reduced);g.useProgram(this.program);g.uniform1f(this.locations.time,time*(reduced?.18:1));for(const n of ['flow','waves','mist','rain'] as const)g.uniform1f(this.locations[n],profile[n]*(n==='flow'?1:reduced?.3:1));g.uniform2f(this.locations.current,profile.current[0],profile.current[1]);g.uniform1f(this.locations.surface,profile.surface*(reduced?.25:1));g.uniform2f(this.locations.texel,1/this.canvas.width,1/this.canvas.height);g.drawArrays(g.TRIANGLES,0,6);return this.canvas;
 }
 private fallback(p:EnvironmentProfile,time:number,reduced:boolean){const c=this.output;if(c.width!==this.source.width||c.height!==this.source.height){c.width=this.source.width;c.height=this.source.height;}const g=c.getContext('2d')!,w=c.width,h=c.height,t=time*(reduced?.18:1);g.drawImage(this.source,0,0);if(p.water.length){g.save();g.beginPath();p.water.forEach(([x,y],i)=>{if(i)g.lineTo(x*w,y*h);else g.moveTo(x*w,y*h);});g.closePath();g.clip();for(let y=0;y<h;y+=4){const bh=Math.min(4,h-y),d=(Math.sin(y*.055-t*1.6)+Math.sin(y*.023+t*.7))*3*p.waves;g.drawImage(this.source,0,y,w,bh,d-4,y,w+8,bh);}g.globalCompositeOperation='screen';for(let i=0;i<70;i++){const life=(t*p.flow*.085+i*.61803398875)%1,seed=(Math.sin(i*78.23)*43758.5453)%1,x=((seed+1)%1)*w+Math.sin(life*5+i)*w*.025,y=life*h;g.globalAlpha=Math.sin(life*Math.PI)*p.surface*.23;g.strokeStyle='#e3ebc5';g.lineWidth=.6+life;g.beginPath();g.ellipse(x,y,2+life*8,.5+life,Math.sin(i)*.1,0,Math.PI);g.stroke();}g.restore();}if(p.sky>0){g.save();g.beginPath();g.rect(0,0,w,h*p.sky*.8);g.clip();const dx=Math.sin(t*.043)*w*.025;g.drawImage(this.source,0,0,w,h,dx-8,0,w+16,h);g.restore();}return c;}
}
