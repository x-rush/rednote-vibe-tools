const {chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({headless:true,channel:'msedge'}),p=await b.newPage();
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
  await p.goto('http://127.0.0.1:4329');
  await p.evaluate(()=>{
    document.querySelector('#panel').hidden=true;document.querySelector('#hud').hidden=false;
    document.documentElement.style.setProperty('--safe-area-inset-top','30px');
    for(const side of ['left','right']){const el=document.createElement('div');el.className='host-overlay';el.style.cssText=`position:fixed;top:30px;${side}:8px;width:64px;height:42px;background:#f008;z-index:1000`;document.body.append(el);}
    Motion.configure(CONTENT.bpm,CONTENT.choreography,CONTENT.intro);window.previewScene=makeScene(document.querySelector('canvas'));
  });
  for(const [width,height] of [[375,844],[390,844],[430,844],[844,390]]){
    await p.setViewportSize({width,height});
    for(const [t,kind] of [[.5],[3.1],[5.1],[6.9],[7.8],[9.5],[13.4,'cue'],[13.77,'success'],[13.91,'miss'],[15.95,'cue'],[24.0625],[46.65,'cue'],[47.5],[48.24,'shake'],[49.2],[18.26,"cue"],[28.14,"cue"],[37.02,"cue"],[38.20,"cue"],[39.57,"cue"]]){
      await p.evaluate(({t,kind})=>{
        document.body.classList.toggle('cinematic',t<CONTENT.intro.duration);
        const f=Feedback.create();if(kind==='success')Feedback.success(f,CONTENT,0,13.70,'perfect');if(kind==='miss')Feedback.failure(f,0,13.89);
        previewScene.render(t,Motion.attackAt(CONTENT.attacks,t,CONTENT.bpm),{hero:Feedback.hero(f,CONTENT,t),cue:kind==='cue'?Feedback.cue(CONTENT,t):null,shake:Feedback.shake(CONTENT,t)});
      },{t,kind});
      await p.screenshot({path:`screenshots/v13-safe-${width}-${t}.png`});
      const bad=await p.evaluate(()=>{
        const hosts=[...document.querySelectorAll('.host-overlay')].map(e=>e.getBoundingClientRect());
        return [...document.querySelectorAll('button,input,#dodge')].filter(e=>e.getClientRects().length).filter(e=>{
          const r=e.getBoundingClientRect();return r.x<0||r.right>innerWidth+.5||r.y<30||r.bottom>innerHeight+.5||hosts.some(h=>r.left<h.right&&r.right>h.left&&r.top<h.bottom&&r.bottom>h.top);
        }).map(e=>e.id);
      });
      if(bad.length)throw Error(`${width} at ${t}: ${bad.join(',')}`);
    }
    console.log(width,height,'controls in viewport and clear of simulated host buttons');
  }
  if(errors.length)throw Error(errors.join('\n'));console.log('pageerrors',errors);await b.close();
})();
