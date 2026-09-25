import {createRequire} from 'node:module';
import {mkdir, readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {click} from '../qa/editor-actions.mjs';

const require = createRequire(import.meta.url);
const {chromium} = require('C:/Users/77958/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const content = JSON.parse(await readFile(new URL('../src/content/content.json', import.meta.url), 'utf8'));
const engine = require('../src/engine.js')(content);
const shareFormat = process.argv.includes('--share');
const output = new URL(shareFormat ? './screenshots-3x4/' : './screenshots/', import.meta.url);
await mkdir(output, {recursive: true});

function place(state, item, area, x, y) {
  const result = engine.act(state, {type: 'buy', item, area, x, y}, state.last);
  assert.equal(result.ok, true, `${item} cannot be placed: ${result.error}`);
}

function seedGarden() {
  const state = engine.fresh(Date.now());
  Object.assign(state, {coins: 40000, xp: 500, expansion: 7, maps: [0, 1, 2], map: 0, lakeEdition: 7});
  for (const [item, area, x, y] of [
    ['bamboo', 0, 23, 42], ['plum', 0, 35, 26], ['pavilion', 0, 66, 70],
    ['orchid', 0, 46, 71], ['lantern', 0, 56, 58], ['rock', 0, 18, 72],
    ['moonwall', 0, 68, 29], ['table', 0, 49, 52],
    ['manor', 2, 62, 35], ['bamboo', 2, 20, 48], ['plum', 2, 72, 73],
    ['orchid', 2, 41, 66], ['willow', 2, 33, 31],
  ]) place(state, item, area, x, y);
  return state;
}

function seedLake() {
  const state = engine.fresh(Date.now());
  Object.assign(state, {
    coins: 40000, xp: 500, expansion: 7, maps: [0, 1, 2], map: 1, lakeEdition: 7,
    harbor: {step: content.harbor.steps.length, mistake: false, repaired: true, route: 'manual', bonus: true, gift: false, guest: ''},
  });
  for (const [item, area, x, y] of [
    ['bamboo', 0, 22, 40], ['plum', 0, 40, 28], ['pavilion', 0, 24, 70],
    ['orchid', 0, 52, 67], ['lantern', 0, 56, 56],
    ['lotus', 1, 20, 20], ['boat', 1, 30, 45],
  ]) place(state, item, area, x, y);
  return state;
}

const browser = await chromium.launch({headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const errors = [];
async function open(state) {
  const context = await browser.newContext({viewport: shareFormat ? {width: 600, height: 800} : {width: 390, height: 844}, deviceScaleFactor: 2});
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({key, state}) => localStorage.setItem(key, JSON.stringify(state)), {key: content.storageKey, state});
  await page.goto('http://127.0.0.1:4327/', {waitUntil: 'networkidle'});
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode().catch(() => {}))); });
  return {context, page};
}
async function shot(page, name) {
  await page.screenshot({path: fileURLToPath(new URL(name, output)), animations: 'disabled'});
}

try {
  const garden = await open(seedGarden());
  await click(garden.page, 'view');
  await shot(garden.page, '01-自由布置的春园.png');
  await click(garden.page, 'view');

  await click(garden.page, 'shop');
  await shot(garden.page, '02-景物与植物.png');
  await click(garden.page, 'close');

  await click(garden.page, 'objects');
  await click(garden.page, 'selectFromList', '[data-uid="1"]');
  await click(garden.page, 'move');
  await shot(garden.page, '03-拖动布景.png');
  await click(garden.page, 'cancel');

  await garden.context.close();

  const lake = await open(seedLake());
  await click(lake.page, 'view');
  await shot(lake.page, '04-荷风湖汀.png');
  await click(lake.page, 'view');
  await click(lake.page, 'harbor');
  await click(lake.page, 'harborGuest');
  await shot(lake.page, '05-湖岸来客.png');
  await lake.context.close();
  assert.deepEqual(errors, []);
  console.log('Captured five current-game screenshots without page errors.');
} finally {
  await browser.close();
}
