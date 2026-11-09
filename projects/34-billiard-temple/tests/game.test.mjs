/*
 * 弹珠神殿（玉球金殿）· 玩法单测（三期严格 1:1 复刻口径）
 *
 * 全部断言以 reference/eazo-spec.txt 的原版数值为准，含原版缺陷：
 *   · 杆尽后不重打本殿，而是直接进入下一殿（原版如此）；
 *   · 摩擦是「每帧乘一次」，高刷设备停得更快（原版如此）；
 *   · 连锁球之间、连锁球与主球之间均无碰撞（原版如此）。
 *
 * 输入 bug 修复回归（用户真机报障「还没松手就发射」）单独成组，必须永远通过：
 *   快速点按不发射 / pointercancel 中止 / pointerId 归属 / 最小拖拽 / 最短按住。
 */
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const content = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/content/content.json'), 'utf8').replace(/^\uFEFF/, '')
);
createRequire(import.meta.url)(path.join(ROOT, 'src/game.js'));
const game = global.BilliardGame;

/* 种子随机（LCG）：让撒宝石 / 连锁扇出可复现 */
function makeRandom(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const W = 390;
const H = 760;

function newRun(mode) {
  game.setRng(makeRandom(20261109));
  const state = game.createRun(content, W, H);
  if (mode === 'play') game.setMode(state, 'play');
  return state;
}

/* 原版区域公式 */
test('殿内区域公式：{x:26, y:H*(.16|.07), w:W-52, h:H*(.56|.44)}', () => {
  const play = game.areaFor(W, H, false);
  assert.strictEqual(play.x, 26);
  assert.strictEqual(play.y, H * 0.16);
  assert.strictEqual(play.w, W - 52);
  assert.strictEqual(play.h, H * 0.56);
  const demo = game.areaFor(W, H, true);
  assert.strictEqual(demo.y, H * 0.07);
  assert.strictEqual(demo.h, H * 0.44);
});

/* 原版经济 */
test('八殿经济：宝石数 = 5 + min(5, 殿号)，每殿 4 杆，共 8 殿', () => {
  assert.strictEqual(game.ROOM_COUNT, 8);
  assert.strictEqual(game.SHOTS_PER_ROOM, 4);
  const want = [6, 7, 8, 9, 10, 10, 10, 10];
  for (let i = 1; i <= 8; i++) {
    assert.strictEqual(game.gemsForRoom(i), want[i - 1], '第 ' + i + ' 殿宝石数');
  }
  assert.strictEqual(content.meta.rooms.length, 8, '殿表应有八殿');
});

test('殿内随机撒宝石：内缩 34px、数量按公式、随机相位', () => {
  const area = game.areaFor(W, H, false);
  for (const room of [1, 3, 5, 8]) {
    const gems = game.scatterGems(room, area);
    assert.strictEqual(gems.length, game.gemsForRoom(room), '第 ' + room + ' 殿数量');
    for (const gem of gems) {
      assert.ok(gem.x >= area.x + 34 - 1e-9, '宝石 x 不得越过左内缩');
      assert.ok(gem.x <= area.x + area.w - 34 + 1e-9, '宝石 x 不得越过右内缩');
      assert.ok(gem.y >= area.y + 34 - 1e-9, '宝石 y 不得越过上内缩');
      assert.ok(gem.y <= area.y + area.h - 34 + 1e-9, '宝石 y 不得越过下内缩');
      assert.ok(gem.ph >= 0 && gem.ph < 6.28, '相位必须在 0~6.28');
      assert.strictEqual(gem.got, false);
    }
  }
});

test('撒宝石用注入随机：同种子结果完全一致（测试钩子）', () => {
  const area = game.areaFor(W, H, false);
  game.setRng(makeRandom(42));
  const a = game.scatterGems(2, area);
  game.setRng(makeRandom(42));
  const b = game.scatterGems(2, area);
  assert.deepStrictEqual(a, b);
});

/* ---------- 弹弓发射（原版 D） ---------- */

test('拖拽长度映射到速度：min(0.62, 0.0042 * 拖距)（px/ms）', () => {
  assert.strictEqual(game.dragSpeed(0), 0);
  assert.ok(Math.abs(game.dragSpeed(100) - 0.42) < 1e-9);
  assert.ok(Math.abs(game.dragSpeed(200) - 0.62) < 1e-9, '148px 即到 0.62');
  assert.strictEqual(game.dragSpeed(1000), game.LAUNCH_MAX, '超长拖拽被上限截断');
  assert.strictEqual(game.LAUNCH_K, 0.0042);
  assert.strictEqual(game.LAUNCH_MAX, 0.62);
});

test('发射：替换速度、扣 1 杆；球在滚动中允许补杆（原版如此）', () => {
  const state = newRun('play');
  const ball = state.ball;
  const before = { x: ball.x, y: ball.y };
  const shot = game.launchFromAim(state, { fired: true, angle: -Math.PI / 2, power: 0.5, dist: 120 });
  assert.ok(shot, '应该能发射');
  assert.strictEqual(state.shots, game.SHOTS_PER_ROOM - 1);
  assert.strictEqual(ball.moving, true);
  assert.ok(Math.abs(ball.vy + 0.5) < 1e-9, '向上发射 vy=-power');
  assert.strictEqual(ball.x, before.x);

  /* 滚动中补一杆：直接替换当前速度（原版 D 无静止限制） */
  ball.x += 40;
  const shot2 = game.launchFromAim(state, { fired: true, angle: 0, power: 0.3, dist: 80 });
  assert.ok(shot2, '滚动中补杆应该被允许');
  assert.ok(Math.abs(ball.vx - 0.3) < 1e-9, '速度被替换而非叠加');
  assert.strictEqual(state.shots, game.SHOTS_PER_ROOM - 2);
});

test('杆数为 0 或非玩法状态时不能发射', () => {
  const state = newRun('play');
  state.shots = 0;
  assert.strictEqual(game.launchFromAim(state, { fired: true, angle: 0, power: 0.3 }), null);
  const demo = newRun();
  assert.strictEqual(game.launchFromAim(demo, { fired: true, angle: 0, power: 0.3 }), null);
});

/* ---------- 原版物理 ---------- */

test('撞墙原速反弹（无恢复系数损耗），位置被夹回', () => {
  const state = newRun('play');
  const area = state.area;
  const ball = state.ball;
  ball.moving = true;
  ball.x = area.x + area.w - 20;
  ball.y = area.y + area.h / 2;
  ball.vx = 0.5;
  ball.vy = 0;
  const speedBefore = 0.5;
  game.frame(state, 16.7);
  assert.strictEqual(ball.x, area.x + area.w - game.BALL_R, '撞右墙后被夹回');
  assert.ok(Math.abs(Math.abs(ball.vx) - speedBefore * game.FRICTION_MAIN) < 1e-9, '速度只受摩擦影响，不受墙面损耗');
  assert.ok(ball.vx < 0, '反弹后向左');
});

test('摩擦逐帧相乘（原版缺陷）：60 帧后速度 = 初速 × 0.9975^60', () => {
  const state = newRun('play');
  const ball = state.ball;
  ball.moving = true;
  ball.vx = 0.4;
  ball.vy = 0;
  /* 把球摆在区域中央，避免撞墙干扰 */
  ball.x = state.area.x + state.area.w / 2;
  ball.y = state.area.y + state.area.h / 2;
  const expected = 0.4 * Math.pow(0.9975, 60);
  for (let i = 0; i < 60; i++) game.frame(state, 16.7);
  assert.ok(
    Math.abs(Math.abs(ball.vx) - expected) < 1e-6,
    '实际 ' + Math.abs(ball.vx).toFixed(6) + ' vs 期望 ' + expected.toFixed(6)
  );
});

test('演示模式没有摩擦：速度恒定（原版 l 分支不摩擦）', () => {
  const state = newRun(); /* demo */
  game.frame(state, 16.7);
  assert.strictEqual(state.ball.moving, true);
  assert.ok(Math.abs(state.ball.vx - game.DEMO_VX) < 1e-9);
  for (let i = 0; i < 30; i++) game.frame(state, 16.7);
  assert.ok(Math.abs(Math.abs(state.ball.vx) - game.DEMO_VX) < 1e-9, '30 帧后速度不变');
});

test('有杆数时主球速度托底 0.08：永不停，可一直补杆', () => {
  const state = newRun('play');
  const ball = state.ball;
  ball.moving = true;
  ball.x = state.area.x + state.area.w / 2;
  ball.y = state.area.y + state.area.h / 2;
  state.shots = 2;
  ball.vx = 0.05;
  ball.vy = 0;
  for (let i = 0; i < 40; i++) game.frame(state, 16.7);
  const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
  assert.ok(Math.abs(speed - game.SPEED_FLOOR) < 1e-6, '速度应被托底到 0.08，实际 ' + speed.toFixed(4));
  assert.strictEqual(ball.moving, true, '托底下球永不停');
});

test('杆尽滑停：速度 < 0.035 才算停；停后直接进下一殿（原版无重打）', () => {
  const state = newRun('play');
  const ball = state.ball;
  ball.moving = true;
  ball.x = state.area.x + state.area.w / 2;
  ball.y = state.area.y + state.area.h / 2;
  ball.vx = 0.05;
  ball.vy = 0;
  state.shots = 0;
  let guard = 0;
  while (state.room === 1 && guard++ < 2000) game.frame(state, 16.7);
  assert.ok(guard < 2000, '球应该会滑停并推进');
  assert.strictEqual(state.room, 2, '原版：杆尽后直接进下一殿，没有重打本殿');
  assert.strictEqual(state.shots, game.SHOTS_PER_ROOM, '新殿重置 4 杆');
  assert.strictEqual(state.gemList.length, game.gemsForRoom(2), '新殿按公式重撒宝石');
  assert.strictEqual(state.runGems, 0, 'runGems 按殿清零');
});

/* ---------- 连锁：宝石变球 ---------- */

test('宝石变球：继承 0.9×撞击速度（下限 0.18）、扇出 ±(0.6~1.1)、寿命 7000ms', () => {
  const state = newRun('play');
  const gem = { x: 100, y: 200, got: false, ph: 0 };
  game.collectGem(state, gem, 0.4, 0.3, false);
  assert.strictEqual(gem.got, true);
  assert.strictEqual(state.chains.length, 1);
  const chain = state.chains[0];
  const impact = Math.sqrt(0.4 * 0.4 + 0.3 * 0.3);
  const speed = Math.sqrt(chain.vx * chain.vx + chain.vy * chain.vy);
  assert.ok(Math.abs(speed - 0.9 * impact) < 1e-9, '速度继承 0.9×');
  const deflection = Math.abs(Math.atan2(chain.vy, chain.vx) - Math.atan2(0.3, 0.4));
  const minFan = 0.6;
  const maxFan = 0.6 + 0.5 + 1e-9;
  assert.ok(deflection >= minFan - 2 * Math.PI || (deflection >= minFan && deflection <= maxFan), '扇出应在 ±(0.6~1.1) rad');
  assert.strictEqual(chain.life, game.CHAIN_LIFE);
  assert.strictEqual(chain.life, 7000);
  assert.strictEqual(state.gems, 1, '累计宝石 +1');
  assert.strictEqual(state.runGems, 1, '本殿宝石 +1');
});

test('连锁球速度下限 0.18：轻轻一碰也变成会滚的球', () => {
  const state = newRun('play');
  const gem = { x: 100, y: 200, got: false, ph: 0 };
  game.collectGem(state, gem, 0.001, 0, false);
  const chain = state.chains[0];
  const speed = Math.sqrt(chain.vx * chain.vx + chain.vy * chain.vy);
  assert.ok(Math.abs(speed - game.CHAIN_MIN) < 1e-9, '速度应为下限 0.18');
});

test('连锁球并发上限 12：超出的宝石仍算收集，但不再变身', () => {
  const state = newRun('play');
  for (let i = 0; i < 20; i++) {
    game.collectGem(state, { x: 100 + i, y: 60, got: false, ph: 0 }, 0.5, 0.2, false);
  }
  assert.strictEqual(state.chains.length, game.CHAIN_CAP, '场上连锁球封顶 12');
  assert.strictEqual(game.CHAIN_CAP, 12);
  assert.strictEqual(state.gems, 20, '宝石收集不受上限影响');
});

test('连锁球之间、连锁球与主球之间均无碰撞（原版如此，重叠穿过）', () => {
  const state = newRun('play');
  state.chains = [
    { x: 100, y: 100, vx: 0.2, vy: 0, life: 7000 },
    { x: 101, y: 100, vx: 0.2, vy: 0, life: 7000 }
  ];
  state.ball.moving = true;
  state.ball.x = 102;
  state.ball.y = 100;
  state.ball.vx = 0;
  state.ball.vy = 0;
  const before = state.chains.map((c) => ({ x: c.x, y: c.y, vx: c.vx, vy: c.vy }));
  game.frame(state, 16.7);
  const expectedDx = 0.2 * 16.7;
  assert.ok(
    Math.abs(state.chains[0].x - before[0].x - expectedDx) < 1e-6,
    '连锁球按自身速度位移，不被弹开'
  );
  assert.ok(
    Math.abs(state.chains[1].x - before[1].x - expectedDx) < 1e-6,
    '另一颗连锁球同样不被弹开'
  );
  assert.ok(
    Math.abs(state.chains[0].vx - before[0].vx * game.FRICTION_CHAIN) < 1e-9,
    '速度只受逐帧摩擦影响，不因重叠而产生碰撞冲量'
  );
});

test('连锁球寿命 7000ms 或速度 ≤0.03 即消散', () => {
  const state = newRun('play');
  state.chains = [{ x: 150, y: 150, vx: 0.2, vy: 0, life: 7000 }];
  let guard = 0;
  while (state.chains.length && guard++ < 1000) game.frame(state, 16.7);
  assert.ok(guard < 1000, '连锁球应该消散');
  /* 消散耗时 ≈ 7000ms（每帧 16.7ms 递减） */
  assert.ok(guard > 380 && guard < 460, '寿命应接近 7000ms（实际 ' + guard * 16.7 + 'ms）');

  const slow = newRun('play');
  slow.chains = [{ x: 150, y: 150, vx: 0.02, vy: 0, life: 7000 }];
  game.frame(slow, 16.7);
  assert.strictEqual(slow.chains.length, 0, '速度 ≤0.03 立即消散');
});

test('主球收宝石判定距离 24 / 连锁球 20（原版值）', () => {
  assert.strictEqual(game.PICKUP_MAIN, 24);
  assert.strictEqual(game.PICKUP_CHAIN, 20);
  const state = newRun('play');
  const ball = state.ball;
  ball.moving = true;
  ball.vx = 0.2;
  ball.vy = 0;
  ball.x = state.area.x + 60;
  ball.y = state.area.y + 60;
  /* 前方 20px：第一帧内即进入 24 判定圈 */
  state.gemList = [
    { x: ball.x + 20, y: ball.y, got: false, ph: 0 },
    { x: ball.x + 20, y: ball.y + 50, got: false, ph: 0 }
  ];
  game.frame(state, 16.7);
  assert.strictEqual(state.gemList[0].got, true, '20px 内的宝石被主球收走');
  assert.strictEqual(state.gemList[1].got, false, '50px 外的宝石不收');
});

/* ---------- 殿堂推进（原版语义） ---------- */

test('收齐宝石立即进下一殿（不等球停，原版如此）', () => {
  const state = newRun('play');
  const ball = state.ball;
  ball.moving = true;
  ball.vx = 0.3;
  ball.vy = 0;
  /* 留一颗宝石摆在球马上会经过的位置，其余标记已收 */
  state.gemList = [{ x: ball.x + 10, y: ball.y, got: false, ph: 0 }];
  for (let i = 0; i < 5; i++) {
    state.gemList.push({ x: ball.x + 30 + i * 40, y: ball.y + 80, got: true, ph: 0 });
  }
  state.gems = 5;
  state.runGems = 5;
  game.frame(state, 16.7);
  assert.strictEqual(state.room, 2, '收齐即推进');
  assert.strictEqual(state.shots, 4);
  assert.strictEqual(state.gemList.length, 7);
  assert.strictEqual(state.ball.x, state.area.x + state.area.w / 2, '主球回到新殿起点');
  assert.ok(Math.abs(state.ball.y - (state.area.y + state.area.h - 40)) < 1e-9, '起点 y = 区域下沿 - 40');
  assert.strictEqual(state.ball.moving, false, '新殿主球静止等待发射');
});

test('第 8 殿收齐 → 整局结束（finished），切回演示模式', () => {
  const state = newRun('play');
  state.room = 8;
  const ball = state.ball;
  ball.moving = true;
  ball.vx = 0.3;
  ball.vy = 0;
  state.gemList = [{ x: ball.x + 10, y: ball.y, got: false, ph: 0 }];
  game.frame(state, 16.7);
  assert.strictEqual(state.finished, true, '第 8 殿结束应整局结束');
  assert.strictEqual(state.mode, 'demo', '结算背后是演示模式');
  const events = game.takeEvents(state);
  assert.ok(events.some((e) => e.t === 'finish'), '应有 finish 事件');
});

test('bestRun / bestPath：记录单殿最多宝石与该殿路径（原版字段语义）', () => {
  const state = newRun('play');
  state.pathRecord = [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }, { x: 0.5, y: 0.6 }];
  state.runGems = 4;
  game.endRoom(state);
  assert.strictEqual(state.bestRun, 4);
  assert.strictEqual(state.bestPath.length, 3, 'bestPath 是最佳单殿的路径');
  assert.strictEqual(state.runGems, 0);
  assert.strictEqual(state.gems, 0, 'endRoom 不清累计宝石');
  /* 更差的一殿不应覆盖 bestRun */
  state.runGems = 1;
  state.pathRecord = [{ x: 0.9, y: 0.9 }];
  game.endRoom(state);
  assert.strictEqual(state.bestRun, 4);
  assert.strictEqual(state.bestPath.length, 3);
});

test('原版统计字段：{room, shots, gems, bestRun, runGems}', () => {
  const state = newRun('play');
  assert.strictEqual(state.room, 1);
  assert.strictEqual(state.shots, 4);
  assert.strictEqual(state.gems, 0);
  assert.strictEqual(state.bestRun, 0);
  assert.strictEqual(state.runGems, 0);
});

/* ---------- 演示模式（封面/结算背后） ---------- */

test('演示模式：玉球自动匀速滚动，静默收宝石，收齐自动重撒', () => {
  const state = newRun(); /* demo */
  assert.strictEqual(state.mode, 'demo');
  assert.strictEqual(state.area.y, H * 0.07, '演示区域上沿 = 0.07H');
  game.frame(state, 16.7);
  assert.strictEqual(state.ball.moving, true);
  assert.ok(Math.abs(state.ball.vx - 0.26) < 1e-9);
  assert.ok(Math.abs(state.ball.vy + 0.2) < 1e-9);
  /* 收宝石不计数、不变身 */
  const gem = state.gemList[0];
  gem.x = state.ball.x + 5;
  gem.y = state.ball.y;
  game.frame(state, 16.7);
  assert.strictEqual(gem.got, true, '演示也会收走宝石');
  assert.strictEqual(state.gems, 0, '演示不累计宝石');
  assert.strictEqual(state.chains.length, 0, '演示不变身连锁球');
  /* 收齐重撒 */
  for (const g of state.gemList) g.got = true;
  game.frame(state, 16.7);
  assert.ok(state.gemList.some((g) => !g.got), '收齐后应重新撒宝石');
});

/* ---------- 粒子 / 球迹 ---------- */

test('每颗宝石收集产生 14 粒金色粒子，封顶 200', () => {
  const state = newRun('play');
  for (let i = 0; i < 20; i++) {
    game.collectGem(state, { x: 100 + i, y: 60, got: false, ph: 0 }, 0.5, 0.2, false);
  }
  assert.strictEqual(state.particles.length, game.PARTICLE_CAP, '粒子应封顶 200');
  assert.strictEqual(game.PARTICLE_COUNT, 14);
  assert.strictEqual(game.PARTICLE_CAP, 200);
  for (const p of state.particles) {
    assert.strictEqual(p.hue, 44, '原版粒子色相 44（金）');
  }
});

test('球迹逐帧衰减（0.0022/ms），封顶 120', () => {
  const state = newRun('play');
  assert.strictEqual(game.TRAIL_CAP, 120);
  const ball = state.ball;
  ball.moving = true;
  ball.vx = 0.3;
  ball.vy = 0;
  ball.x = state.area.x + state.area.w / 2;
  ball.y = state.area.y + state.area.h / 2;
  game.frame(state, 16.7);
  assert.ok(state.trail.length >= 1, '滚动时应有球迹');
  const first = state.trail[0];
  for (let i = 0; i < 40; i++) game.frame(state, 16.7);
  assert.ok(first.life < 0.8, '球迹寿命应衰减');
});

/* ---------- 事件与快进 ---------- */

test('takeEvents 吐出 gem / bounce / room 事件并清空队列', () => {
  const state = newRun('play');
  const ball = state.ball;
  ball.moving = true;
  ball.vx = 0.6;
  ball.vy = 0;
  ball.x = state.area.x + state.area.w - 16;
  ball.y = state.area.y + state.area.h / 2;
  state.gemList = [{ x: ball.x + 15, y: ball.y, got: false, ph: 0 }];
  game.frame(state, 16.7);
  const events = game.takeEvents(state);
  assert.ok(events.some((e) => e.t === 'gem'), '应有 gem 事件');
  assert.ok(events.some((e) => e.t === 'bounce'), '应有 bounce 事件');
  assert.strictEqual(game.takeEvents(state).length, 0, '取过即清空');
});

test('fastForward + 随机补杆能在有限仿真内跑完整局（QA 钩子，不改玩法语义）', () => {
  const state = newRun('play');
  let guard = 0;
  while (!state.finished && guard++ < 40000) {
    /* 原版语义：有剩余杆数时主球永不停，所以驱动器必须周期性补杆；
       补满 4 杆后球才会滑停并推进下一殿。 */
    if (state.shots > 0 && (!state.ball.moving || guard % 300 === 0)) {
      game.launchFromAim(state, { fired: true, angle: (guard % 628) / 100, power: 0.5, dist: 120 });
    }
    game.frame(state, 16.7);
  }
  assert.ok(state.finished, '仿真内应能跑完 8 殿（推进到第 ' + state.room + ' 殿）');
  assert.ok(state.gems <= 70, '累计宝石不得超过八殿总和 70');
});

/* ---------- 输入 bug 修复回归（必须永远通过） ----------
 * 用户真机报障「还没松手就发射」。以下行为是修复，不是玩法改动：
 * 快速点按不发射 / pointercancel 中止 / pointerId 归属 / 最小拖拽 / 最短按住。 */

function simInput() {
  return game.createAimInput({ minDrag: game.AIM_MIN_DRAG, minHoldMs: game.AIM_MIN_HOLD_MS });
}

test('按住拖动 500ms 再松手：只在松手那一刻发射一次', () => {
  const input = simInput();
  const ball = { x: 120, y: 286 };
  assert.ok(input.down(7, ball.x + 30, ball.y, ball.x, ball.y, 1000), '按下应该开始瞄准');
  assert.strictEqual(input.isActive(), true);
  for (let t = 1100; t <= 1400; t += 50) {
    input.move(7, ball.x + 30 + (t - 1000) * 0.08, ball.y - 10, ball.x, ball.y);
    assert.strictEqual(input.isActive(), true, '拖动中瞄准必须持续');
  }
  const mid = input.getAim();
  assert.ok(mid.power > 0, '拖动中应该有力度');
  const result = input.up(7, 1500);
  assert.strictEqual(result.fired, true, '松手必须发射');
  assert.ok(result.power > 0 && result.power <= game.LAUNCH_MAX, '力度必须在范围内');
  const again = input.up(7, 1600);
  assert.strictEqual(again.fired, false, '重复松手不能二次发射');
  assert.strictEqual(input.isActive(), false);
});

test('拖动过程中绝不发射：发射判定只存在于 up', () => {
  const input = simInput();
  const ball = { x: 120, y: 286 };
  input.down(3, ball.x + 20, ball.y, ball.x, ball.y, 0);
  let firedDuringMove = false;
  for (let i = 1; i <= 30; i++) {
    input.move(3, ball.x + 20 + i * 4, ball.y, ball.x, ball.y);
    const aim = input.getAim();
    if (!aim.active) firedDuringMove = true;
  }
  assert.strictEqual(firedDuringMove, false, '移动中瞄准不能被打断');
  const result = input.up(3, 500);
  assert.strictEqual(result.fired, true);
});

test('快速点按（<80ms）不发射（「还没松手就发射」回归）', () => {
  const input = simInput();
  const ball = { x: 120, y: 286 };
  input.down(5, ball.x + 90, ball.y - 40, ball.x, ball.y, 2000);
  const result = input.up(5, 2000 + game.AIM_MIN_HOLD_MS - 1);
  assert.strictEqual(result.fired, false, '快速点按绝不能发射');
  assert.strictEqual(input.isActive(), false);
});

test('pointercancel 中止瞄准且绝不发射', () => {
  const input = simInput();
  const ball = { x: 120, y: 286 };
  input.down(9, ball.x + 40, ball.y, ball.x, ball.y, 1000);
  input.move(9, ball.x + 80, ball.y - 20, ball.x, ball.y);
  assert.strictEqual(input.cancel(9), true, 'cancel 应该中止瞄准');
  assert.strictEqual(input.isActive(), false);
  const result = input.up(9, 2000);
  assert.strictEqual(result.fired, false, '被系统中止的手势不能发射');
});

test('第二根手指不影响瞄准与发射（pointerId 归属）', () => {
  const input = simInput();
  const ball = { x: 120, y: 286 };
  assert.ok(input.down(1, ball.x + 30, ball.y, ball.x, ball.y, 1000), '第一根手指开始瞄准');
  assert.strictEqual(input.down(2, ball.x - 50, ball.y, ball.x, ball.y, 1050), false, '第二根手指不能接管');
  assert.strictEqual(input.move(2, ball.x - 90, ball.y, ball.x, ball.y), false, '第二根手指不能移动瞄准');
  const stolen = input.up(2, 1600);
  assert.strictEqual(stolen.fired, false, '第二根手指抬起不能发射');
  assert.strictEqual(input.isActive(), true, '第一根手指的瞄准必须还在');
  const result = input.up(1, 1700);
  assert.strictEqual(result.fired, true, '第一根手指松手才发射');
  assert.ok(Math.abs(result.angle - Math.PI) < 0.01, '弹弓方向应该指向指尖的反方向');
});

test('弹弓方向：向后拖，球朝反方向飞', () => {
  const input = simInput();
  const ball = { x: 120, y: 286 };
  input.down(4, ball.x + 40, ball.y + 30, ball.x, ball.y, 0);
  const result = input.up(4, 300);
  assert.strictEqual(result.fired, true);
  const expected = Math.atan2(ball.y - (ball.y + 30), ball.x - (ball.x + 40));
  assert.ok(Math.abs(result.angle - expected) < 0.001, '发射方向 = 球心 - 指尖');
  assert.ok(result.angle < 0, '右下拖应该朝左上（负角度）飞');
});

test('拖拽距离不足（误触）不发射：阈值 14px（保留的修复值，原版 18）', () => {
  assert.strictEqual(game.AIM_MIN_DRAG, 14);
  const input = simInput();
  const ball = { x: 120, y: 286 };
  input.down(6, ball.x + 8, ball.y, ball.x, ball.y, 1000);
  input.move(6, ball.x + 10, ball.y + 2, ball.x, ball.y);
  const result = input.up(6, 2000);
  assert.strictEqual(result.fired, false, '误触不能发射');
});

test('reset 清掉全部瞄准状态', () => {
  const input = simInput();
  const ball = { x: 120, y: 286 };
  input.down(1, ball.x + 30, ball.y, ball.x, ball.y, 0);
  input.reset();
  assert.strictEqual(input.isActive(), false);
  const result = input.up(1, 500);
  assert.strictEqual(result.fired, false);
});
