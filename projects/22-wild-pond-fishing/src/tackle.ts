export interface Point{x:number;y:number}
export function lineControl(tip:Point,end:Point,tension:number,slack:number):Point{
 const taut=Math.max(0,Math.min(1,tension));
 return{x:(tip.x+end.x)/2,y:(tip.y+end.y)/2+Math.max(0,slack)*(1-taut)**2};
}
export function loadedTip(rest:Point,fish:Point,tension:number):Point{
 const load=Math.max(0,Math.min(1,tension));
 return{x:rest.x+(fish.x-rest.x)*load*.18,y:rest.y+(fish.y-rest.y)*load*.12};
}
