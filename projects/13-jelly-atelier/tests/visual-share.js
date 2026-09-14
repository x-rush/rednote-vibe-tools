import {openShareCard} from '../src/share-card.js';
const content=await (await fetch('../src/content/content.json')).json();
const recipe={mold:'flower',first:'peach',second:'grape',split:.5,layers:[{flavor:'peach',end:.3},{flavor:'grape',end:.55},{flavor:'peach',end:1}],toppings:[{kind:'number',digits:'18',x:0,z:-.25,lit:true,color:content.studio.colors[0],seed:3},{kind:'berry',x:-.3,z:.1,seed:4},{kind:'mint',x:.18,z:.02,seed:5},{kind:'gold',x:.24,z:.32,seed:6}]};
document.querySelector('#open').textContent=content.share.title;document.querySelector('#open').onclick=()=>openShareCard(content,recipe,'',null);
