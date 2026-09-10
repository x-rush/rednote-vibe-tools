// Every entry describes liquid that has actually entered the mold.
export function appendPour(layers,selected,quantity,limit){
  const amount=layers.at(-1)?.end||0;
  if(!Number.isFinite(quantity)||quantity<=0||amount>=1)return layers;
  const end=Math.min(1,amount+quantity),last=layers.at(-1);
  if(last?.flavor===selected)return [...layers.slice(0,-1),{flavor:selected,end}];
  if(layers.length>=limit)return layers;
  return [...layers,{flavor:selected,end}];
}
