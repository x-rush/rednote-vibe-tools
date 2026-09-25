import {readFileSync} from 'node:fs';import {simulate} from '../.cache/model.mjs';const c=JSON.parse(readFileSync('src/content/content.json'));for(const s of c.stones){let best=0,j=0;for(let p=.1;p<=1;p+=.05)for(let a=8;a<=35;a++){const f=simulate(s,p,a,0,c.physics);best=Math.max(best,f.distance);j=Math.max(j,f.jumps);}console.log(s.id,best,j);}

