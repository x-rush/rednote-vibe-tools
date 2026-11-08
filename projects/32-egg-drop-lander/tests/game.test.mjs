/*
 * 蛋落地 · 玩法单测
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
const game = global.EggGame;

const content = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/content/content.json'), 'utf8').replace(/^\uFEFF/, '')
);

const STEP = 1 / 240;

function stepUntil(state, predicate, maxSteps = 4000) {
  for (let i = 0; i < maxSteps; i++) {
    const event = game.step(state, STEP);
    if (event) return event;
    if (predicate && predicate(state)) return null;
  }
  return null;
}

test('初始状态落在第一关，气量与机会都按关卡配置发放', () => {
  const state = game.createRun(content);
  assert.equal(state.levelIndex, 0);
  assert.equal(state.phase, 'falling');
  assert.equal(state.lives, 3);
  assert.equal(state.gas, content.levels[0].gas);
  assert.equal(state.egg.y, game.SPAWN_Y);
});

test('喷气消耗一次气量，并压低下坠速度', () => {
  const state = game.createRun(content);
  state.egg.vy = 200;
  const gasBefore = state.gas;
  const event = game.thrust(state, state.egg.x);
  assert.equal(event.type, 'thrust');
  assert.equal(state.gas, gasBefore - 1);
  assert.ok(state.egg.vy < 200, '喷气后下坠速度应下降');
  assert.equal(state.egg.vy, 200 - content.levels[0].thrust);
});

test('气用光之后喷不动了', () => {
  const state = game.createRun(content);
  state.gas = 0;
  const event = game.thrust(state, state.egg.x);
  assert.equal(event.type, 'empty');
});

test('点击位置决定侧向冲量：点蛋正上方不偏移，点左边往左偏', () => {
  const state = game.createRun(content);
  state.egg.vx = 0;
  game.thrust(state, state.egg.x);
  assert.equal(state.egg.vx, 0);
  const state2 = game.createRun(content);
  game.thrust(state2, state2.egg.x - 200);
  assert.ok(state2.egg.vx < 0, '点在左边应产生向左的冲量');
});

test('速度低于安全线时落地算软着陆，高于安全线算摔碎', () => {
  const state = game.createRun(content);
  state.egg.x = state.padX;
  state.egg.y = state.level.padY - 20;
  state.egg.vy = 40;
  const soft = stepUntil(state, null);
  assert.equal(soft.type, 'land');
  assert.equal(soft.safe, true);

  const state2 = game.createRun(content);
  state2.egg.x = state2.padX;
  state2.egg.y = state2.level.padY - 20;
  state2.egg.vy = state2.level.safe + 120;
  const hard = stepUntil(state2, null);
  assert.equal(hard.type, 'land');
  assert.equal(hard.safe, false);
});

test('没落在叶子上就是漏接', () => {
  const state = game.createRun(content);
  state.egg.x = state.padX + state.level.padW;
  state.egg.vy = 300;
  const event = stepUntil(state, null);
  assert.equal(event.type, 'miss');
});

test('同一关内换蛋保留机会数与气量，进入下一关才重置', () => {
  const state = game.createRun(content);
  state.lives = 2;
  state.gas = 3;
  game.resetDrop(state);
  assert.equal(state.lives, 2);
  assert.equal(state.gas, 3);
  assert.equal(state.phase, 'falling');

  game.loadLevel(state, 1);
  assert.equal(state.lives, 3);
  assert.equal(state.gas, content.levels[1].gas);
  assert.equal(state.levelIndex, 1);
});

test('每一关都必须动手：安全线低于终端速度，且气量够用', () => {
  for (const level of content.levels) {
    const terminal = game.terminalSpeed(level);
    assert.ok(level.safe < terminal, level.name + '：安全线高于终端速度，不动手也安全');
    assert.ok(level.safe > 40, level.name + '：安全线过低，落地速度根本达不到');
    assert.ok(level.gas >= 3, level.name + '：气量过少，不可能过关');
    assert.ok(level.gas <= 10, level.name + '：气量过多，节奏失去意义');
    /* 一次喷气的反馈要看得见，且各关力度保持一致 */
    const ratio = level.thrust / terminal;
    assert.ok(ratio >= 0.09 && ratio <= 0.19, level.name + '：一次喷气的力度偏离手感基线（' + (ratio * 100).toFixed(1) + '%）');
  }
});

test('十二关的安全线随难度收紧，气量保持统一预算', () => {
  const first = content.levels[0];
  const last = content.levels[content.levels.length - 1];
  assert.ok(last.safe < first.safe, '安全线应逐关收紧');
  /* 气量统一：难度靠「需要的喷气次数」递增，而不是靠砍气量 */
  const gasSet = new Set(content.levels.map((l) => l.gas));
  assert.ok(gasSet.size === 1, '气量预算应统一，实际为 ' + [...gasSet].join('/'));
});
