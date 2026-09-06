import { readdir, readFile, mkdir, rm, writeFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';

await import('./build.mjs');
const expected = ['assets/app.js', 'assets/favicon.svg', 'assets/style.css', 'assets/tokens.css', 'index.html'];
async function list(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) files.push(...await list(`${directory}/${entry.name}`, `${prefix}${entry.name}/`));
    else files.push(`${prefix}${entry.name}`);
  }
  return files.sort();
}
assert.deepEqual(await list('dist'), expected);
const js = await readFile('dist/assets/app.js', 'utf8');
const html = await readFile('dist/index.html', 'utf8');
const css = await readFile('dist/assets/style.css', 'utf8');
new Script(js);
assert(!/\b(?:import|export)\s|\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|RTCPeerConnection|\bWorker\b|SharedWorker|WebAssembly|eval\s*\(|new\s+Function|requestFullscreen|webkitRequestFullscreen|navigator\.(?:geolocation|clipboard|bluetooth|usb|hid|serial|credentials|locks|connection|getBattery|serviceWorker)|window\.(?:open|prompt)\s*\(/.test(js));
assert(!/<(?:iframe|object|base)\b|type=["']module|\son\w+=|javascript:|\bdownload\b|target=["']_blank|http-equiv=["']Content-Security-Policy/i.test(html));
assert(!/https?:\/\//.test(js + html + css));
for (const [, ref] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  assert(ref.startsWith('./'), `Non-relative resource: ${ref}`);
  assert(expected.includes(ref.slice(2)), `Missing resource: ${ref}`);
}
assert.match(css, /@import url\('\.\/tokens\.css'\)/);
await mkdir('release-assets', { recursive: true });
const archive = resolve('release-assets/tomato-garden-mini-tool-v1.zip');
await rm(archive, { force: true });
execFileSync('zip', ['-q', '-X', archive, ...expected], { cwd: resolve('dist') });
assert.deepEqual(execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' }).trim().split('\n').sort(), expected);
execFileSync('unzip', ['-t', archive]);
const size = (await stat(archive)).size;
assert(size <= 10 * 1024 * 1024, 'Archive exceeds 10 MB');
const sha = createHash('sha256').update(await readFile(archive)).digest('hex');
await writeFile(`${archive}.sha256`, `${sha}  tomato-garden-mini-tool-v1.zip\n`);
console.log(`ZIP verified: ${archive} (${size} bytes)\nSHA-256: ${sha}`);
