export function drawNet(c:CanvasRenderingContext2D,x:number,y:number,bottom:number){
 c.save();
 const handle=c.createLinearGradient(x-42,0,x-32,0);handle.addColorStop(0,'#3b4035');handle.addColorStop(.45,'#a0a38c');handle.addColorStop(.7,'#586758');handle.addColorStop(1,'#25352c');
 c.strokeStyle=handle;c.lineWidth=7;c.lineCap='round';c.beginPath();c.moveTo(x,y+26);c.lineTo(x-40,bottom+20);c.stroke();
 c.save();c.translate(x,y);c.rotate(-.15);c.beginPath();c.ellipse(0,0,44,27,0,0,Math.PI*2);c.clip();
 const bag=c.createRadialGradient(0,12,2,0,0,48);bag.addColorStop(0,'rgba(18,36,30,.36)');bag.addColorStop(1,'rgba(198,199,169,.09)');c.fillStyle=bag;c.fillRect(-45,-28,90,56);
 c.lineWidth=.55;c.strokeStyle='rgba(187,190,154,.64)';
 for(let i=-12;i<=12;i++){c.beginPath();c.moveTo(i*7-28,-28);c.quadraticCurveTo(i*5,12,i*7+28,28);c.stroke();c.beginPath();c.moveTo(i*7+28,-28);c.quadraticCurveTo(i*5,12,i*7-28,28);c.stroke();}
 c.restore();c.translate(x,y);c.rotate(-.15);c.strokeStyle='#343f33';c.lineWidth=5;c.beginPath();c.ellipse(0,0,45,28,0,0,Math.PI*2);c.stroke();c.strokeStyle='#b2b39a';c.lineWidth=2;c.stroke();c.strokeStyle='rgba(237,230,193,.68)';c.lineWidth=.7;c.beginPath();c.ellipse(0,-1,44,27,0,Math.PI,Math.PI*1.85);c.stroke();c.restore();
}
