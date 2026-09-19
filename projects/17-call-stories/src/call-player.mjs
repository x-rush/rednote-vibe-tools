export function createCallPlayer({audioFactory=src=>new Audio(src),schedule=setTimeout,cancel=clearTimeout}={}){
  let generation=0,audio=null,timers=new Set(),muted=false;
  const stop=()=>{generation++;for(const id of timers)cancel(id);timers.clear();if(audio){audio.onended=null;audio.onerror=null;audio.pause();audio.removeAttribute?.('src');audio=null;}};
  function start(config){stop();const token=generation;const valid=()=>generation===token;const later=(fn,ms)=>{const id=schedule(()=>{timers.delete(id);if(valid())fn();},ms);timers.add(id);return id;};
    function segment(index){if(!valid())return;const item=config.script.segments[index];config.onSegment?.(index);let completed=false,failed=false,loadTimer=null;
      const finish=()=>{if(completed||!valid())return;completed=true;if(loadTimer!==null){cancel(loadTimer);timers.delete(loadTimer);}config.onWaiting?.();if(config.mode==='intro')return;const last=index===config.script.segments.length-1;if(last){if(config.script.autoEnd)later(()=>config.onEnd?.(),item.pause*1000);return;}later(()=>segment(index+1),(config.pause||item.pause)*1000);};
      const fallback=()=>{if(failed||completed||!valid())return;failed=true;config.onError?.(item.file);if(audio){audio.onended=null;audio.onerror=null;audio.pause();audio=null;}later(finish,Math.max(3000,Math.min(12000,item.text.length/4.5*1000)));};
      if(!config.available.includes(item.file)){fallback();return;}
      try{audio=audioFactory(`./assets/audio/${item.file}`);audio.muted=muted;audio.onended=finish;audio.onerror=fallback;loadTimer=later(fallback,15000);Promise.resolve(audio.play()).then(()=>{if(valid()&&loadTimer!==null){cancel(loadTimer);timers.delete(loadTimer);}},fallback);}catch{fallback();}
    }segment(0);
  }
  return {start,stop,setMuted(value){muted=value;if(audio)audio.muted=value;}};
}
