export function trackballPoint(clientX,clientY,rect){const scale=Math.min(rect.width,rect.height)||1,x=(clientX-rect.left-rect.width/2)*2/scale,y=-(clientY-rect.top-rect.height/2)*2/scale,z=Math.sqrt(Math.max(0,1-x*x-y*y)),length=Math.hypot(x,y,z)||1;return [x/length,y/length,z/length];}
export function pinchZoom(zoom,before,after){return before>5&&after>5?Math.max(.45,Math.min(1.8,zoom*before/after)):zoom;}

// Keep the camera above the plate, with a stable horizon and continuous azimuth.
export function boundedOrbit(yaw,elevation,dx=0,dy=0){return {yaw:yaw-dx*.008,elevation:Math.max(.12,Math.min(Math.PI/2-.04,elevation+dy*.008))};}
