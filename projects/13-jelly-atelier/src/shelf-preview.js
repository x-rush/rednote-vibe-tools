import {createAtelier} from './scene.js';
// In-memory canvas previews only. Recipes remain the sole persisted data.
export function createShelfPreview(content){
  let scene=null,host=null,queue=[],running=false,generation=0;
  const cache=new Map();
  function attach(target,canvas){target.replaceChildren(canvas);target.classList.add('rendered-jelly');target.style.clipPath='none';target.style.background='none'}
  async function run(){if(running)return;running=true;const ticket=generation;
    try{while(queue.length&&ticket===generation){const {recipe,target,key}=queue.shift();if(!target.isConnected)continue;
      if(!scene){host=document.createElement('div');host.className='shelf-render-studio';document.body.append(host);scene=createAtelier(host,content,{preview:true,showcase:true});}
      scene.reset();scene.setRecipe(recipe,'ready',1);
      for(let i=0;i<3;i++)await new Promise(requestAnimationFrame);
      if(ticket!==generation)break;
      const source=host.querySelector('canvas'),canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;canvas.getContext('2d').drawImage(source,0,0);canvas.setAttribute('aria-hidden','true');cache.set(key,canvas);if(cache.size>content.limits.collection)cache.delete(cache.keys().next().value);if(target.isConnected)attach(target,canvas);
    }}catch(error){console.warn('Shelf preview unavailable',error)}finally{if(ticket===generation){scene?.dispose();scene=null;host?.remove();host=null;}running=false;if(queue.length)void run()}
  }
  return {show(recipe,target){const key=JSON.stringify(recipe);if(cache.has(key)){const original=cache.get(key),copy=document.createElement('canvas');copy.width=original.width;copy.height=original.height;copy.getContext('2d').drawImage(original,0,0);attach(target,copy);return}queue.push({recipe,target,key});void run()},close(){generation++;queue=[];scene?.dispose();scene=null;host?.remove();host=null}};
}
