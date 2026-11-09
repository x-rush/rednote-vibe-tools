/*
 * 彩沙瓶 · 构建与本地预览
 * 产物为经典脚本 + 内联内容，index.html 位于根目录。
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const root = process.cwd();
const COPY = [
  ['index.html', 'index.html'],
  ['assets/logo.svg', 'logo.svg'],
  ['src/style.css', 'style.css'],
  ['src/game.js', 'game.js'],
  ['src/render.js', 'render.js'],
  ['src/audio.js', 'audio.js'],
  ['src/storage.js', 'storage.js'],
  ['src/app.js', 'app.js']
];

const ALLOWED = /\.(html|css|js|json|png|jpg|jpeg|svg|gif|webp|woff|woff2)$/i;

function audit(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.name.startsWith('.')) throw new Error('Hidden output: ' + item.name);
    const file = path.join(dir, item.name);
    if (item.isDirectory()) audit(file);
    else if (!ALLOWED.test(item.name)) throw new Error('Unsupported output: ' + file);
  }
}

if (process.argv[2] === 'build') {
  const out = path.join(root, 'dist');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  for (const [from, to] of COPY) {
    fs.copyFileSync(path.join(root, from), path.join(out, to));
  }

  const raw = fs.readFileSync(path.join(root, 'src/content/content.json'), 'utf8').replace(/^\uFEFF/, '');
  const content = JSON.parse(raw);
  fs.writeFileSync(path.join(out, 'content.js'), 'window.CONTENT=' + JSON.stringify(content) + ';');

  audit(out);

  const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  for (const ref of refs) {
    /* 图标允许内联 data: 图片；脚本与样式必须是包内相对路径 */
    if (ref.startsWith('data:')) {
      if (!/^data:image\//.test(ref)) throw new Error('Unsupported inline data URI: ' + ref.slice(0, 32));
      continue;
    }
    if (!ref.startsWith('./')) throw new Error('Non-relative resource: ' + ref);
    if (!fs.existsSync(path.join(out, ref))) throw new Error('Missing resource: ' + ref);
  }
  if (!fs.existsSync(path.join(out, 'index.html'))) throw new Error('index.html missing at root');
  /* 外链检测：忽略 SVG 命名空间声明，只看真正的资源引用 */
  const externalRefs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((ref) => /^https?:\/\//.test(ref));
  if (externalRefs.length) throw new Error('External resource reference found: ' + externalRefs.join(', '));
  if (/<script[^>]+src="https?:/i.test(html)) throw new Error('Remote script found');

  const bytes = fs.readdirSync(out).reduce((sum, name) => sum + fs.statSync(path.join(out, name)).size, 0);
  console.log('Built static classic-script game:', fs.readdirSync(out).join(', '));
  console.log('Unpacked bytes:', bytes, '(' + (bytes / 1024).toFixed(1) + ' KiB)');
  console.log(
    'Shapes:', content.meta.shapes.length,
    '| colors:', content.meta.colors.length,
    '| copy locales:', Object.keys(content.copy).join(' / ')
  );
} else if (process.argv[2] === 'preview') {
  const port = Number(process.argv[3]) || 4333;
  http
    .createServer((req, res) => {
      const dist = path.join(root, 'dist');
      const file = path.resolve(dist, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
      if (!file.startsWith(dist + path.sep) && file !== dist) {
        res.writeHead(403);
        res.end();
        return;
      }
      const target = file === dist ? path.join(file, 'index.html') : file;
      fs.readFile(target, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end();
          return;
        }
        const type = target.endsWith('.js')
          ? 'text/javascript'
          : target.endsWith('.css')
            ? 'text/css'
            : target.endsWith('.svg')
              ? 'image/svg+xml'
              : target.endsWith('.json')
                ? 'application/json'
                : 'text/html';
        res.setHeader('Content-Type', type);
        res.end(data);
      });
    })
    .listen(port, '127.0.0.1', () => console.log('http://127.0.0.1:' + port));
} else {
  console.log('Usage: node tools.mjs build | node tools.mjs preview [port]');
}
