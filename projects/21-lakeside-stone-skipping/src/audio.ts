export class Sound {
 context:AudioContext|null=null;master:GainNode|null=null;buffers:AudioBuffer[]=[];sources=new Set<AudioBufferSourceNode>();enabled=false;last=-1;token=0;
 constructor(public gain:number,public error:()=>void){}
 async toggle():Promise<boolean>{
  if(this.enabled){this.stop();this.enabled=false;return false;}
  try{
   const C=window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
   if(!C)throw Error("audio");
   if(!this.context){this.context=new C();this.master=this.context.createGain();this.master.gain.value=this.gain;this.master.connect(this.context.destination);this.makeBuffers();}
   const token=++this.token;await this.context.resume();if(token!==this.token)return false;
   this.enabled=this.context.state==="running";return this.enabled;
  }catch{this.enabled=false;this.error();return false;}
 }
 makeBuffers():void{
  const ctx=this.context!;let seed=3109;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let v=0;v<4;v++){const n=Math.floor(ctx.sampleRate*(.22+v*.018)),b=ctx.createBuffer(1,n,ctx.sampleRate),a=b.getChannelData(0);let smooth=0;
   for(let i=0;i<n;i++){const t=i/ctx.sampleRate,noise=random()*2-1;smooth=smooth*.62+noise*.38;const attack=Math.min(1,t/.003);a[i]=attack*(smooth*Math.exp(-t*24)*.65+noise*Math.exp(-t*14)*.10+Math.sin(2*Math.PI*(210-v*12)*t)*Math.exp(-t*70)*.24);}this.buffers.push(b);}
 }
 hit(strength:number,mass:number,bounce:boolean,index:number):void{
  if(!this.enabled||!this.context||this.context.state!=="running"||!this.master)return;
  const ctx=this.context;let i=Math.floor(Math.random()*4);if(i===this.last)i=(i+1)%4;this.last=i;
  if(this.sources.size>=5){const first=this.sources.values().next().value;if(first){try{first.stop();}catch{}this.sources.delete(first);}}
  const source=ctx.createBufferSource(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();const weight=Math.min(3,Math.sqrt(mass/.075));filter.type="lowpass";filter.frequency.value=bounce?4800:Math.max(500,2400/weight);source.buffer=this.buffers[i];source.playbackRate.value=Math.max(.35,(.94+Math.min(.18,strength*.015))/Math.max(1,weight*.85));gain.gain.value=(.35+Math.min(.65,strength*.06*weight))/Math.sqrt(1+index*.3);source.connect(filter);filter.connect(gain);gain.connect(this.master);this.sources.add(source);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();this.sources.delete(source);};source.start();
 }
 stop():void{this.token++;this.sources.forEach(s=>{try{s.stop();}catch{}s.disconnect();});this.sources.clear();}
}
