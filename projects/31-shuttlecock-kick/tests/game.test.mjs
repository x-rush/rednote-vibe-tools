/*
 * 毽子连击 · 玩法单测
 * 直接加载浏览器端的 game.js（它导出到 global），不引入额外依赖。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
require(path.join(ROOT, 'src/game.js'));
const game = global.JianziGame;

const content = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/content/content.json'), 'utf8').replace(/^\uFEFF/, '')
);

const STEP = 1 / 120;

/* 推进物理直到进入接球窗口 */
function stepUntilWindow(state, maxSteps = 4000) {
  for (let i = 0; i < maxSteps; i++) {
    if (game.isCatchWindow(state)) return true;
    const event = game.step(state, STEP);
    if (event && event.type === 'land') return false;
  }
  return false;
}

/* 推进物理直到落地 */
function stepUntilLand(state, maxSteps = 4000) {
  for (let i = 0; i < maxSteps; i++) {
    const event = game.step(state, STEP);
    if (event && event.type === 'land') return true;
  }
  return false;
}

test('初始状态落在第一关，毽子停在地面', () => {
  const state = game.createRun(content);
  assert.equal(state.levelIndex, 0);
  assert.equal(state.phase, 'ready');
  assert.equal(state.caught, 0);
  assert.equal(state.combo, 0);
  assert.equal(state.lives, content.levels[0].lives);
  assert.equal(state.bird.y, game.GROUND_Y);
});

test('起踢一脚进入飞行，连击从 1 开始但不计入接住次数', () => {
  const state = game.createRun(content);
  const event = game.kick(state);
  assert.equal(event.type, 'kick');
  assert.equal(event.first, true);
  assert.equal(state.phase, 'flying');
  assert.equal(state.combo, 1);
  assert.equal(state.caught, 0);
  assert.ok(state.bird.vy < 0, '起踢后应向上飞');
});

test('踢早了算空踢：连击清零，但毽子继续飞', () => {
  const state = game.createRun(content);
  game.kick(state);
  const event = game.kick(state);
  assert.equal(event.type, 'whiff');
  assert.equal(state.combo, 0);
  assert.equal(state.phase, 'flying');
});

test('落进接球窗口算有效接住：连击与接住数同时加一', () => {
  const state = game.createRun(content);
  game.kick(state);
  assert.ok(stepUntilWindow(state), '应当能进入接球窗口');
  const before = state.score;
  const event = game.kick(state);
  assert.equal(event.type, 'kick');
  assert.equal(event.combo, 2);
  assert.equal(state.combo, 2);
  assert.equal(state.caught, 1);
  assert.ok(state.score > before, '有效接住应得分');
});

test('接住次数达到目标即过关，并结算总分', () => {
  const state = game.createRun(content);
  game.kick(state);
  let guard = 0;
  while (state.phase !== 'levelClear' && guard < 200) {
    guard++;
    if (!game.isCatchWindow(state)) {
      if (!stepUntilWindow(state)) break;
    }
    game.kick(state);
  }
  assert.equal(state.phase, 'levelClear');
  assert.equal(state.caught, state.level.target);
  assert.ok(state.score > 0);
});

test('落地扣一次机会，归零连击，机会用尽则本关失败', () => {
  const state = game.createRun(content);
  game.kick(state);
  assert.ok(stepUntilLand(state), '应当能落地');
  assert.equal(state.phase, 'landed');
  const result = game.recover(state);
  assert.equal(result.type, 'lifeLost');
  assert.equal(state.lives, content.levels[0].lives - 1);
  assert.equal(state.combo, 0);
  assert.equal(state.phase, 'ready');

  state.lives = 1;
  game.kick(state);
  stepUntilLand(state);
  const fail = game.recover(state);
  assert.equal(fail.type, 'levelFail');
  assert.equal(state.phase, 'levelFail');
});

test('重试会重置本关进度但保留历史最高连击', () => {
  const state = game.createRun(content);
  game.kick(state);
  stepUntilWindow(state);
  game.kick(state);
  assert.equal(state.bestCombo, 2);
  game.loadLevel(state, 0);
  assert.equal(state.caught, 0);
  assert.equal(state.lives, content.levels[0].lives);
  assert.equal(state.bestCombo, 2, '最高连击是跨关记录，不该被重置');
});

test('接球线必须落在抛物线顶点之下', () => {
  for (const level of content.levels) {
    const apexY = game.GROUND_Y - game.apexHeight(level);
    const line = game.catchLineY({ level });
    assert.ok(line >= apexY, level.name + '：接球线高于顶点');
  }
});

test('每一关的操作窗口都在可玩范围内，且逐关收窄', () => {
  let previous = Infinity;
  for (const level of content.levels) {
    const w = game.windowSeconds(level);
    assert.ok(w >= 0.16, level.name + '：窗口 ' + w.toFixed(3) + 's 过短');
    assert.ok(w <= 0.75, level.name + '：窗口 ' + w.toFixed(3) + 's 过长');
    assert.ok(w <= previous + 0.012, level.name + '：窗口未收窄');
    previous = Math.min(previous, w);
  }
});

test('外观档位按连击数解锁', () => {
  const tiers = content.meta.tiers;
  assert.equal(game.tierOf(content, 0), tiers[0]);
  assert.equal(game.tierOf(content, tiers[1].min), tiers[1]);
  assert.equal(game.tierOf(content, 999), tiers[tiers.length - 1]);
  assert.equal(game.unlockedTier(content, tiers[2].min), tiers[2]);
});
