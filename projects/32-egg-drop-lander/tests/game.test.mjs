/*
 * 蛋落地 · 玩法单测（四期：严格 1:1 复刻 eazo 原版）
 *
 * 直接加载浏览器端的 game.js（导出到 global），不引入额外依赖。
 * 断言全部按 eazo 原版机制（reference/eazo-spec.txt）逐条对齐：
 *   - 纯竖直点按（无任何水平分量）、0 延迟、扣一发；
 *   - 准备期 0.8s、初速 vx = 0.15 × wind、每帧 vy += gravity*dt / vx += wind*dt；
 *   - 侧墙 ±260 / 恢复系数 0.4、原版无天花板（蛋可以升到 y < 0）；
 *   - 障碍带每落只判一次：缺口外撞带只折损一发并继续下落（不摔碎）；
 *   - 四档评级 0.4 / 0.75 / 限速；
 *   - 关卡表 12 行按原版原值锁定回归（impulse 与 gapHalf 一并锁定）；
 *   - 原版缺陷保留：末段关卡脉冲预算不足，数学上无法清零落速。
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

function stepUntil(state, predicate, maxSteps = 40000) {
  for (let i = 0; i < maxSteps; i++) {
    const event = game.step(state, STEP);
    if (event) return event;
    if (predicate && predicate(state)) return null;
  }
  return null;
}

/* —— eazo 原版关卡表（reference/eazo-spec.txt 逐值提取，锁定回归） —— */
const ORIGINAL_TABLE = [
  { name: 'First Nest', zhName: '初次落巢', height: 900, gravity: 260, wind: 0, pulses: 6, impulse: 190, maxSpeed: 300 },
  { name: 'Meadow', zhName: '草地', height: 1000, gravity: 280, wind: 0, pulses: 6, impulse: 190, maxSpeed: 290 },
  { name: 'Breeze', zhName: '微风', height: 1100, gravity: 290, wind: 40, pulses: 6, impulse: 195, maxSpeed: 280 },
  { name: 'Tall Barn', zhName: '高谷仓', height: 1350, gravity: 300, wind: -30, pulses: 6, impulse: 200, maxSpeed: 270 },
  { name: 'Rooftops', zhName: '屋顶', height: 1450, gravity: 320, wind: 55, pulses: 6, impulse: 205, maxSpeed: 260 },
  { name: 'Gully', zhName: '峡沟', height: 1550, gravity: 330, wind: -60, pulses: 5, impulse: 210, maxSpeed: 250, obstacle: { atY: 0.5, gapCenter: 0.42, gapHalf: 0.2 } },
  { name: 'Cliffside', zhName: '崖边', height: 1700, gravity: 345, wind: 70, pulses: 5, impulse: 215, maxSpeed: 245 },
  { name: 'Windmill', zhName: '风车', height: 1800, gravity: 355, wind: -85, pulses: 5, impulse: 220, maxSpeed: 235 },
  { name: 'Canyon', zhName: '峡谷', height: 1950, gravity: 370, wind: 60, pulses: 5, impulse: 225, maxSpeed: 225, obstacle: { atY: 0.55, gapCenter: 0.6, gapHalf: 0.17 } },
  { name: 'Storm Ridge', zhName: '风暴岭', height: 2100, gravity: 390, wind: -100, pulses: 5, impulse: 230, maxSpeed: 215 },
  { name: 'Tower', zhName: '高塔', height: 2300, gravity: 410, wind: 90, pulses: 4, impulse: 240, maxSpeed: 205 },
  { name: 'The Spire', zhName: '尖峰', height: 2550, gravity: 435, wind: -110, pulses: 4, impulse: 250, maxSpeed: 195, obstacle: { atY: 0.5, gapCenter: 0.5, gapHalf: 0.15 } }
];

test('关卡表：12 关与 eazo 原版逐字段一致（含 impulse 与 gapHalf 原值，无缩放字段）', () => {
  assert.equal(content.levels.length, 12);
  for (let i = 0; i < ORIGINAL_TABLE.length; i++) {
    const t = ORIGINAL_TABLE[i];
    const lv = content.levels[i];
    for (const key of ['name', 'zhName', 'height', 'gravity', 'wind', 'pulses', 'impulse', 'maxSpeed']) {
      assert.strictEqual(lv[key], t[key], '关卡 ' + (i + 1) + ' 的 ' + key + ' 与原版表不符');
    }
    if (t.obstacle) {
      assert.ok(lv.obstacle, '关卡 ' + (i + 1) + ' 缺少障碍带');
      assert.strictEqual(lv.obstacle.atY, t.obstacle.atY, '关卡 ' + (i + 1) + ' 障碍带 atY 与原版不符');
      assert.strictEqual(lv.obstacle.gapCenter, t.obstacle.gapCenter, '关卡 ' + (i + 1) + ' 缺口中心与原版不符');
      assert.strictEqual(lv.obstacle.gapHalf, t.obstacle.gapHalf, '关卡 ' + (i + 1) + ' 缺口半宽与原版不符（.2/.17/.15）');
    } else {
      assert.ok(!lv.obstacle, '关卡 ' + (i + 1) + ' 不应有障碍带');
    }
    assert.strictEqual(lv.gScale, undefined, '关卡 ' + (i + 1) + ' 不应保留 gScale 缩放字段');
  }
});

test('初始状态：第一关、脉冲按关卡配置发放、准备期、初始 vx = 0.15 × wind 原值', () => {
  const state = game.createRun(content);
  assert.equal(state.levelIndex, 0);
  assert.equal(state.phase, 'ready');
  assert.equal(state.pulses, content.levels[0].pulses);
  assert.equal(state.egg.y, 0);
  assert.equal(state.egg.x, 0);
  assert.ok(Math.abs(state.egg.vx - 0.15 * content.levels[0].wind) < 1e-9);
});

test('反推扣一发脉冲，vy 立即减去冲量（0 延迟，原版 t.vy -= l.impulse）', () => {
  const state = game.createRun(content);
  state.phase = 'falling';
  state.egg.vy = 200;
  const before = state.pulses;
  const event = game.pulse(state);
  assert.equal(event.type, 'pulse');
  assert.equal(state.pulses, before - 1);
  assert.equal(state.egg.vy, 200 - content.levels[0].impulse);
});

test('点按纯竖直（原版）：任何点按都不产生水平冲量，vx 保持不变', () => {
  const state = game.createRun(content);
  state.phase = 'falling';
  state.egg.vx = 37;
  game.pulse(state);
  assert.equal(state.egg.vx, 37, '反推不应改变 vx');
});

test('脉冲用完后点按返回 empty，不再扣发', () => {
  const state = game.createRun(content);
  state.phase = 'falling';
  state.pulses = 0;
  const event = game.pulse(state);
  assert.equal(event.type, 'empty');
});

test('准备期 0.8s 后自动开落；准备期内点按立即开落并消耗脉冲', () => {
  const state = game.createRun(content);
  stepUntil(state, (s) => s.phase === 'falling');
  assert.equal(state.phase, 'falling');
  assert.ok(state.time >= game.READY_TIME - 1e-9);

  const state2 = game.createRun(content);
  const pulsesBefore = state2.pulses;
  game.pulse(state2);
  assert.equal(state2.phase, 'falling', '准备期点按应立即开落');
  assert.equal(state2.pulses, pulsesBefore - 1);
});

test('每帧物理（原值）：vy += gravity*dt、vx += wind*dt，无任何缩放', () => {
  const level = content.levels[11]; /* 尖峰 g=435 wind=-110 */
  const state = game.initDropState(level);
  state.phase = 'falling';
  state.time = 1;
  const vy0 = state.egg.vy;
  const vx0 = state.egg.vx;
  game.step(state, 0.5);
  assert.ok(Math.abs(state.egg.vy - (vy0 + 435 * 0.5)) < 1e-9, 'vy 增量应恰为 gravity*dt');
  assert.ok(Math.abs(state.egg.vx - (vx0 + (-110) * 0.5)) < 1e-9, 'vx 增量应恰为 wind*dt');
});

test('风持续施加水平加速度（风暴岭 wind=-100 原值）', () => {
  const level = content.levels[9];
  const state = game.initDropState(level);
  state.phase = 'falling';
  const vx0 = state.egg.vx;
  game.step(state, 1);
  assert.ok(Math.abs(state.egg.vx - (vx0 + level.wind)) < 1e-6);
  assert.ok(level.wind < 0, '风暴岭应为西风（负）');
});

test('侧墙反弹：越过 ±260 弹回并向内衰减（恢复系数 0.4）', () => {
  const level = content.levels[0];
  const state = game.initDropState(level);
  state.phase = 'falling';
  state.time = 1;
  state.egg.x = -270;
  state.egg.vx = -100;
  game.step(state, STEP);
  assert.equal(state.egg.x, -game.WORLD_HALF, '蛋心被夹回左墙');
  assert.ok(state.egg.vx > 0, '撞左墙后向右反弹');
  assert.ok(Math.abs(state.egg.vx - game.WALL_BOUNCE * 100) < 1e-6, '恢复系数 0.4');
});

test('原版缺陷保留：反推可把蛋顶到 y < 0（原版没有天花板）', () => {
  const level = content.levels[0];
  const state = game.initDropState(level);
  state.phase = 'falling';
  state.time = 1;
  state.egg.vy = -400;
  game.step(state, STEP);
  assert.ok(state.egg.y < 0, '蛋应被允许升到起点上方（y=' + state.egg.y + '）');
  assert.ok(state.egg.vy < 0, '上升过程中不应被天花板反弹');
});

test('四档评级边界：0.4 / 0.75 / 限速', () => {
  assert.equal(game.gradeOf(40, 100), 'perfect');
  assert.equal(game.gradeOf(41, 100), 'safe');
  assert.equal(game.gradeOf(75, 100), 'safe');
  assert.equal(game.gradeOf(76, 100), 'cracked');
  assert.equal(game.gradeOf(100, 100), 'cracked');
  assert.equal(game.gradeOf(100.1, 100), 'broken');
});

test('软着陆：低速触地得 perfect，结算计入幸存', () => {
  const level = content.levels[0];
  const state = game.initDropState(level);
  state.phase = 'falling';
  state.time = 1;
  state.egg.y = level.height - 20;
  state.egg.vy = 40;
  state.egg.vx = 0;
  const event = stepUntil(state, null);
  assert.equal(event.type, 'landed');
  assert.equal(event.grade, 'perfect');
  assert.equal(event.pulsesLeft, state.pulses);
});

test('超速触地算摔碎（broken）', () => {
  const level = content.levels[0];
  const state = game.initDropState(level);
  state.phase = 'falling';
  state.time = 1;
  state.egg.y = level.height - 20;
  state.egg.vy = level.maxSpeed + 150;
  state.egg.vx = 0;
  const event = stepUntil(state, null);
  assert.equal(event.type, 'landed');
  assert.equal(event.grade, 'broken');
});

test('障碍带（原版）：缺口内通过不扣发；缺口外只折损一发并继续下落（不摔碎）', () => {
  const level = content.levels[5]; /* 峡沟 gapHalf .2 → 通行半宽 2×0.2×260 = 104 */
  const bandY = level.obstacle.atY * level.height;
  assert.equal(game.gapPassHalf(level), 104, '通行半宽应为 2×gapHalf×260');
  assert.ok(Math.abs(game.gapCenterX(level) + 41.6) < 1e-6, '缺口中心应为 (gapCenter−.5)×520');
  const gapCx = game.gapCenterX(level);

  /* 缺口内：不扣脉冲，蛋继续下落至触地 */
  const pass = game.initDropState(level);
  pass.phase = 'falling';
  pass.time = 1;
  pass.egg.y = bandY - 1;
  pass.egg.x = gapCx;
  pass.egg.vy = 100;
  pass.egg.vx = 0;
  let event = stepUntil(pass, null);
  assert.equal(event.type, 'landed', '缺口内应继续下落至触地');
  assert.ok(pass.usedObstacle, '障碍带应标记为已判定');
  assert.equal(pass.pulses, level.pulses, '缺口内通过不应扣脉冲');

  /* 缺口外：折损一发（bandHit），蛋继续下落直到触地 */
  const miss = game.initDropState(level);
  miss.phase = 'falling';
  miss.time = 1;
  miss.egg.y = bandY - 1;
  miss.egg.x = gapCx + game.gapPassHalf(level) + 30;
  miss.egg.vy = 100;
  miss.egg.vx = 0;
  event = stepUntil(miss, null);
  assert.ok(event.type === 'bandHit' || event.type === 'landed', '应先触发撞带事件');
  assert.ok(miss.usedObstacle, '障碍带只判一次');
  assert.equal(miss.pulses, level.pulses - 1, '撞带应恰好折损一发脉冲');
  assert.notEqual(miss.phase, 'landed', '撞带后蛋应继续下落而不是摔碎');

  /* 每落只判一次：继续下落到触地，脉冲不再减少 */
  const landed = stepUntil(miss, null);
  assert.equal(landed.type, 'landed', '撞带后应继续下落并触地');
  assert.equal(miss.pulses, level.pulses - 1, '障碍带每落只扣一发');
});

test('障碍带：pulses 为 0 时撞带不再扣发（原版 &&e.pulses>0 短路）', () => {
  const level = content.levels[11]; /* 尖峰 gapHalf .15 → 通行半宽 78 */
  const bandY = level.obstacle.atY * level.height;
  const state = game.initDropState(level);
  state.phase = 'falling';
  state.time = 1;
  state.pulses = 0;
  state.egg.y = bandY - 1;
  state.egg.x = game.gapCenterX(level) + game.gapPassHalf(level) + 30;
  state.egg.vy = 100;
  state.egg.vx = 0;
  let event = null;
  for (let i = 0; i < 50 && !state.usedObstacle; i++) {
    event = game.step(state, STEP);
  }
  assert.ok(state.usedObstacle, '障碍带应已判定（判定的那一帧）');
  assert.equal(event, null, '撞带但无脉冲：判定帧不产生事件');
  assert.equal(state.pulses, 0);
});

test('结算（原版口径）：幸存落数、幸存落最佳落速、每落剩余反推合计（碎裂也不例外）', () => {
  const state = game.createRun(content);
  game.registerResult(state, { grade: 'safe', speed: 150, pulsesLeft: 3 });
  game.registerResult(state, { grade: 'perfect', speed: 90, pulsesLeft: 2 });
  assert.equal(state.streak, 2);
  assert.equal(state.perfects, 1);
  assert.equal(state.run.survived, 2);
  assert.equal(state.run.bestSpeed, 90);
  assert.equal(state.run.pulsesLeftOver, 5);

  game.registerResult(state, { grade: 'cracked', speed: 220, pulsesLeft: 1 });
  assert.equal(state.streak, 0, '裂纹清零连击');
  assert.equal(state.run.survived, 3, '裂纹仍计入幸存落数');
  assert.equal(state.run.bestSpeed, 90, '裂纹落速不计入最佳落速');

  game.registerResult(state, { grade: 'broken', speed: 400, pulsesLeft: 0 });
  assert.equal(state.run.survived, 3, '碎裂不计入幸存');
  assert.equal(state.run.pulsesLeftOver, 6, '碎裂落次的剩余脉冲仍计入合计');
});

test('重开同一关脉冲重置，进入下一关才推进', () => {
  const state = game.createRun(content);
  state.pulses = 1;
  game.loadLevel(state, state.levelIndex);
  assert.equal(state.pulses, content.levels[0].pulses, '重试本关脉冲应重置为关卡配置');
  assert.equal(state.levelIndex, 0);
  assert.equal(state.phase, 'ready');

  game.loadLevel(state, 1);
  assert.equal(state.levelIndex, 1);
  assert.equal(state.pulses, content.levels[1].pulses);
});

test('原版缺陷保留：末四关脉冲预算不足以清零落速（数学上无法完美贴地）', () => {
  for (const idx of [8, 9, 10, 11]) {
    const lv = content.levels[idx];
    const idleSpeed = Math.sqrt(2 * game.gravityOf(lv) * lv.height);
    const budget = lv.pulses * lv.impulse;
    const residual = idleSpeed - budget;
    assert.ok(
      residual > 0,
      lv.zhName + '：自由落体末速 ' + idleSpeed.toFixed(0) + ' − 脉冲预算 ' + budget +
        ' = ' + residual.toFixed(1) + ' 应为正（原版参数下无法清零落速，缺陷按原样保留）'
    );
  }
});

test('不动手必碎（每一关自由落体末速都超过限速）', () => {
  for (const lv of content.levels) {
    const idleSpeed = Math.sqrt(2 * game.gravityOf(lv) * lv.height);
    assert.ok(idleSpeed > lv.maxSpeed, lv.zhName + '：不动手落速 ' + idleSpeed.toFixed(0) + ' 应超过限速 ' + lv.maxSpeed);
  }
});

test('蛋的可见尺寸在 390px 视口下不小于 72px', () => {
  /* 蛋画成 64×66 虚拟单位；390px 视口下画布高约 560 CSS px */
  const scale = 560 / game.VIEW_HEIGHT;
  const cssWidth = game.EGG_HALF_W * 2 * scale;
  const cssHeight = game.EGG_HALF_H * 2 * scale;
  assert.ok(Math.min(cssWidth, cssHeight) >= 72, '蛋的可见直径约 ' + Math.min(cssWidth, cssHeight).toFixed(0) + 'px，小于 72px');
});
