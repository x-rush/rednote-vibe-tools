type Point={x:number;y:number};
export function drawRod(c:CanvasRenderingContext2D,base:Point,tip:Point,bend:number,time:number,reeling:boolean,k:number){
 const control={x:base.x+(tip.x-base.x)*.22+bend*k*.18,y:base.y+(tip.y-base.y)*.64};
 const at=(u:number)=>({x:(1-u)**2*base.x+2*(1-u)*u*control.x+u*u*tip.x,y:(1-u)**2*base.y+2*(1-u)*u*control.y+u*u*tip.y});
 c.save();c.lineCap='round';let prev=base;
 for(let i=1;i<=40;i++){const u=i/40,p=at(u);c.strokeStyle=i%9===0?'#a3aea0':'#172724';c.lineWidth=8*(1-u)+1.1;c.beginPath();c.moveTo(prev.x,prev.y);c.lineTo(p.x,p.y);c.stroke();c.strokeStyle='rgba(177,194,171,.52)';c.lineWidth=Math.max(.5,2*(1-u));c.beginPath();c.moveTo(prev.x-1,prev.y);c.lineTo(p.x-1,p.y);c.stroke();prev=p;}
 for(const u of [.23,.42,.59,.74,.86,.96]){const p=at(u);c.strokeStyle='#b6b9a3';c.lineWidth=.9;c.beginPath();c.ellipse(p.x-3,p.y,Math.max(1.2,4*(1-u)),2,0,0,Math.PI*2);c.stroke();}
 const grip=at(.13),angle=Math.atan2(grip.y-base.y,grip.x-base.x)+Math.PI/2;
 c.translate(base.x,base.y);c.rotate(angle);const cork=c.createLinearGradient(-8,0,8,0);cork.addColorStop(0,'#544531');cork.addColorStop(.4,'#b09a6e');cork.addColorStop(.7,'#927d55');cork.addColorStop(1,'#413a2b');c.strokeStyle=cork;c.lineWidth=14;c.beginPath();c.moveTo(0,0);c.lineTo(0,-61);c.stroke();
 for(let i=0;i<12;i++){c.strokeStyle=i%2?'rgba(35,28,17,.25)':'rgba(203,181,134,.2)';c.lineWidth=1;c.beginPath();c.moveTo(-5,-i*5);c.lineTo(5,-i*5-1);c.stroke();}
 c.fillStyle='#27342f';c.fillRect(-5,-82,10,18);c.strokeStyle='#7d8b7d';c.lineWidth=4;c.beginPath();c.moveTo(4,-69);c.lineTo(20,-52);c.stroke();const metal=c.createRadialGradient(18,-47,2,21,-45,14);metal.addColorStop(0,'#b7b9a1');metal.addColorStop(.4,'#68766a');metal.addColorStop(1,'#25342d');c.fillStyle=metal;c.beginPath();c.ellipse(20,-47,12,16,-.2,0,Math.PI*2);c.fill();c.strokeStyle='#b3b6a1';c.lineWidth=1.1;c.beginPath();c.ellipse(20,-49,8,10,0,0,Math.PI*2);c.stroke();const a=reeling?time*12:-.6;c.strokeStyle='#969d86';c.lineWidth=2.3;c.beginPath();c.moveTo(23,-45);c.lineTo(23+Math.cos(a)*18,-45+Math.sin(a)*13);c.stroke();c.fillStyle='#202d25';c.beginPath();c.ellipse(23+Math.cos(a)*18,-45+Math.sin(a)*13,4,6,a,0,Math.PI*2);c.fill();c.restore();
}
