export function createSound(settings){
  let context=null,enabled=false,pour=null,output=null;
  const voices=new Set();
  function ready(){
    if(!enabled)return null;
    if(!context){
      context=new AudioContext();output=context.createDynamicsCompressor();
      output.threshold.value=-14;output.knee.value=20;output.ratio.value=3;
      output.attack.value=.025;output.release.value=.22;output.connect(context.destination);
    }
    if(context.state==='suspended')void context.resume().catch(()=>{});
    return context;
  }
  // Rounded envelopes and a small rising rebound replace the old percussive bass sweep.
  function bubble(ctx,destination,{pitch=330,length=.48,level=.22,land=false}={}){
    const now=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type='sine';
    osc.frequency.setValueAtTime(pitch*.88,now);
    osc.frequency.exponentialRampToValueAtTime(pitch*1.13,now+.07);
    osc.frequency.exponentialRampToValueAtTime(pitch*.74,now+length*.48);
    osc.frequency.exponentialRampToValueAtTime(pitch*(land?.85:1.02),now+length*.72);
    osc.frequency.exponentialRampToValueAtTime(pitch*.9,now+length);
    gain.gain.setValueAtTime(0,now);
    gain.gain.linearRampToValueAtTime(level,now+.045);
    gain.gain.exponentialRampToValueAtTime(level*.42,now+length*.43);
    gain.gain.linearRampToValueAtTime(level*.56,now+length*.62);
    gain.gain.exponentialRampToValueAtTime(.0001,now+length);
    osc.connect(gain);gain.connect(destination);
    let ended=false;
    const voice={stop(){if(ended)return;const t=ctx.currentTime;gain.gain.cancelScheduledValues(t);gain.gain.setTargetAtTime(0,t,.018);osc.stop(t+.09);voices.delete(voice)}};
    osc.onended=()=>{ended=true;osc.disconnect();gain.disconnect();voices.delete(voice)};
    voices.add(voice);osc.start(now);osc.stop(now+length+.03);return voice;
  }
  function impact(kind='poke'){
    const ctx=ready();if(!ctx)return;
    while(voices.size>=settings.maxVoices)voices.values().next().value.stop();
    const land=kind==='land';
    bubble(ctx,output,{pitch:(land?255:365)*( .96+Math.random()*.08),length:land?.72:.5,level:settings.volume*(land?.9:.72),land});
  }
  function stopPour(){
    if(!pour)return;const current=pour;pour=null;
    clearInterval(current.timer);clearTimeout(current.endTimer);
    const now=context.currentTime;
    current.gain.gain.cancelScheduledValues(now);current.gain.gain.setTargetAtTime(0,now,.025);
    current.source.stop(now+.15);
  }
  function startPour(duration=null){
    const ctx=ready();if(!ctx||pour)return;
    const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=buffer.getChannelData(0);
    let soft=0;for(let i=0;i<data.length;i++){soft=(soft+.035*(Math.random()*2-1))/1.035;data[i]=soft*3;}
    const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
    source.buffer=buffer;source.loop=true;filter.type='lowpass';filter.frequency.value=650;filter.Q.value=.45;
    gain.gain.setValueAtTime(0,ctx.currentTime);gain.gain.linearRampToValueAtTime(settings.pourVolume,ctx.currentTime+.09);
    source.connect(filter);filter.connect(gain);gain.connect(output);
    const current={source,gain,timer:null,endTimer:null};pour=current;
    const gurgle=()=>{if(pour!==current)return;while(voices.size>=settings.maxVoices)voices.values().next().value.stop();bubble(ctx,gain,{pitch:290+Math.random()*190,length:.22+Math.random()*.1,level:.5})};
    gurgle();current.timer=setInterval(gurgle,185);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect()};source.start();
    if(duration)current.endTimer=setTimeout(()=>{if(pour===current)stopPour()},duration*1000);
  }
  return {impact,startPour,stopPour,setEnabled(value){enabled=value;if(!value){stopPour();for(const v of [...voices])v.stop()}},suspend(){stopPour();for(const v of [...voices])v.stop();if(context?.state==='running')void context.suspend()}};
}
