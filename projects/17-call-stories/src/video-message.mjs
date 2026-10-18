// Video bytes and poster frames live only in the current session.
export const videoLimitBytes=20*1024*1024;
export function videoTime(seconds){const n=Math.max(0,Math.floor(Number(seconds)||0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');}
export function disposeMedia(resource){if(!resource)return;if(resource.dispose)resource.dispose();else if(resource.url)URL.revokeObjectURL(resource.url);}

function readBytes(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(new Uint8Array(reader.result));reader.onerror=()=>reject(Error('invalid'));reader.readAsArrayBuffer(file);});}
export function bytesBase64(bytes){let value='';for(let i=0;i<bytes.length;i+=8192)value+=String.fromCharCode.apply(null,bytes.subarray(i,i+8192));return btoa(value);}
export async function createVideoSource(file,{bridge,read=readBytes,urls=URL}={}){
  if(bridge){
    if(typeof bridge.writeTempFile!=='function')throw Error('unsupported');
    // The host accepts MP4 temporary files; never fall back to blob media inside it.
    if(file.type!=='video/mp4'&&!/\.mp4$/i.test(file.name))throw Error('format');
    const bytes=await read(file);
    const result=await bridge.writeTempFile({data:'data:video/mp4;base64,'+bytesBase64(bytes)});
    if(typeof result?.filePath!=='string'||!result.filePath.trim())throw Error('unsupported');
    return {url:result.filePath,dispose(){}};
  }
  const url=urls.createObjectURL(file);let disposed=false;
  return {url,dispose(){if(!disposed){disposed=true;urls.revokeObjectURL(url);}}};
}

function bounded(promise,token){return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>finish(reject,Error('timeout')),20000);
  const cancel=()=>finish(reject,Error('cancelled'));
  function finish(done,value){clearTimeout(timer);if(token.cancel===cancel)token.cancel=null;done(value);}
  token.cancel=cancel;if(token.cancelled){cancel();return;}
  promise.then(value=>finish(resolve,value),error=>finish(reject,error));
});}

export async function prepareVideo(file,{token,labels}){
  if(!file.size||(!file.type.startsWith('video/')&&!/\.(mp4|mov|webm|m4v)$/i.test(file.name)))throw Error('invalid');
  if(file.size>videoLimitBytes)throw Error('large');
  const video=document.createElement('video');video.preload='auto';video.muted=true;video.playsInline=true;
  video.setAttribute('playsinline','');video.setAttribute('webkit-playsinline','');
  let source,ready=false;
  try{
    const pending=createVideoSource(file,{bridge:window.xhs?(window.xhs.miniTool||{}):undefined});
    pending.then(resource=>{if(token.cancelled)resource.dispose();},()=>{});
    source=await bounded(pending,token);
    if(token.cancelled)throw Error('cancelled');
    await bounded(new Promise((resolve,reject)=>{
      video.onloadeddata=resolve;video.onerror=()=>reject(Error('invalid'));video.src=source.url;video.load();
    }),token);
    if(!Number.isFinite(video.duration)||video.duration<=0||!video.videoWidth||!video.videoHeight)throw Error('invalid');
    const canvas=document.createElement('canvas'),scale=Math.min(480/video.videoWidth,480/video.videoHeight,1);
    canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
    canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
    const posterUrl=canvas.toDataURL('image/jpeg',.8);
    const resource={kind:'video',url:source.url,posterUrl,width:video.videoWidth,height:video.videoHeight,duration:video.duration,dispose:()=>source.dispose()};
    ready=true;return resource;
  }catch(error){const code=error.message;throw Error(code==='cancelled'?code:labels[code]||labels.invalid);}
  finally{video.onloadeddata=null;video.onerror=null;video.pause();video.removeAttribute('src');video.load();if(!ready)source?.dispose();}
}
