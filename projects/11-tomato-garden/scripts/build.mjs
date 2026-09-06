import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';

const [html, engine, art, app, rawContent] = await Promise.all([
  readFile('index.html', 'utf8'), readFile('src/engine.js', 'utf8'),
  readFile('src/art.js', 'utf8'), readFile('src/app.js', 'utf8'),
  readFile('src/content/content.json', 'utf8'),
]);
// This project has a fixed, dependency-free module graph. Fail if that graph changes.
const entry = app.indexOf('const { ui: t, plants, timing, brand } = content;');
assert(entry > 0, 'App content entry was not found');
const declarations = source => source.replace(/^export (?=(?:const|function)\b)/gm, '');
const bundle = `(() => {\n'use strict';\n${declarations(engine)}\n${declarations(art)}\nconst content = ${JSON.stringify(JSON.parse(rawContent))};\n${app.slice(entry)}\n})();\n`;
assert(!/\b(?:import|export)\s|\bfetch\s*\(/.test(bundle), 'Offline bundle contains unsupported module or network loading');
new Script(bundle);
const outputHtml = html
  .replace('<script type="module" src="./src/app.js"></script>', '<script defer src="./assets/app.js"></script>')
  .replaceAll('./src/', './assets/');
assert(!outputHtml.includes('type="module"'), 'Offline entry must use classic scripts');
// Clean only this project's generated output, so no old modules enter the archive.
await rm('dist', { recursive: true, force: true });
await mkdir('dist/assets', { recursive: true });
await Promise.all([
  writeFile('dist/index.html', outputHtml), writeFile('dist/assets/app.js', bundle),
  ...['style.css', 'tokens.css', 'favicon.svg'].map(file => copyFile(`src/${file}`, `dist/assets/${file}`)),
]);
console.log('Offline classic-script build ready: dist/');
