// Local fallbacks used by recipe editing and responsive canvases on older WebViews.
if(!Array.prototype.at)Object.defineProperty(Array.prototype,'at',{value:function(index){index=Math.trunc(index)||0;return this[index<0?this.length+index:index];},configurable:true,writable:true});
if(!Array.prototype.flatMap)Object.defineProperty(Array.prototype,'flatMap',{value:function(fn,thisArg){return [].concat(...this.map(fn,thisArg));},configurable:true,writable:true});
if(!window.structuredClone)window.structuredClone=value=>JSON.parse(JSON.stringify(value));
if(!Element.prototype.replaceChildren)Element.prototype.replaceChildren=function(...nodes){while(this.firstChild)this.removeChild(this.firstChild);this.append(...nodes);};
if(!window.ResizeObserver)window.ResizeObserver=class{constructor(callback){this.callback=callback;this.handler=()=>callback([]);this.active=false;}observe(){if(!this.active){window.addEventListener('resize',this.handler);this.active=true;}this.handler();}disconnect(){window.removeEventListener('resize',this.handler);this.active=false;}};
