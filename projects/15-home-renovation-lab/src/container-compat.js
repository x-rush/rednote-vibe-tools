// Small, feature-tested fallbacks used only by the offline container entry.
(function(){
  if(typeof window.globalThis==='undefined')window.globalThis=window;
  if(!String.prototype.replaceAll)Object.defineProperty(String.prototype,'replaceAll',{value:function(a,b){return this.split(a).join(b);},configurable:true,writable:true});
  if(!Array.prototype.flatMap)Object.defineProperty(Array.prototype,'flatMap',{value:function(fn){return [].concat.apply([],this.map(fn));},configurable:true,writable:true});
  if(!Object.fromEntries)Object.fromEntries=function(entries){var o={};Array.from(entries).forEach(function(pair){Object.defineProperty(o,pair[0],{value:pair[1],enumerable:true,configurable:true,writable:true});});return o;};
  if(!Object.hasOwn)Object.hasOwn=function(o,k){return Object.prototype.hasOwnProperty.call(o,k);};
  if(!window.ResizeObserver)window.ResizeObserver=function(fn){var targets=[],run=function(){fn(targets.map(function(target){return{target:target,contentRect:target.getBoundingClientRect()};}));};this.observe=function(target){targets.push(target);window.addEventListener('resize',run);run();};this.disconnect=function(){window.removeEventListener('resize',run);targets=[];};};
  var prototype=window.HTMLDialogElement&&window.HTMLDialogElement.prototype;
  if(prototype&&!prototype.showModal){prototype.showModal=function(){this.setAttribute('open','');this.open=true;this.setAttribute('aria-modal','true');this.setAttribute('role','dialog');};prototype.close=function(){this.removeAttribute('open');this.open=false;};}
  var test=document.createElement('div');test.style.cssText='position:absolute;visibility:hidden;display:flex;flex-direction:column;row-gap:1px';test.appendChild(document.createElement('div'));test.appendChild(document.createElement('div'));document.body.appendChild(test);if(test.scrollHeight!==1)document.documentElement.classList.add('no-flex-gap');test.parentNode.removeChild(test);
  function viewport(){document.documentElement.style.setProperty('--app-height',(window.visualViewport?window.visualViewport.height:window.innerHeight)+'px');}
  window.addEventListener('resize',viewport);if(window.visualViewport)window.visualViewport.addEventListener('resize',viewport);viewport();
})();
