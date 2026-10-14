(function(){
 'use strict';
 window.BootStorage=async function(onError){
  const x=window.xhs,api=x&&x.miniTool;let options=x&&x.launchOptions;
  if(!(options&&options.miniToolEnv&&options.miniToolEnv.buildVersion)&&api&&typeof api.getLaunchOptions==='function'){try{options=await api.getLaunchOptions();}catch(e){options=null;}}
  const version=Math.floor(Number(options&&options.miniToolEnv&&options.miniToolEnv.buildVersion||0)/1000);
  if(version>=9460&&api&&typeof api.getStorage==='function'&&typeof api.setStorage==='function'){
   const key='agent-engineer-lab-dev-2.1';let value=null,readError=null,queue=Promise.resolve();
   try{const result=await api.getStorage({key:key});value=result&&result.data||null;}catch(e){readError=e;}
   function enqueue(job){queue=queue.then(job).catch(function(){onError();});}
   return {getItem:function(name){if(readError)throw readError;return name===key?value:null;},setItem:function(name,text){value=text;enqueue(function(){return api.setStorage({key:name,data:text});});},removeItem:function(name){if(name===key)value=null;if(typeof api.removeStorage==='function')enqueue(function(){return api.removeStorage({key:name});});}};
  }
  try{return window.localStorage;}catch(e){return {getItem:function(){throw e;},setItem:function(){throw e;}};}
 };
}());
