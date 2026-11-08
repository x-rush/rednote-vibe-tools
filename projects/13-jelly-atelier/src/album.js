export const CARD_VERSION='2.0.49';

export async function saveCardToAlbum(bridge,data){
 if(!bridge||typeof bridge.saveImageToPhotosAlbum!=='function')throw new Error('unavailable');
 if(!/^data:image\/png;base64,/.test(data))throw new Error('invalid image');
 let filePath=data;
 if(typeof bridge.writeTempFile==='function'){const temp=await bridge.writeTempFile({data});if(temp?.errMsg&&/fail|cancel/i.test(temp.errMsg))throw new Error(temp.errMsg);if(!temp?.filePath)throw new Error('missing temporary file');filePath=temp.filePath;}
 const result=await bridge.saveImageToPhotosAlbum({filePath});if(result?.errMsg&&/fail|cancel/i.test(result.errMsg))throw new Error(result.errMsg);
}

export function cardFileName(name){return `${name||'果冻慢慢'}-v${CARD_VERSION}.png`;}

function imageBlob(data){
 if(!/^data:image\/png;base64,/.test(data))throw new Error('invalid image');
 const raw=atob(data.slice(data.indexOf(',')+1)),bytes=new Uint8Array(raw.length);
 for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
 return new Blob([bytes],{type:'image/png'});
}

function mobileDevice(){
 const ua=navigator.userAgent||'';
 return /Android|iPhone|iPad|iPod|Mobile|HarmonyOS/i.test(ua)||(/Macintosh/.test(ua)&&(navigator.maxTouchPoints||0)>1);
}

function showImageOverlay(url,tip,closeLabel){
 const layer=document.createElement('dialog');layer.style.cssText='padding:24px 18px;border:none;border-radius:18px;max-width:92vw;background:#fff9ee;color:#754b59;text-align:center;';
 const image=document.createElement('img');image.src=url;image.alt='分享卡片';image.style.cssText='display:block;max-width:82vw;max-height:72vh;margin:0 auto;border-radius:12px;';
 const hint=document.createElement('p');hint.textContent=tip;hint.style.cssText='margin:14px 0 12px;font-size:15px;line-height:1.6;';
 const close=document.createElement('button');close.type='button';close.className='soft-button';close.textContent=closeLabel;
 let closed=false;const done=()=>{if(closed)return;closed=true;layer.close();layer.remove();URL.revokeObjectURL(url);};
 layer.append(image,hint,close);layer.onclose=done;close.onclick=done;document.body.append(layer);layer.showModal();
 return layer;
}

function openImage(url,tip,closeLabel){
 const win=window.open(url,'_blank');
 if(win)win.opener=null;
 if(win)return 'window';
 showImageOverlay(url,tip,closeLabel);
 return 'inline';
}

export function saveCardOutsideBridge(data,name,tip,closeLabel){
 const url=URL.createObjectURL(imageBlob(data));
 const release=()=>URL.revokeObjectURL(url);
 if(mobileDevice()){if(openImage(url,tip,closeLabel)==='inline')return 'inline';setTimeout(release,60000);return 'window';}
 const anchor=document.createElement('a');
 if('download' in anchor){
  anchor.href=url;anchor.download=cardFileName(name);anchor.style.display='none';
  document.body.append(anchor);anchor.click();anchor.remove();
  setTimeout(release,60000);
  return 'download';
 }
 const mode=openImage(url,tip,closeLabel);
 if(mode==='window')setTimeout(release,60000);
 return mode;
}
