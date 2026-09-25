import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname);
const dist = join(root, 'dist');
const allowed = new Set(['.html', '.css', '.js', '.jpg']);
function renderHtml() {
  const {brand}=JSON.parse(readFileSync(join(root,'src/content/content.json'),'utf8'));
  const escape=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  return readFileSync(join(root,'index.html'),'utf8').replace(/\{\{(toolName|tagline)\}\}/g,(_,key)=>escape(brand[key]));
}

function build() {
  if (existsSync(dist)) rmSync(dist, { recursive: true, force: true });
  mkdirSync(join(dist, 'src'), { recursive: true });
  mkdirSync(join(dist, 'vendor'), { recursive: true });
  for (const path of ['index.html', 'src/style.css', 'src/flow.js', 'src/terrain.js', 'src/sketch.js', 'vendor/p5.min.js']) {
    if (!allowed.has(extname(path))) throw new Error(`Unexpected output: ${path}`);
    cpSync(join(root, path), join(dist, path));
  }
  const html = renderHtml();
  writeFileSync(join(dist,'index.html'),html);
  if (/https?:\/\//i.test(html)) throw new Error('Runtime network reference in index.html');
  console.log(`Built ${dist}`);
}

function preview() {
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.txt': 'text/plain' };
  createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, `.${path === '/' ? '/index.html' : path}`);
    if (!file.startsWith(root + '\\') && file !== root) { res.writeHead(403); res.end(); return; }
    if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', `${mime[extname(file)] || 'application/octet-stream'}; charset=utf-8`);
    res.end(file===join(root,'index.html')?renderHtml():readFileSync(file));
  }).listen(4175, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:4175'));
}

if (process.argv[2] === 'build') build();
else if (process.argv[2] === 'preview') preview();
else throw new Error('Use build or preview');
