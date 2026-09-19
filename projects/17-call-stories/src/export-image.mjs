// Paint the laid-out phone surface to Canvas; no network or foreignObject renderer.
function loadImage(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('图片加载失败'));image.src=src;});}
function box(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function fitted(ctx,image,x,y,w,h,fit){const ratio=fit==='contain'?Math.min(w/image.width,h/image.height):Math.max(w/image.width,h/image.height);const dw=image.width*ratio,dh=image.height*ratio;ctx.drawImage(image,x+(w-dw)/2,y+(h-dh)/2,dw,dh);}
function textLines(node){const range=document.createRange(),lines=[];let offset=0;
  for(const char of Array.from(node.textContent)){range.setStart(node,offset);offset+=char.length;range.setEnd(node,offset);const r=range.getBoundingClientRect();if(!r.width&&!r.height)continue;let line=lines[lines.length-1];if(!line||Math.abs(line.y-r.top)>2){line={x:r.left,y:r.top,height:r.height,text:''};lines.push(line);}line.text+=char;}
  return lines;
}
export async function captureSurface(surface,onPage){
  const clone=surface.cloneNode(true);clone.classList.add('export-surface');clone.setAttribute('aria-hidden','true');clone.querySelectorAll('.export-actions,.moment-action-menu,.moment-composer').forEach(el=>el.remove());document.body.appendChild(clone);
  try{
    if(document.fonts&&document.fonts.ready)await document.fonts.ready;
    const images=new Map();await Promise.all(Array.from(clone.querySelectorAll('img')).map(async img=>{images.set(img,await loadImage(img.src));}));
    const origin=clone.getBoundingClientRect(),commands=[];
    async function walk(node){
      if(node.nodeType===3){if(!node.textContent.trim())return;const st=getComputedStyle(node.parentElement),lines=textLines(node);commands.push(ctx=>{ctx.save();if(st.textShadow!=='none'){ctx.shadowColor='rgba(0,0,0,.55)';ctx.shadowBlur=4;ctx.shadowOffsetY=1;}ctx.fillStyle=st.color;ctx.font=st.fontStyle+' '+st.fontWeight+' '+st.fontSize+' '+st.fontFamily;ctx.textBaseline='middle';for(const l of lines)ctx.fillText(l.text,l.x-origin.left,l.y-origin.top+l.height/2);ctx.restore();});return;}
      if(node.nodeType!==1)return;const st=getComputedStyle(node),r=node.getBoundingClientRect();if(st.display==='none'||st.visibility==='hidden'||!r.width||!r.height)return;
      const x=r.left-origin.left,y=r.top-origin.top,w=r.width,h=r.height,radius=st.borderTopLeftRadius.includes('%')?Math.min(w,h)/2:parseFloat(st.borderTopLeftRadius)||0;
      let image=images.get(node);if(node.tagName.toLowerCase()==='svg'){const svg=node.cloneNode(true);svg.setAttribute('xmlns','http://www.w3.org/2000/svg');svg.setAttribute('width',String(w));svg.setAttribute('height',String(h));svg.setAttribute('color',st.color);image=await loadImage('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg)));}
      const bg=st.backgroundImage.match(/^url\(["']?(.*?)["']?\)$/);const background=bg?await loadImage(bg[1]):null;
      commands.push(ctx=>{ctx.save();box(ctx,x,y,w,h,radius);ctx.fillStyle=st.backgroundColor;ctx.fill();
        if(node.classList.contains('moment-cover')&&!background){const g=ctx.createLinearGradient(x,y,x+w*.2,y+h);[[0,'#bccbc2'],[.49,'#718b7f'],[.5,'#294b45'],[.65,'#567167'],[1,'#98aaa0']].forEach(a=>g.addColorStop(a[0],a[1]));ctx.fillStyle=g;ctx.fill();ctx.fillStyle='#e2e4d5';ctx.beginPath();ctx.arc(x+w*.16+31,y+h*.18+31,31,0,Math.PI*2);ctx.fill();}
        if(image||background){box(ctx,x,y,w,h,radius);ctx.clip();if(background)fitted(ctx,background,x,y,w,h,'cover');if(image){if(node.tagName.toLowerCase()==='svg')ctx.drawImage(image,x,y,w,h);else fitted(ctx,image,x,y,w,h,st.objectFit);}}
        ctx.restore();
        if(parseFloat(st.borderTopWidth)&&st.borderTopWidth===st.borderRightWidth&&st.borderRightWidth===st.borderBottomWidth&&st.borderBottomWidth===st.borderLeftWidth){ctx.strokeStyle=st.borderTopColor;ctx.lineWidth=parseFloat(st.borderTopWidth);box(ctx,x+.5,y+.5,w-1,h-1,radius);ctx.stroke();}else if(parseFloat(st.borderBottomWidth)){ctx.fillStyle=st.borderBottomColor;ctx.fillRect(x,y+h-parseFloat(st.borderBottomWidth),w,parseFloat(st.borderBottomWidth));}
        if(node.classList.contains('bubble')){const me=node.closest('.me');ctx.fillStyle=me?'#95ec69':'#fff';ctx.beginPath();const bx=me?x+w:x;ctx.moveTo(bx,y+14);ctx.lineTo(bx+(me?6:-6),y+19);ctx.lineTo(bx,y+24);ctx.fill();}
        if(node.classList.contains('home-indicator')){ctx.fillStyle='#b8b8b8';box(ctx,x+w/2-58,y+3,116,3,1.5);ctx.fill();}
      });
      if(node.tagName.toLowerCase()==='svg')return;for(const child of Array.from(node.childNodes))await walk(child);
    }
    await walk(clone);
    const total=Math.ceil(clone.scrollHeight),breaks=[0];const rows=Array.from(clone.querySelectorAll('.bubble-row,.reaction-comment,.post-main>p')).map(el=>{const r=el.getBoundingClientRect();return {top:r.top-origin.top,bottom:r.bottom-origin.top};});
    while(breaks[breaks.length-1]<total){const start=breaks[breaks.length-1];let end=Math.min(start+1800,total);const crossing=rows.find(r=>r.top<end&&r.bottom>end&&r.top>start+200);if(crossing)end=Math.floor(crossing.top-8);breaks.push(end);}
    for(let i=0;i<breaks.length-1;i++){const canvas=document.createElement('canvas');canvas.width=780;canvas.height=Math.ceil((breaks[i+1]-breaks[i])*2);const ctx=canvas.getContext('2d');if(!ctx)throw Error('当前环境无法生成图片');ctx.scale(2,2);ctx.translate(0,-breaks[i]);for(const draw of commands)draw(ctx);await onPage(canvas.toDataURL('image/png'),i+1,breaks.length-1);canvas.width=1;canvas.height=1;await new Promise(resolve=>setTimeout(resolve,0));}
    return breaks.length-1;
  }finally{clone.remove();}
}
export function albumBridge(){const x=window.xhs;return x&&x.miniTool&&typeof x.miniTool.saveImageToPhotosAlbum==='function'?x.miniTool:null;}
