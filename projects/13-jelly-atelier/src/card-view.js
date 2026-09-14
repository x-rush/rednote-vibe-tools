// Angle changes preserve the lighting captured when the card was opened.
export function cardView(current,useCurrent=false){const angle=useCurrent&&current?current:{rotation:[0,0,0,1],pan:[0,0,0],zoom:1};return {rotation:[...angle.rotation],pan:[...angle.pan],zoom:angle.zoom,lightsOff:Boolean(current?.lightsOff)};}
