export function smoothPressure(current,target,dt){return current+(target-current)*(1-Math.exp(-Math.max(0,dt)*14));}
export function pressureAt(x,y,z,point,pressure){const distance=(x-point.x)**2+((y-point.y)*.7)**2+(z-point.z)**2;return Math.exp(-distance*4)*pressure*Math.max(0,Math.min(1,(y-.14)/1.68));}
