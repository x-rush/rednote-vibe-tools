import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { Script } from 'node:vm';

execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: new URL('..', import.meta.url) });
const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');

test('offline entry uses only local classic scripts, without an inline executable block', () => {
  assert(!/type=["']module["']/.test(html), 'Container cannot load module scripts');
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  assert.match(scripts[0][1], /src="\.\/assets\/app\.js"/);
  assert.equal(scripts[0][2].trim(), '');
});

test('offline bundle parses as a classic script and requires no fetch or device services', async () => {
  const js = await readFile(new URL('../dist/assets/app.js', import.meta.url), 'utf8');
  assert.doesNotThrow(() => new Script(js));
  assert(!/\b(?:import|export)\s|\bfetch\s*\(|XMLHttpRequest|WebSocket|Worker|requestFullscreen|eval\s*\(|new\s+Function/.test(js));
  const content = JSON.parse(await readFile(new URL('../src/content/content.json', import.meta.url), 'utf8'));
  assert(js.includes(`const content = ${JSON.stringify(content)};`), 'Built content comes directly from the sole content source');
  assert.deepEqual((await readdir(new URL('../dist/', import.meta.url))).sort(), ['assets', 'index.html']);
});
