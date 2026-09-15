import {readFile, writeFile, mkdir, copyFile, readdir} from 'node:fs/promises';
import {resolve, join, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {spawnSync} from 'node:child_process';
export const root = fileURLToPath(new URL('.', import.meta.url));
export async function publicContent() {
  const data = JSON.parse(await readFile(join(root, 'src/content/content.json'), 'utf8'));
  return {
    product: {workingTitle: data.product.workingTitle, season: data.product.season, notice: data.product.notice},
    ui: data.ui, roles: data.roles, rules: data.rules, templates: data.templates, verifiedQuotes: data.verifiedQuotes,
    characters: data.characters.map(c => ({id: c.id, alias: c.alias, fictionalArchetype: c.fictionalArchetype, portrait: c.portrait.path, profile: c.profile, speech: c.speech})),
    scorecard: data.scorecard, travel: data.travel, dialogueVariants: data.dialogueVariants,
    roleDeck: data.rulesDraft.roles
  };
}
export async function build() {
  const out = join(root, 'dist');
  await mkdir(join(out, 'src'), {recursive: true});
  await mkdir(join(out, 'assets/portraits'), {recursive: true});
  await mkdir(join(out, 'assets/logo'), {recursive:true});
  for(const size of [32,128,512]) await copyFile(join(root,'assets/logo/flower-wolf-'+size+'.png'),join(out,'assets/logo/flower-wolf-'+size+'.png'));
  for (const file of ['index.html','src/app.mjs','src/engine.mjs','src/style.css','assets/mark.svg']) await copyFile(join(root,file), join(out,file));
  for (let i = 1; i <= 7; i++) await copyFile(join(root, 'assets/portraits/guest-' + i + '.webp'), join(out, 'assets/portraits/guest-' + i + '.webp'));
  await writeFile(join(out, 'content.json'), JSON.stringify(await publicContent()));
  console.log('Static build: dist/ (no runtime dependencies)');
}
async function lint() {
  const js = ['src/app.mjs','src/engine.mjs','tools.mjs','tests/engine.test.mjs','tests/audit.test.mjs','qa/browser-check.mjs','qa/all-controls.mjs'];
  for (const file of js) {
    const run = spawnSync(process.execPath, ['--check', join(root,file)], {encoding:'utf8'});
    if (run.status !== 0) throw new Error(run.stderr);
  }
  const c = await publicContent();
  const raw = JSON.parse(await readFile(join(root,'src/content/content.json'),'utf8'));
  if (c.characters.length !== 7 || Object.keys(c.verifiedQuotes).length !== 7) throw new Error('Invalid cast');
  for (const [id, phases] of Object.entries(raw.quoteSets)) {
    if (Object.values(phases).length !== 6 || Object.values(phases).some(q => q.length !== 4 || q.some(x => typeof x !== 'string' || !x))) throw new Error('Invalid quote pool: '+id);
  }
  const serialized = JSON.stringify(c);
  for (const person of raw.characters.map(x => x.researchOnly.referencePerson)) if(serialized.includes(person)) throw new Error('Research name leaked into public payload');
  for (const file of ['src/app.mjs','src/engine.mjs','src/style.css']) {
    const text = await readFile(join(root,file),'utf8');
    if (/https?:\/\/|localStorage\.setItem\([^,]+,\s*(?:image|blob)/.test(text)) throw new Error('External runtime dependency: '+file);
  }
  console.log('Lint: syntax, 7 sourced excerpts, archived simulation data, public content boundaries, local runtime policy passed');
}
export async function serve(port = 4316) {
  const base = resolve(root, 'dist');
  const mime = {'.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp'};
  const server = createServer(async (req,res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = resolve(base, '.' + (path === '/' ? '/index.html' : path));
      if (!file.startsWith(base + '/') && !file.startsWith(base + '\\')) {res.writeHead(403);res.end();return;}
      const body = await readFile(file);
      res.writeHead(200, {'Content-Type':mime[extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});
      res.end(body);
    } catch {res.writeHead(404);res.end('Not found');}
  });
  await new Promise((ok, fail) => {server.once('error',fail);server.listen(port,'127.0.0.1',ok);});
  console.log('Preview: http://127.0.0.1:' + server.address().port);
  return server;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  if (command === 'lint') await lint();
  else if (command === 'build') await build();
  else if (command === 'dev' || command === 'preview') { if(command==='dev') await build(); await serve(Number(process.env.PORT || 4316)); }
}
