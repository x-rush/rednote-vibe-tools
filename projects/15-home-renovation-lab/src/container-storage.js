// The offline entry waits for native storage before reading existing plans.
export async function createContainerStorage(host,keys){
  const xhs=host.xhs,bridge=xhs&&xhs.miniTool;
  let options=xhs&&xhs.launchOptions;
  if(!(options&&options.miniToolEnv&&options.miniToolEnv.buildVersion)&&bridge&&typeof bridge.getLaunchOptions==='function'){
    try{options=await bridge.getLaunchOptions();}catch{/* Unknown versions use browser storage. */}
  }
  const version=Math.floor(Number(options&&options.miniToolEnv&&options.miniToolEnv.buildVersion||0)/1000);
  if(!(version>=9460&&bridge&&typeof bridge.getStorage==='function'&&typeof bridge.setStorage==='function')){
    return{kind:'browser',getItem:key=>host.localStorage.getItem(key),setItem:(key,value)=>host.localStorage.setItem(key,value)};
  }
  const cache=new Map(),failures=new Map();let pending=Promise.resolve();
  function write(key,value){
    const data=JSON.stringify(String(value));
    const bytes=typeof TextEncoder==='function'?new TextEncoder().encode(data).length:encodeURIComponent(data).replace(/%[A-F\d]{2}/g,'x').length;
    if(bytes>1024*1024)return Promise.reject(new Error('Storage item exceeds 1 MiB'));
    pending=pending.catch(()=>{}).then(()=>bridge.setStorage({key,data}));
    return pending.then(()=>{cache.set(key,String(value));failures.delete(key);});
  }
  for(const key of keys){
    try{
      const result=await bridge.getStorage({key});
      if(result&&result.data!=null){
        const value=JSON.parse(result.data);if(typeof value!=='string')throw new Error('Invalid stored value');cache.set(key,value);
      }else{
        let previous=null;try{previous=host.localStorage.getItem(key);}catch{/* Browser storage may be unavailable. */}
        if(previous!==null)await write(key,previous);
      }
    }catch(error){failures.set(key,error);}
  }
  return{kind:'native',getItem(key){if(failures.has(key))throw failures.get(key);return cache.has(key)?cache.get(key):null;},setItem:write};
}
