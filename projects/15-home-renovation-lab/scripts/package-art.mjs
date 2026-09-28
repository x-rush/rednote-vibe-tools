import {createRequire} from 'node:module';
import {mkdir,writeFile,rm} from 'node:fs/promises';
// Regenerates the packaged thumbnails as inlined data URIs in assets/thumbnails.js.
// The container cannot reliably resolve ./assets/*.png requests, so thumbnails ship
// as a classic script (same loading path as app.js). Run after catalogue changes:
//   PORT=4515 node scripts/serve.mjs dist &  node scripts/package-art.mjs
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage();await page.goto(process.env.ART_SOURCE_URL||'http://127.0.0.1:4515',{waitUntil:'networkidle'});
  const images=await page.evaluate(async()=>{
    const T=await import('./src/vendor/package/build/three.module.js'),{furnitureModel,openingPreviewModel}=await import('./src/scene.js');
    const catalog=await (await fetch('./src/content/content.json')).json();
    const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(200,150);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;renderer.setClearColor('#f1f0e7',1);
    const scene=new T.Scene();scene.background=new T.Color('#f1f0e7');scene.add(new T.HemisphereLight('#fff7e8','#c1b6a0',3));const light=new T.DirectionalLight('#ffffff',3);light.position.set(-3,5,5);scene.add(light);
    const camera=new T.PerspectiveCamera(32,4/3,.1,30),out=[];
    const shoot=(id,g)=>{scene.add(g);renderer.render(scene,camera);out.push([id,renderer.domElement.toDataURL('image/jpeg',.82)]);scene.remove(g);};
    for(const def of catalog.furniture){const g=furnitureModel(def),size=Math.max(def.w,def.d,def.h),dist=size*2.2+.3;scene.add(g);camera.position.set(dist*.85,dist*.75,dist);camera.lookAt(0,def.h*.4,0);renderer.render(scene,camera);out.push([def.id,renderer.domElement.toDataURL('image/jpeg',.82)]);scene.remove(g);}
    // Openings: straight-on full view — the whole 2.3×2.65 wall segment with the complete door/window.
    camera.position.set(0.35,1.32,5.3);camera.lookAt(0,1.32,0);
    shoot('door',openingPreviewModel('door'));
    for(const style of ['casement','sliding','floor','bay'])shoot('window-'+style,openingPreviewModel('window',style));
    renderer.dispose();return out;
  });
  const entries=images.map(([id,src])=>{
    if(!/^[a-z-]+$/.test(id)||!src.startsWith('data:image/jpeg;base64,'))throw new Error('Unexpected art source: '+id);
    return [id,src];
  });
  await mkdir('assets',{recursive:true});
  await writeFile('assets/thumbnails.js','window.ROOMISH_THUMBNAILS_DATA=Object.assign(window.ROOMISH_THUMBNAILS_DATA||{},'+JSON.stringify(Object.fromEntries(entries))+');');
  await rm('assets/furniture',{recursive:true,force:true});
  console.log(`Generated ${entries.length} inlined thumbnails in assets/thumbnails.js.`);
}finally{await browser.close();}
