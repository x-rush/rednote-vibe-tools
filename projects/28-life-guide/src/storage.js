(function(global){
  'use strict';
  var KEY='life-guide:v1',queue=Promise.resolve();
  function bridge(){var x=global.xhs,api=x&&x.miniTool;return api&&typeof api.getStorage==='function'&&typeof api.setStorage==='function'?api:null;}
  function fallbackRead(){try{var raw=global.localStorage.getItem(KEY);return raw?JSON.parse(raw):null;}catch(ignore){return null;}}
  function timeout(p){return Promise.race([p,new Promise(function(resolve,reject){setTimeout(function(){reject(new Error('storage timeout'));},1800);})]);}
  async function read(){var local=fallbackRead(),api=bridge();if(api){try{var result=await timeout(Promise.resolve(api.getStorage({key:KEY})));if(result&&typeof result.data==='string'&&result.data){var native=JSON.parse(result.data);return local&&Number(local.savedAt)>Number(native&&native.savedAt||0)?local:native;}}catch(ignore){}}return local;}
  function write(state){var serialized=JSON.stringify(state),mirrored=false;try{global.localStorage.setItem(KEY,serialized);mirrored=true;}catch(ignore){}queue=queue.catch(function(){}).then(async function(){var api=bridge();if(api){try{await timeout(Promise.resolve(api.setStorage({key:KEY,data:serialized})));return true;}catch(ignore){}}return mirrored;});return queue;}
  global.LifeStorage={read:read,write:write};
})(window);
