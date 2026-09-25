import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const c=JSON.parse(await readFile(join(root,'src/content/content.json'),'utf8'));
let md='# '+c.title+' · '+c.volume+'\n\n此稿由 src/content/content.json 整理。仅用于阅读，修改以 JSON 为准。\n\n'+c.notice+'\n\n## 玩家背景\n\n'+c.context+'\n\n';
for(const [id,n] of Object.entries(c.nodes)){
  md+='## '+n.title+'（'+id+'）\n\n'+n.act+' / '+n.place+'\n\n'+n.beats.map(b=>(b.when?'条件 '+JSON.stringify(b.when)+'：':'')+b.speaker+'：'+b.text).join('\n\n')+'\n\n';
  for(const ch of n.choices)md+=(ch.when?'条件 '+JSON.stringify(ch.when)+'：':'')+'- **'+ch.text+'**'+(ch.hint?' — '+ch.hint:'')+'\n  即时反馈：'+ch.echo+'\n  后续：'+(ch.to||JSON.stringify(ch.routes))+'\n';
  md+='\n';
}
for(const [id,e] of Object.entries(c.endings))md+='## 结局：'+e.title+'（'+id+'）\n\n'+e.line+'\n\n'+e.epilogue.map(b=>(b.when?'条件 '+JSON.stringify(b.when)+'：':'')+b.speaker+'：'+b.text).join('\n\n')+'\n\n结局卡：\n\n'+e.paragraphs.join('\n\n')+'\n\n得到：'+e.gain+'\n\n付出：'+e.cost+'\n\n'+e.letter+'\n\n';
await writeFile(join(root,'STORY.md'),md);
if(process.argv.includes('--story-only')){
  console.log('Readable story refreshed from content.json.');
  process.exit(0);
}
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});await mkdir(join(root,'review'),{recursive:true});await page.goto('http://127.0.0.1:4326');await page.locator('[data-action=start]').waitFor();
  await page.screenshot({path:join(root,'review/home.png')});await page.locator('[data-action=start]').click();await page.screenshot({path:join(root,'review/opening.png'),fullPage:true});for(let i=0;i<2;i++)await page.locator('[data-action=next-beat]').click();await page.screenshot({path:join(root,'review/sprites.png'),fullPage:true});
  await page.locator('[data-action=gallery]').click();await page.screenshot({path:join(root,'review/gallery-v3.png'),fullPage:true});await page.locator('[data-action=close]').click();
  for(const id of ['confide','negotiate','both','plan','public','signal','finish','distance']){while(await page.locator('[data-action=next-beat]').count())await page.locator('[data-action=next-beat]').click();await page.locator('[data-action=choose][data-id="'+id+'"]').click();await page.waitForTimeout(210);while(await page.locator('[data-action=next-epilogue]').count())await page.locator('[data-action=next-epilogue]').click();}
  await page.screenshot({path:join(root,'review/ending.png'),fullPage:true});await page.locator('[data-action=capture]').click();await page.screenshot({path:join(root,'review/letter.png')});
  const family=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});await family.goto('http://127.0.0.1:4326');await family.locator('[data-action=chapters]').click();await family.locator('[data-action=select-chapter][data-id=freedom]').click();await family.locator('[data-action=chapter-confirm]').click();for(let i=0;i<2;i++)await family.locator('[data-action=next-beat]').click();await family.screenshot({path:join(root,'review/family-v3.png'),fullPage:true});await family.close();
}finally{await browser.close();}
console.log('Readable story and clean preview images prepared.');
