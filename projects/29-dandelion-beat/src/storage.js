(function(){
let native=null,ready=false;const values={};
const api=window.xhs&&window.xhs.miniTool;
function read(key){if(native)return values[key]||null;try{return localStorage.getItem(key);}catch(error){return null;}}
async function initialize(){let options=window.xhs&&window.xhs.launchOptions;if(!options&&api&&typeof api.getLaunchOptions==='function'){try{options=await api.getLaunchOptions();}catch(error){}}
const version=options&&options.miniToolEnv&&Number(options.miniToolEnv.buildVersion);if(Math.floor((version||0)/1000)>=9460&&api&&typeof api.getStorage==='function'&&typeof api.setStorage==='function'){native=api;for(let key of ['grass-offset','grass-muted']){try{const result=await api.getStorage({key});values[key]=result.data==null?null:JSON.parse(result.data);}catch(error){values[key]=null;}}}ready=true;}
async function write(key,value){await loaded;if(native){try{await native.setStorage({key,data:JSON.stringify(value)});values[key]=value;return true;}catch(error){return false;}}try{localStorage.setItem(key,value);return true;}catch(error){return false;}}
const loaded=initialize();window.GameStorage={read,write,loaded,isReady:()=>ready};
})();
