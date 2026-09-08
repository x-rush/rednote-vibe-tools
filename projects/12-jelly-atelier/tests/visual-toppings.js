import {createAtelier} from '../src/scene.js';
const content=await (await fetch('../src/content/content.json')).json();
const atelier=createAtelier(document.querySelector('.stage'),content,{showcase:true,preview:true});
atelier.setRecipe({mold:'flower',first:content.flavors[0].id,second:content.flavors[0].id,split:.5,layers:[{flavor:content.flavors[0].id,end:1}],toppings:[{kind:'berry',x:-.35,z:.2},{kind:'mint',x:.12,z:-.12},{kind:'star',x:.38,z:.4}]},'ready',1);
