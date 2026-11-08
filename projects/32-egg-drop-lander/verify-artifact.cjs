/*
 * 毽子连击 · 产物校验
 * 检查：文件白名单、ES2017 语法、禁用能力、index.html 根目录、相对路径引用。
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(process.argv[2] || 'dist');
const files = [];

function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, item.name);
    if (item.isDirectory()) walk(target);
    else files.push(target);
  }
}

walk(root);

const allowed = /\.(html|css|js|json|png|jpg|jpeg|svg|gif|webp|woff|woff2)$/i;
for (const file of files) {
  assert(allowed.test(file), 'unsupported file type: ' + file);
  assert(!/[\\/](?:node_modules|\.git)[\\/]|\.map$/.test(file), 'dev artifact leaked: ' + file);
}

const jsFiles = files.filter((f) => f.endsWith('.js'));
const forbidden = /\b(?:fetch|eval)\s*\(|XMLHttpRequest|new\s+(?:Function|Worker|SharedWorker|WebSocket|EventSource|RTCPeerConnection)|WebAssembly|navigator\.(?:geolocation|clipboard|bluetooth|usb|hid|serial|connection|getBattery|credentials|locks|serviceWorker)|requestFullscreen|\.at\s*\(|globalThis|DeviceMotionEvent|addEventListener\(\s*['"]devicemotion/;
for (const file of jsFiles) {
  const source = fs.readFileSync(file, 'utf8');
  assert(!forbidden.test(source), 'forbidden capability in ' + file);
  assert(!/\bimport\s+[\w{*]/.test(source), 'ES module import found in ' + file);
  assert(!/\bexport\s+(?:default|const|function|class|\{)/.test(source), 'ES module export found in ' + file);
  /* ES2017 基线：排除超出 Chrome 61 的语法 */
  assert(!/\?\./.test(source), 'optional chaining found in ' + file);
  assert(!/\?\?/.test(source), 'nullish coalescing found in ' + file);
  assert(!/\basync\s+function\s*\*|\bfor\s+await\b/.test(source), 'async generator found in ' + file);
  assert(!/\.flatMap\s*\(|\.flat\s*\(/.test(source), 'ES2019 array method found in ' + file);
  assert(!/String\.prototype\.matchAll|\.matchAll\s*\(/.test(source), 'matchAll found in ' + file);
}

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert(!/<script(?![^>]*src=)[^>]*>/i.test(html), 'inline script found');
assert(!/type=["']module/i.test(html), 'module script found');
assert(!/\son\w+\s*=/.test(html), 'inline event handler found');
assert(!/<iframe|<object/i.test(html), 'iframe/object found');
assert(!/<base\s/i.test(html), 'base href found');
assert(!/http-equiv=["']Content-Security-Policy/i.test(html), 'custom CSP meta found');
assert.equal(files.filter((f) => f.endsWith('.html')).length, 1, 'exactly one html expected');
assert(fs.existsSync(path.join(root, 'index.html')), 'index.html missing at root');

for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const ref = match[1];
  /* 图标允许内联 data: 图片；其余资源必须是包内相对路径 */
  if (ref.startsWith('data:')) {
    assert(/^data:image\//.test(ref), 'unsupported inline data URI');
    continue;
  }
  assert(ref.startsWith('./'), 'resource must be relative: ' + ref);
  assert(fs.existsSync(path.join(root, ref)), 'missing resource: ' + ref);
}
const externalRefs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((m) => m[1])
  .filter((ref) => /^https?:\/\//.test(ref));
assert(externalRefs.length === 0, 'external URL reference found: ' + externalRefs.join(', '));
assert(!/<script[^>]+src="https?:/i.test(html), 'remote script found');

const totalBytes = files.reduce((sum, f) => sum + fs.statSync(f).size, 0);
assert(totalBytes < 2 * 1024 * 1024, 'artifact exceeds 2 MiB');

console.log(
  JSON.stringify(
    {
      files: files.map((f) => path.relative(root, f)).sort(),
      es2017: 'PASS',
      offlineResources: 'PASS',
      forbiddenAPIs: 'NONE',
      inlineScripts: 'NONE',
      unpackedBytes: totalBytes,
      unpackedKiB: +(totalBytes / 1024).toFixed(1)
    },
    null,
    2
  )
);
