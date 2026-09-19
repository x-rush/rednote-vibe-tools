export function createAudioBank(data,contextFactory=()=>{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('Web Audio unavailable');return new Audio();}){
  let context;const buffers=new Map();
  function unlock(){try{if(!context)context=contextFactory();return Promise.resolve(context.resume());}catch(error){return Promise.reject(error);}}
  async function decode(file){if(!buffers.has(file)){buffers.set(file,new Promise((resolve,reject)=>{try{if(!data[file])throw Error('Audio missing: '+file);const raw=atob(data[file]),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);context.decodeAudioData(bytes.buffer,resolve,reject);}catch(error){reject(error);}}).catch(error=>{buffers.delete(file);throw error;}));}return buffers.get(file);}
  function create(file){file=file.split('/').pop();let generation=0,source=null,gain=null,volume=1,muted=false,started=0,offset=0;
    const audio={loop:false,onended:null,onerror:null,paused:true,
      async play(){const token=++generation;await unlock();const buffer=await decode(file);if(token!==generation)return;source=context.createBufferSource();gain=context.createGain();source.buffer=buffer;source.loop=audio.loop;gain.gain.value=muted?0:volume;source.connect(gain);gain.connect(context.destination);source.onended=()=>{if(token!==generation)return;audio.paused=true;source.disconnect();gain.disconnect();source=null;gain=null;if(audio.onended)audio.onended();};started=context.currentTime;audio.paused=false;source.start(0,offset%buffer.duration);},
      pause(){generation++;if(source){source.onended=null;source.stop();source.disconnect();source=null;}if(gain){gain.disconnect();gain=null;}audio.paused=true;offset=0;},
      removeAttribute(){audio.pause();},
      get volume(){return volume;},set volume(value){volume=value;if(gain)gain.gain.value=muted?0:volume;},
      get muted(){return muted;},set muted(value){muted=value;if(gain)gain.gain.value=muted?0:volume;},
      get currentTime(){return audio.paused?offset:offset+context.currentTime-started;},set currentTime(value){offset=value;}
    };return audio;
  }
  // Callers stop active sources before clearing; pending decodes are not reinserted.
  return {create,unlock,clear(){buffers.clear();}};
}
