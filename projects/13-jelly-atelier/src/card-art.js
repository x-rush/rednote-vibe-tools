// Local canvas stationery. No bitmap assets or remote fonts are required.
export function wrapCardText(ctx,text,width){const lines=[];let line='';for(const char of [...text]){if(char==='\n'){lines.push(line);line='';continue;}if(line&&ctx.measureText(line+char).width>width){lines.push(line);line='';}line+=char;}if(line)lines.push(line);return lines;}
function paperDoodles(ctx,post){
 ctx.save();ctx.lineWidth=2.8;ctx.lineCap='round';ctx.lineJoin='round';
 // A tiny flowering sprig, in the top corner outside the photograph.
 ctx.save();ctx.translate(917,151);ctx.rotate(.18);ctx.strokeStyle='#8e9c79';ctx.beginPath();ctx.moveTo(-27,38);ctx.quadraticCurveTo(-10,12,4,-27);ctx.stroke();
 for(const [x,y,a] of [[-17,22,-.6],[-5,0,.7]]){ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.fillStyle='#c3cba5';ctx.beginPath();ctx.ellipse(0,-9,6,13,0,0,Math.PI*2);ctx.fill();ctx.restore();}
 ctx.translate(6,-30);for(let i=0;i<5;i++){ctx.save();ctx.rotate(i*Math.PI*2/5);ctx.fillStyle=post?'#e9c6ab':'#e7cccf';ctx.strokeStyle=post?'#c49b7d':'#bb9ca4';ctx.beginPath();ctx.ellipse(0,-10,7,12,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();}ctx.fillStyle='#d0b36a';ctx.beginPath();ctx.arc(0,0,4,0,Math.PI*2);ctx.fill();ctx.restore();
 // Two cherries sit in the lower margin, below the ruled writing area.
 ctx.save();ctx.translate(149,1359);ctx.rotate(-.12);ctx.strokeStyle='#899675';ctx.beginPath();ctx.moveTo(-17,-1);ctx.quadraticCurveTo(-12,-32,8,-38);ctx.quadraticCurveTo(20,-23,19,3);ctx.stroke();ctx.fillStyle='#aebb91';ctx.beginPath();ctx.ellipse(18,-36,13,5,-.35,0,Math.PI*2);ctx.fill();
 for(const [x,y] of [[-18,3],[20,7]]){ctx.fillStyle=post?'#c77f76':'#bf8193';ctx.strokeStyle='#aa6f7e';ctx.beginPath();ctx.arc(x,y,11,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle='#fff4df';ctx.beginPath();ctx.moveTo(x-5,y-4);ctx.lineTo(x-3,y-6);ctx.stroke();}ctx.restore();
 // Sparse sparkles stay in the paper margins, away from user text.
 ctx.strokeStyle='#c6ae7b';for(const [x,y,r] of [[99,183,7],[981,876,9],[72,1056,5],[261,1349,5]]){ctx.beginPath();ctx.moveTo(x-r,y);ctx.quadraticCurveTo(x,y,x,y-r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.quadraticCurveTo(x,y,x,y+r);ctx.quadraticCurveTo(x,y,x-r,y);ctx.stroke();}ctx.restore();
}
export function paintCard(ctx,frame,{template=0,name,message,content,textLayout={}}){
 const post=template===1,s=content.share.art,ink=post?'#70534c':'#555e54';
 ctx.clearRect(0,0,1080,1440);ctx.fillStyle=post?'#e7ddd1':'#dce1d7';ctx.fillRect(0,0,1080,1440);
 ctx.save();ctx.shadowColor='#483f3022';ctx.shadowBlur=18;ctx.shadowOffsetY=8;ctx.fillStyle=post?'#fff4e2':'#fffdf3';ctx.fillRect(32,28,1016,1384);ctx.restore();
 let seed=103;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};ctx.fillStyle='#72664b0a';for(let i=0;i<6500;i++)ctx.fillRect(38+random()*1004,34+random()*1372,random()*2+1,1);
 ctx.fillStyle=ink;ctx.font='34px "JellyCard", "KaiTi", "STKaiti", serif';ctx.textAlign='left';ctx.fillText(s.recipient,108,125);ctx.textAlign='right';ctx.font='18px Georgia,serif';ctx.fillStyle='#a49b87';ctx.fillText(post?s.postLabel:s.letterLabel,850,122);
 // The photograph is a separate, rotated paper object, not the card background.
 ctx.save();ctx.translate(540,535);ctx.rotate(post?.035:-.035);ctx.scale(.94,.94);
 ctx.shadowColor='#4a39343b';ctx.shadowBlur=24;ctx.shadowOffsetX=3;ctx.shadowOffsetY=14;ctx.fillStyle='#fffefa';ctx.fillRect(-399,-351,798,760);ctx.shadowColor='transparent';
 const wash=ctx.createRadialGradient(0,-20,25,0,-20,540);wash.addColorStop(0,'#fff8f4');wash.addColorStop(1,post?'#e7d4cc':'#e3dfd7');ctx.fillStyle=wash;ctx.fillRect(-371,-324,742,647);
 ctx.save();ctx.beginPath();ctx.rect(-371,-324,742,647);ctx.clip();ctx.drawImage(frame,-361,-332,722,686);ctx.restore();
 ctx.textAlign='center';ctx.font='italic 22px Georgia,serif';ctx.fillStyle='#a79c91';ctx.fillText(s.photoCaption,0,373);ctx.restore();
 // Translucent tape crosses the photo edge and casts only a small paper shadow.
 ctx.save();ctx.translate(538,208);ctx.rotate(-.075);ctx.shadowColor='#84745713';ctx.shadowBlur=3;ctx.shadowOffsetY=2;ctx.fillStyle=post?'#d8b7a68f':'#b9c5a48f';ctx.beginPath();ctx.moveTo(-114,-28);ctx.lineTo(111,-25);ctx.lineTo(115,27);ctx.lineTo(-110,31);ctx.closePath();ctx.fill();ctx.shadowColor='transparent';ctx.strokeStyle='#fffdf32c';for(let x=-100;x<105;x+=9){ctx.beginPath();ctx.moveTo(x,-25);ctx.lineTo(x,27);ctx.stroke();}ctx.restore();
 const offset=Math.max(-16,Math.min(20,Number(textLayout.offset)||0)),size=Math.max(32,Math.min(44,Number(textLayout.size)||40)),center=textLayout.align==='center',x=center?540:136;
 const titleSize=size+10,titleY=1039+offset,bodyY=1162+offset;
 ctx.strokeStyle=post?'#c4ad91':'#afbea7';ctx.lineWidth=2;for(const y of [titleY+15,titleY+65,bodyY+15,bodyY+69,bodyY+123]){ctx.beginPath();ctx.moveTo(112,y);ctx.lineTo(968,y);ctx.stroke();}
 ctx.textAlign=center?'center':'left';ctx.fillStyle=ink;ctx.font=titleSize+'px "JellyCard", "KaiTi", "STKaiti", serif';const titles=wrapCardText(ctx,name.trim()||s.unnamed,808).slice(0,2);titles.forEach((line,i)=>ctx.fillText(line,x,titleY+i*50));
 ctx.fillStyle=post?'#92756b':'#7d8877';ctx.font=size+'px "JellyCard", "KaiTi", "STKaiti", serif';wrapCardText(ctx,message.trim(),808).slice(0,3).forEach((line,i)=>ctx.fillText(line,x,bodyY+i*54));
 paperDoodles(ctx,post);
 ctx.textAlign='right';ctx.font='24px "JellyCard", "KaiTi", "STKaiti", serif';ctx.fillText(content.brand.name,964,1365);
}
