import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) { await check(path); continue; }
    if (/\.(m?js)$/.test(path)) {
      const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    }
    if (path.endsWith('.json')) JSON.parse(await readFile(path, 'utf8'));
    if (directory === 'src' && !path.endsWith('.svg')) {
      const source = await readFile(path, 'utf8');
      assert(!/https?:\/\//.test(source), `Runtime external URL: ${path}`);
    }
  }
}
await check('src'); await check('scripts'); await check('tests');
console.log('Syntax, JSON and runtime external-dependency checks passed.');
