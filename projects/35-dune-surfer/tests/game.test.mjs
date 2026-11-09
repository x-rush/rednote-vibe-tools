/*
 * 沙丘速降 · 玩法单测（三期严格复刻版）
 * 断言全部按 eazo 原版数值（reference/eazo-spec.txt），含原版缺陷：
 *   · 非游玩（巡航）状态也会把旗门标记成已判定（passed=1/2），但不计分；
 *   · 错过的门不会再恢复。
 * 只测纯逻辑：ava 经济、旗门生成与判定、转向手感、速度模型、
 * 边界反弹、巡航公式、米数口径、回收与上限。
 */
import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
createRequire(import.meta.url)(path.join(ROOT, 'src/game.js'));
const game = global.DuneGame;

const W = 390;
const H = 844;
const DT = 16.6; /* ms，一帧 */

function newRun(seed) {
  const state = game.createRun(W);
  state.rand = game.makeRandom(seed === undefined ? 12345 : seed);
  game.startRun(state, W);
  return state;
}

function step(state, dt, mode, now) {
  return game.step(state, dt, { width: W, height: H, mode: mode || 'play', now: now || 0 });
}

/* 跑 n 毫秒（按 DT 步进） */
function runFor(state, ms, mode) {
  const frames = Math.round(ms / DT);
  for (let i = 0; i < frames; i++) step(state, DT, mode, (i + 1) * DT);
  return state;
}

test('初始状态：ava 0.42、x 居中、前方已有旗门', () => {
  const blank = game.createRun(W);
  assert.strictEqual(blank.gen, 0, 'createRun 的生成器游标从 0 开始（原版 ref 初值）');
  const state = newRun();
  assert.strictEqual(state.ava, 0.42);
  assert.ok(state.gen >= 2600, 'startRun 后生成器游标已推进到 2600 预取线（' + state.gen.toFixed(1) + '）');
  assert.strictEqual(state.wy, 0);
  assert.strictEqual(state.x, W / 2);
  assert.strictEqual(state.vx, 0);
  assert.strictEqual(state.dist, 0);
  assert.strictEqual(state.gates, 0);
  assert.strictEqual(state.dead, 0);
  assert.strictEqual(state.air, 0);
  assert.ok(state.gateList.length > 0, '开局前方就应该有旗门');
  const first = state.gateList[0];
  assert.ok(first.y >= 700 - 0.01 && first.y <= 860 + 0.01, '第一面门在 400+300~460 附近（' + first.y + '）');
});

test('旗门生成节奏：300–460 一面，横向铺在画布宽 22%–78%', () => {
  for (const seed of [1, 5, 9, 13, 21, 34]) {
    const state = newRun(seed);
    /* 手动推进生成器到很远，检查所有门 */
    game.ensureGates(state, 30000, W);
    let prev = null;
    for (const g of state.gateList) {
      assert.ok(
        g.x >= W * 0.22 - 0.01 && g.x <= W * 0.78 + 0.01,
        '种子 ' + seed + '：门位 ' + g.x.toFixed(1) + ' 超出 22%–78%'
      );
      if (prev !== null) {
        const gap = g.y - prev;
        assert.ok(gap >= 300 - 0.01 && gap <= 460 + 0.01, '种子 ' + seed + '：门距 ' + gap.toFixed(1) + ' 不在 300–460');
      }
      prev = g.y;
    }
    assert.ok(state.gateList.length > 20, '30000 世界单位内应该有几十面门');
  }
});

test('穿过旗门：旗门数 +1、ava −0.10、爆发 18 粒粒子', () => {
  const state = newRun();
  const gate = state.gateList[0];
  gate.x = state.x; /* 门摆在玩家正下方 */
  const avaBefore = state.ava;
  const g0 = state.gates;
  let frames = 0;
  while (state.gates === g0 && frames++ < 400) step(state, DT);
  assert.strictEqual(state.gates, 1, '到线后应该判定穿门');
  /* ava 变化 = −0.10 + 漂移（约 0.042 * (frames*DT/1000)），必须净下降且接近 −0.10+漂移 */
  const drift = game.AVA_DRIFT * frames * DT;
  assert.ok(
    Math.abs(state.ava - (avaBefore - 0.1 + drift)) < 0.02,
    'ava 应该是 前值−0.10+漂移（实际 ' + state.ava.toFixed(4) + '，期望 ' + (avaBefore - 0.1 + drift).toFixed(4) + '）'
  );
  assert.ok(state.particles.length === 18, '穿门应爆发 18 粒粒子（实际 ' + state.particles.length + '）');
});

test('穿门地板：ava 已在 0.12 附近时不再更低', () => {
  const state = newRun();
  state.ava = game.AVA_FLOOR + 0.005;
  const gate = state.gateList[0];
  gate.x = state.x;
  let frames = 0;
  while (state.gates === 0 && frames++ < 400) step(state, DT);
  assert.strictEqual(state.gates, 1);
  assert.ok(state.ava >= game.AVA_FLOOR - 1e-9, 'ava 不能穿破地板 0.12（当前 ' + state.ava.toFixed(4) + '）');
});

test('错过旗门：ava +0.07（上限 1），且门被标成 passed=2', () => {
  const state = newRun();
  const gate = state.gateList[0];
  /* 门摆在玩家够不着的地方 */
  gate.x = state.x > W / 2 ? 40 : W - 40;
  const avaBefore = state.ava;
  let frames = 0;
  while (gate.passed === 0 && frames++ < 400) step(state, DT);
  assert.strictEqual(gate.passed, 2, '错过的门应被标记 passed=2');
  assert.strictEqual(state.gates, 0);
  const drift = game.AVA_DRIFT * frames * DT;
  assert.ok(
    Math.abs(state.ava - Math.min(1, avaBefore + 0.07 + drift)) < 0.02,
    '错门后 ava 应该是 前值+0.07+漂移（实际 ' + state.ava.toFixed(4) + '）'
  );
});

/* 冻结旗门：清空已有门 + 把生成器游标推到极远（step 不会再生成新门） */
function freezeGates(state) {
  state.gateList = [];
  state.gen = 1e9;
  return state;
}

test('雪崩恒定上涨：不碰门时每毫秒 +42e-6（每秒 0.042）', () => {
  const state = newRun();
  freezeGates(state);
  const avaBefore = state.ava;
  runFor(state, 1000);
  const delta = state.ava - avaBefore;
  assert.ok(
    Math.abs(delta - 0.042) < 0.002,
    '一秒内 ava 应该只上涨 0.042（实际 ' + delta.toFixed(4) + '）'
  );
  const deathTime = (game.AVA_DEATH - game.AVA_START) / (game.AVA_DRIFT * 1000);
  assert.ok(deathTime > 12 && deathTime < 15, '不穿门的死亡曲线应该在 13.3 秒附近（' + deathTime.toFixed(1) + '）');
});

test('ava 越过 0.98 → dead=1；dead>700ms → finished；死亡期间 dist/ava 冻结', () => {
  const state = newRun();
  freezeGates(state);
  state.ava = 0.979;
  runFor(state, 100);
  assert.ok(state.dead > 0, 'ava>0.98 应该置 dead 并开始死亡计时（' + state.dead.toFixed(1) + 'ms）');
  const distAtDeath = state.dist;
  const avaAtDeath = state.ava;
  runFor(state, 700);
  assert.ok(state.dead > 700, '死亡计时应该累计（' + state.dead.toFixed(0) + 'ms）');
  assert.strictEqual(state.finished, true, 'dead>700ms 应该结束这一局');
  assert.strictEqual(state.dist, distAtDeath, '死亡后米数不应该继续涨');
  assert.strictEqual(state.ava, avaAtDeath, '死亡后 ava 不应该继续涨');
});

test('转向手感：拖动时 vx += (dragX−x)×55e-5×dt，松手后 vx×0.93/帧衰减', () => {
  const state = newRun();
  freezeGates(state);
  game.setDrag(state, W * 0.9);
  const x0 = state.x;
  runFor(state, 600);
  assert.ok(state.x > x0 + 30, '拖住右侧应该明显右移（x ' + x0.toFixed(1) + ' → ' + state.x.toFixed(1) + '）');
  /* 松手：横向速度按 0.93 每帧衰减 */
  state.vx = 0.06;
  game.releaseDrag(state);
  const vxBefore = state.vx;
  runFor(state, 500);
  assert.ok(
    Math.abs(state.vx) < vxBefore * 0.15,
    '松手半秒后横向速度应该几乎耗尽（' + vxBefore.toFixed(3) + ' → ' + state.vx.toFixed(4) + '）'
  );
});

test('边界：x < 30 → x=30、vx=0.4|vx|；x > W−30 → x=W−30、vx=−0.4|vx|', () => {
  const state = newRun();
  freezeGates(state);
  state.x = 34;
  state.vx = -0.5;
  step(state, DT);
  assert.strictEqual(state.x, 30);
  const expected = 0.4 * Math.abs(-0.5 * 0.93);
  assert.ok(Math.abs(state.vx - expected) < 0.01, '左墙反弹应保留 0.4 倍并反向（vx=' + state.vx.toFixed(3) + '）');

  const right = newRun();
  right.gateList = [];
  right.x = W - 34;
  right.vx = 0.5;
  step(right, DT);
  assert.strictEqual(right.x, W - 30);
  assert.ok(right.vx < 0, '右墙反弹应该向左');
});

test('速度模型：p = 0.4 + min(0.28, 16e-5 × dist)；巡航恒 0.3', () => {
  const state = newRun();
  freezeGates(state);
  assert.ok(Math.abs(state.dist) < 1);
  /* 起步：p=0.4，米数增速 = dt×p×0.11 */
  const d0 = state.dist;
  runFor(state, 1000);
  const metersPerSec = state.dist - d0;
  assert.ok(Math.abs(metersPerSec - 0.4 * 0.11 * 1000) < 1, '起步每秒 ' + metersPerSec.toFixed(1) + ' 米，应为 44');
  /* 滑远后封顶 0.68：dist=3000 时 16e-5×3000=0.48 > 0.28 → p=0.68 */
  state.dist = 3000;
  const d1 = state.dist;
  runFor(state, 1000);
  const late = state.dist - d1;
  assert.ok(Math.abs(late - 0.68 * 0.11 * 1000) < 1, '封顶段每秒 ' + late.toFixed(1) + ' 米，应为 74.8');
  assert.ok(Math.abs(16e-5 * 1750 - 0.28) < 1e-9, '1750 米封顶');

  const cruiser = newRun();
  freezeGates(cruiser);
  const dc0 = cruiser.dist;
  runFor(cruiser, 1000, 'cruise');
  assert.strictEqual(cruiser.dist, dc0, '巡航不累计米数');
});

test('米数口径：meters = round(dist)', () => {
  const state = newRun();
  state.dist = 1234.6;
  assert.strictEqual(game.meters(state), 1235);
  state.dist = 12;
  assert.strictEqual(game.meters(state), 12);
});

test('巡航公式：x = W/2 + sin(.0011t)·W·0.2，vx = .3·cos(.0011t)，ava = .5 + .08·sin(5e-4t)', () => {
  const state = newRun();
  state.gateList = [];
  const now = 100000;
  step(state, DT, 'cruise', now);
  assert.ok(
    Math.abs(state.x - (W / 2 + Math.sin(0.0011 * now) * W * 0.2)) < 1e-6,
    '巡航 x 公式（实际 ' + state.x.toFixed(3) + '）'
  );
  assert.ok(
    Math.abs(state.vx - 0.3 * Math.cos(0.0011 * now)) < 1e-9,
    '巡航 vx 公式（实际 ' + state.vx.toFixed(6) + '）'
  );
  assert.ok(
    Math.abs(state.ava - (0.5 + 0.08 * Math.sin(5e-4 * now))) < 1e-9,
    '巡航 ava 公式（实际 ' + state.ava.toFixed(6) + '）'
  );
});

test('原版缺陷照抄：巡航状态也会把门标成已判定，但不计分、不加粒子', () => {
  const state = game.createRun(W);
  state.rand = game.makeRandom(7);
  game.startRun(state, W);
  const gate = state.gateList[0];
  gate.x = state.x;
  let frames = 0;
  while (gate.passed === 0 && frames++ < 400) step(state, DT, 'cruise', frames * DT);
  assert.ok(gate.passed !== 0, '巡航时到线的门也会被标记（原版缺陷）');
  assert.strictEqual(state.gates, 0, '但巡航不计分');
  /* 巡航的扬沙粒子照常存在（原版行为），这里只验证门与计分 */
});

test('回收：门落后 wy−400 之后被丢弃', () => {
  const state = newRun();
  game.ensureGates(state, 2600, W);
  const count = state.gateList.length;
  assert.ok(count > 3);
  /* 推进世界越过第一面门 400 以上 */
  state.wy = state.gateList[0].y + 401;
  game.ensureGates(state, 2600, W);
  assert.ok(state.gateList.length < count, '落后 400 以上的门应该被回收');
  for (const g of state.gateList) {
    assert.ok(g.y > state.wy - 400, '剩余门都必须满足 y > wy−400');
  }
});

test('粒子上限 220、轨迹 200 点（26 步长采样）', () => {
  const state = newRun();
  freezeGates(state);
  for (let i = 0; i < 500; i++) {
    state.particles.push({ x: 0, y: 0, vx: 0, vy: 0, life: 1, r: 3 });
  }
  runFor(state, 16);
  assert.ok(state.particles.length <= 220, '粒子应该被裁到 220（实际 ' + state.particles.length + '）');

  const trailer = newRun();
  freezeGates(trailer);
  runFor(trailer, 30000);
  assert.ok(trailer.trail.length <= 200, '轨迹应该封在 200 点（实际 ' + trailer.trail.length + '）');
  assert.ok(trailer.trail.length > 10, '轨迹应该有采样');
  for (let i = 1; i < trailer.trail.length; i++) {
    assert.ok(trailer.trail[i].y - trailer.trail[i - 1].y >= 26 - 1, '轨迹采样步长 ≥26 世界单位');
  }
});
