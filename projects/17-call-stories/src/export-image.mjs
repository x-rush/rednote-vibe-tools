// Paint the same laid-out surface at its actual width. No network/foreignObject.
function loadImage(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('图片加载失败'));image.src=src;});}
function box(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function fitted(ctx,image,x,y,w,h,fit){const ratio=fit==='contain'?Math.min(w/image.width,h/image.height):Math.max(w/image.width,h/image.height),dw=image.width*ratio,dh=image.height*ratio;ctx.drawImage(image,x+(w-dw)/2,y+(h-dh)/2,dw,dh);}
function textLines(node){const range=document.createRange(),lines=[];let offset=0;
  for(const char of Array.from(node.textContent)){range.setStart(node,offset);offset+=char.length;range.setEnd(node,offset);const r=range.getBoundingClientRect();if(!r.width&&!r.height)continue;let line=lines[lines.length-1];if(!line||Math.abs(line.y-r.top)>2){line={x:r.left,y:r.top,height:r.height,text:''};lines.push(line);}line.text+=char;}return lines;
}
function fontBaseline(font){
  // Measure the browser baseline, including CJK fallback fonts, without new Canvas APIs.
  const probe=document.createElement('span'),marker=document.createElement('i');probe.style.cssText='position:absolute;left:-20000px;top:0;white-space:pre;line-height:normal';probe.style.font=font;probe.append(document.createTextNode('Hg国'));marker.style.cssText='display:inline-block;width:0;height:0;vertical-align:baseline';probe.append(marker);document.body.append(probe);
  const range=document.createRange();range.selectNodeContents(probe.firstChild);const value=marker.getBoundingClientRect().top-range.getBoundingClientRect().top;probe.remove();return value;
}
function applyClips(ctx,clips){for(const c of clips){box(ctx,c.x,c.y,c.w,c.h,c.radius);ctx.clip();}}
async function svgImage(node,w,h){
  const svg=node.cloneNode(true);svg.setAttribute('xmlns','http://www.w3.org/2000/svg');svg.setAttribute('width',String(w));svg.setAttribute('height',String(h));
  const originals=[node,...node.querySelectorAll('*')],copies=[svg,...svg.querySelectorAll('*')];
  for(let i=0;i<originals.length;i++){const style=getComputedStyle(originals[i]);for(const property of ['color','fill','fill-opacity','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','opacity','transform','transform-origin']){const value=style.getPropertyValue(property);if(value)copies[i].style.setProperty(property,value);}}
  return loadImage('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg)));
}
function paintBorders(ctx,st,x,y,w,h,radius){
  const top=parseFloat(st.borderTopWidth)||0,right=parseFloat(st.borderRightWidth)||0,bottom=parseFloat(st.borderBottomWidth)||0,left=parseFloat(st.borderLeftWidth)||0;
  if(top&&top===right&&right===bottom&&bottom===left&&st.borderTopColor===st.borderRightColor&&st.borderRightColor===st.borderBottomColor&&st.borderBottomColor===st.borderLeftColor){ctx.strokeStyle=st.borderTopColor;ctx.lineWidth=top;box(ctx,x+top/2,y+top/2,w-top,h-top,Math.max(0,radius-top/2));ctx.stroke();return;}
  if(top){ctx.fillStyle=st.borderTopColor;ctx.fillRect(x,y,w,top);}if(right){ctx.fillStyle=st.borderRightColor;ctx.fillRect(x+w-right,y,right,h);}if(bottom){ctx.fillStyle=st.borderBottomColor;ctx.fillRect(x,y+h-bottom,w,bottom);}if(left){ctx.fillStyle=st.borderLeftColor;ctx.fillRect(x,y,left,h);}
}
export async function captureSurface(surface,onPage){
  const sourceRect=surface.getBoundingClientRect(),sourceStyle=getComputedStyle(surface),width=sourceRect.width;
  const clone=surface.cloneNode(true);clone.classList.add('export-surface');clone.setAttribute('aria-hidden','true');clone.style.width=width+'px';clone.style.minHeight=Math.max(1,sourceRect.height-(parseFloat(sourceStyle.paddingTop)||0)-(parseFloat(sourceStyle.paddingBottom)||0))+'px';clone.querySelectorAll('.export-actions,.moment-action-menu,.moment-composer,.chat-add-row,.chat-edit-card,.chat-people-pop').forEach(el=>el.remove());const originalInputs=surface.querySelectorAll('[data-chat-input]');clone.querySelectorAll('[data-chat-input]').forEach((input,i)=>{const field=document.createElement('div');field.className='chat-export-input';field.textContent=originalInputs[i].value;field.style.height=originalInputs[i].getBoundingClientRect().height+'px';input.replaceWith(field);});document.body.append(clone);
  try{
    if(document.fonts&&document.fonts.ready)await document.fonts.ready;
    const images=new Map();await Promise.all(Array.from(clone.querySelectorAll('img')).map(async img=>images.set(img,await loadImage(img.src))));
    const origin=clone.getBoundingClientRect(),commands=[],baselines=new Map();
    async function walk(node,clips=[]){
      if(node.nodeType===3){
        if(!node.textContent.trim())return;const st=getComputedStyle(node.parentElement),lines=textLines(node),parentRect=node.parentElement.getBoundingClientRect(),ellipsis=st.textOverflow==='ellipsis'&&st.whiteSpace==='nowrap',font=st.fontStyle+' '+st.fontWeight+' '+st.fontSize+' '+st.fontFamily;
        if(!baselines.has(font))baselines.set(font,fontBaseline(font));const baseline=baselines.get(font);
        commands.push(ctx=>{ctx.save();applyClips(ctx,clips);if(st.textShadow!=='none'){ctx.shadowColor='rgba(0,0,0,.55)';ctx.shadowBlur=4;ctx.shadowOffsetY=1;}ctx.fillStyle=st.color;ctx.font=font;ctx.textBaseline='alphabetic';
          if(ellipsis){ctx.beginPath();ctx.rect(parentRect.left-origin.left,parentRect.top-origin.top,parentRect.width,parentRect.height);ctx.clip();}
          for(const l of lines){let value=l.text;if(ellipsis&&ctx.measureText(value).width>parentRect.width){const chars=Array.from(value);while(chars.length&&ctx.measureText(chars.join('')+'…').width>parentRect.width)chars.pop();value=chars.join('')+'…';}ctx.fillText(value,l.x-origin.left,l.y-origin.top+baseline);}ctx.restore();});return;
      }
      if(node.nodeType!==1)return;const st=getComputedStyle(node),r=node.getBoundingClientRect();if(st.display==='none'||st.visibility==='hidden'||!r.width||!r.height)return;
      const x=r.left-origin.left,y=r.top-origin.top,w=r.width,h=r.height,radius=st.borderTopLeftRadius.includes('%')?Math.min(w,h)/2:parseFloat(st.borderTopLeftRadius)||0;
      const isSvg=node.tagName.toLowerCase()==='svg';let image=images.get(node);if(isSvg)image=await svgImage(node,w,h);
      const bg=st.backgroundImage.match(/^url\(["']?(.*?)["']?\)$/),background=bg?await loadImage(bg[1]):null,before=node.classList.contains('bubble')?getComputedStyle(node,'::before'):null;
      commands.push(ctx=>{ctx.save();applyClips(ctx,clips);box(ctx,x,y,w,h,radius);ctx.fillStyle=st.backgroundColor;ctx.fill();
        if(node.classList.contains('moment-cover')&&!background){const g=ctx.createLinearGradient(x,y,x+w*.2,y+h);[[0,'#bccbc2'],[.49,'#718b7f'],[.5,'#294b45'],[.65,'#567167'],[1,'#98aaa0']].forEach(a=>g.addColorStop(a[0],a[1]));ctx.fillStyle=g;ctx.fill();ctx.fillStyle='#e2e4d5';ctx.beginPath();ctx.arc(x+w*.16+31,y+h*.18+31,31,0,Math.PI*2);ctx.fill();}
        if(image||background){ctx.save();box(ctx,x,y,w,h,radius);ctx.clip();if(background)fitted(ctx,background,x,y,w,h,'cover');if(image){if(isSvg)ctx.drawImage(image,x,y,w,h);else fitted(ctx,image,x,y,w,h,st.objectFit);}ctx.restore();}
        paintBorders(ctx,st,x,y,w,h,radius);
        if(before){const mine=!!node.closest('.me'),tip=mine?x+w+5:x-5,base=mine?x+w-1:x+1,top=y+(parseFloat(before.top)||0),height=parseFloat(before.height)||10;ctx.fillStyle=st.backgroundColor;ctx.beginPath();ctx.moveTo(base,top);ctx.lineTo(tip,top+height/2);ctx.lineTo(base,top+height);ctx.closePath();ctx.fill();}
        if(node.classList.contains('home-indicator')){ctx.fillStyle='#b8b8b8';box(ctx,x+w/2-58,y+3,116,3,1.5);ctx.fill();}ctx.restore();
      });
      if(isSvg)return;const childClips=st.overflowX==='hidden'||st.overflowY==='hidden'?clips.concat({x,y,w,h,radius}):clips;for(const child of Array.from(node.childNodes))await walk(child,childClips);
    }
    await walk(clone);
    const total=Math.ceil(clone.scrollHeight),breaks=[0],rows=Array.from(clone.querySelectorAll('.bubble-row,.chat-narration,.reaction-comment,.post-main>p')).map(el=>{const r=el.getBoundingClientRect();return {top:r.top-origin.top,bottom:r.bottom-origin.top};});
    while(breaks[breaks.length-1]<total){const start=breaks[breaks.length-1];let end=Math.min(start+1800,total);const crossing=rows.find(r=>r.top<end&&r.bottom>end&&r.top>start+200);if(crossing)end=Math.floor(crossing.top-8);breaks.push(end);}
    for(let i=0;i<breaks.length-1;i++){const canvas=document.createElement('canvas');canvas.width=Math.round(width*2);canvas.height=Math.ceil((breaks[i+1]-breaks[i])*2);const ctx=canvas.getContext('2d');if(!ctx)throw Error('当前环境无法生成图片');ctx.scale(2,2);ctx.translate(0,-breaks[i]);for(const draw of commands)draw(ctx);await onPage(canvas.toDataURL('image/png'),i+1,breaks.length-1);canvas.width=1;canvas.height=1;await new Promise(resolve=>setTimeout(resolve,0));}return breaks.length-1;
  }finally{clone.remove();}
}
export function albumBridge(){const x=window.xhs;return x&&x.miniTool&&typeof x.miniTool.saveImageToPhotosAlbum==='function'?x.miniTool:null;}
