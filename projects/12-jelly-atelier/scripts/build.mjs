import {cp,mkdir} from 'node:fs/promises';
await mkdir('dist/vendor/package/build',{recursive:true});
for(const file of ['index.html','src'])await cp(file,`dist/${file}`,{recursive:true});
for(const file of ['three.module.js','three.core.js'])await cp(`vendor/package/build/${file}`,`dist/vendor/package/build/${file}`);
await cp('vendor/package/examples','dist/vendor/package/examples',{recursive:true});
await cp('vendor/package/LICENSE','dist/vendor/package/LICENSE');
console.log('Static build complete. All runtime assets are local.');
