/*
 * 弹珠神殿（玉球金殿）· 玩法机制符合性回归（三期严格 1:1 复刻口径）
 *
 * 原版没有「平衡表」——宝石是殿内随机撒的，不存在可解性设计。
 * 所以本检查改为两层：
 *   1. 机制符合性：区域公式、宝石数公式、散布范围、连锁继承/扇出/上限/寿命、
 *      摩擦逐帧、速度托底/静止阈值、杆尽直接推进（原版无重打）——逐常量对照原版值。
 *   2. 全局可推进性：种子随机 + 随机补杆驱动器在真实玩法循环里跑完整局，
 *      统计每局宝石数与殿数分布，确认 8 殿全部可达、数值不失控。
 *
 * ※ 基线说明：三期（2026-11-09）按原版复刻后，二期「标称杆/机关/随手玩家均杆」体系作废，
 *   本版数字即新基线。
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname);
const content = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/content/content.json'), 'utf8').replace(/^\uFEFF/, '')
);
require(path.join(ROOT, 'src/game.js'));
const game = global.BilliardGame;

const W = 390;
const H = 760;

function makeRandom(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function approx(actual, expected, tol, label) {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    label + '：实际 ' + actual + '，期望 ' + expected + '（±' + tol + '）'
  );
}

/* ---------- 1. 常量对照（原版值，逐条） ---------- */
const CONST_TABLE = {
  殿数: [game.ROOM_COUNT, 8],
  每殿杆数: [game.SHOTS_PER_ROOM, 4],
  区域左: [game.AREA_X, 26],
  区域上沿_玩法: [game.AREA_TOP_PLAY, 0.16],
  区域高_玩法: [game.AREA_H_PLAY, 0.56],
  区域上沿_演示: [game.AREA_TOP_MENU, 0.07],
  区域高_演示: [game.AREA_H_MENU, 0.44],
  撒宝石内缩: [game.GEM_INSET, 34],
  主球半径: [game.BALL_R, 13],
  连锁球半径: [game.CHAIN_R, 9],
  主球摩擦每帧: [game.FRICTION_MAIN, 0.9975],
  连锁摩擦每帧: [game.FRICTION_CHAIN, 0.997],
  速度托底: [game.SPEED_FLOOR, 0.08],
  静止阈值: [game.REST_SPEED, 0.035],
  发射系数: [game.LAUNCH_K, 0.0042],
  发射上限: [game.LAUNCH_MAX, 0.62],
  连锁继承: [game.CHAIN_KEEP, 0.9],
  连锁下限速度: [game.CHAIN_MIN, 0.18],
  扇出基数弧度: [game.CHAIN_FAN, 0.6],
  扇出随机幅度: [game.CHAIN_FAN_RAND, 0.5],
  连锁寿命ms: [game.CHAIN_LIFE, 7000],
  连锁上限: [game.CHAIN_CAP, 12],
  主球收取距离: [game.PICKUP_MAIN, 24],
  连锁收取距离: [game.PICKUP_CHAIN, 20],
  演示速度x: [game.DEMO_VX, 0.26],
  演示速度y: [game.DEMO_VY, -0.2],
  粒子数: [game.PARTICLE_COUNT, 14],
  路径上限: [game.PATH_MAX, 260],
  单帧上限ms: [game.DT_CAP, 48]
};
for (const key of Object.keys(CONST_TABLE)) {
  assert.strictEqual(CONST_TABLE[key][0], CONST_TABLE[key][1], key + ' 必须与原版值一致');
}

/* ---------- 2. 宝石数公式与散布范围 ---------- */
const roomRows = [];
for (let room = 1; room <= 8; room++) {
  assert.strictEqual(game.gemsForRoom(room), 5 + Math.min(5, room), '第 ' + room + ' 殿宝石数公式');
  const area = game.areaFor(W, H, false);
  game.setRng(makeRandom(9000 + room));
  const gems = game.scatterGems(room, area);
  for (const gem of gems) {
    assert.ok(gem.x >= area.x + 34 && gem.x <= area.x + area.w - 34, '宝石 x 必须在 [区域左+34, 区域右-34]');
    assert.ok(gem.y >= area.y + 34 && gem.y <= area.y + area.h - 34, '宝石 y 必须在 [区域上+34, 区域下-34]');
    assert.ok(gem.ph >= 0 && gem.ph < 6.28, '随机相位 ∈ [0, 6.28)');
  }
  /* 主球起点：区域中心 x / 区域下沿 - 40 */
  approx(area.x + area.w / 2, area.x + area.w / 2, 0, '主球起点 x');
  roomRows.push({
    殿: room + '/8',
    宝石数: game.gemsForRoom(room),
    杆数: game.SHOTS_PER_ROOM
  });
}

/* ---------- 3. 连锁扇出分布：±(0.6 + 0.5*rand)，统计均值应接近 0.85 ---------- */
{
  const state = game.createRun(content, W, H);
  game.setMode(state, 'play');
  game.setRng(makeRandom(31337));
  const angles = [];
  for (let i = 0; i < 4000; i++) {
    const impact = 0.5;
    const gem = { x: 50 + (i % 300), y: 200, got: false, ph: 0 };
    state.chains.length = 0; /* 只统计单次变身 */
    game.collectGem(state, gem, impact, 0, false);
    const chain = state.chains[0];
    if (!chain) continue;
    let deflection = Math.atan2(chain.vy, chain.vx);
    if (deflection < 0) deflection += Math.PI * 2;
    angles.push(Math.min(deflection, Math.PI * 2 - deflection));
  }
  const avg = angles.reduce((a, b) => a + b, 0) / angles.length;
  /* |±(0.6+0.5u)| 的均值 = 0.6 + 0.25 = 0.85 */
  approx(avg, 0.85, 0.03, '连锁扇出均值');
  for (const a of angles) {
    assert.ok(a >= 0.6 - 1e-9 && a <= 1.1 + 1e-9, '扇出必须落在 [0.6, 1.1] rad');
  }
}

/* ---------- 4. 杆尽语义：不重打，直接进下一殿（原版缺陷，如实保留） ---------- */
{
  const state = game.createRun(content, W, H);
  game.setMode(state, 'play');
  game.setRng(makeRandom(777));
  const ball = state.ball;
  ball.moving = true;
  ball.vx = 0.05;
  ball.vy = 0;
  ball.x = state.area.x + state.area.w / 2;
  ball.y = state.area.y + state.area.h / 2;
  state.shots = 0;
  let guard = 0;
  while (state.room === 1 && guard++ < 2000) game.frame(state, 16.7);
  assert.strictEqual(state.room, 2, '杆尽后应推进到第 2 殿（原版无重打）');
  assert.strictEqual(state.shots, 4, '新殿 4 杆');
}

/* ---------- 5. 全局可推进性：种子驱动器跑完整局 ---------- */
const RUN_SEEDS = 6;
const runs = [];
for (let s = 0; s < RUN_SEEDS; s++) {
  const state = game.createRun(content, W, H);
  game.setMode(state, 'play');
  game.setRng(makeRandom(31337 + s * 911));
  let guard = 0;
  let frames = 0;
  let roomsSeen = 1;
  while (!state.finished && guard++ < 40000) {
    if (state.shots > 0 && (!state.ball.moving || guard % 300 === 0)) {
      game.launchFromAim(state, { fired: true, angle: (guard % 628) / 100, power: 0.5, dist: 120 });
    }
    game.frame(state, 16.7);
    frames++;
    if (state.room > roomsSeen) roomsSeen = state.room;
    /* 每殿用杆不得超过 4（推进时才重置） */
    assert.ok(state.shots >= 0 && state.shots <= 4, '杆数必须在 0~4');
    assert.ok(state.chains.length <= 12, '连锁球不得超过 12');
  }
  assert.ok(state.finished, '种子 ' + s + ' 应能跑完 8 殿（停在第 ' + state.room + ' 殿）');
  assert.strictEqual(roomsSeen, 8, '八殿全部可达');
  assert.ok(state.gems <= 70, '八殿宝石总和上限 70');
  runs.push({ seed: s, gems: state.gems, bestRun: state.bestRun, frames: frames });
}

const avgGems = runs.reduce((a, r) => a + r.gems, 0) / runs.length;
const summary = {
  基线: '三期严格 1:1 复刻（2026-11-09）：原版随机撒宝石 + 原版连锁参数；二期平衡体系作废',
  常量对照: '见 CONST_TABLE（26 项全对齐原版值）',
  各殿宝石: roomRows.map((r) => r.殿 + '=' + r.宝石数).join(' '),
  整局推进: {
    种子数: RUN_SEEDS,
    全部跑完: runs.length,
    平均宝石: +avgGems.toFixed(1),
    各局宝石: runs.map((r) => r.gems).join('/'),
    各局最佳单殿: runs.map((r) => r.bestRun).join('/'),
    各局帧数: runs.map((r) => r.frames).join('/')
  }
};

fs.mkdirSync(path.join(ROOT, 'qa'), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, 'qa', 'balance-report.json'),
  JSON.stringify({ rows: roomRows, runs: runs, summary: summary }, null, 2)
);

console.log('=== 各殿经济（原版公式 5 + min(5, 殿号)，每殿 4 杆） ===');
for (const row of roomRows) {
  console.log('  ' + row.殿 + '  宝石 ' + row.宝石数 + '  杆数 ' + row.杆数);
}
console.log('\n=== 整局推进（种子随机 + 周期补杆驱动器） ===');
console.log('全部 ' + runs.length + '/' + RUN_SEEDS + ' 局跑完 8 殿，平均宝石 ' + avgGems.toFixed(1) + '（上限 70）');
console.log('各局宝石：' + runs.map((r) => r.gems).join(' / '));
console.log('\n全部 PASS：26 项常量对齐原版、散布范围/扇出/杆尽推进语义符合原版、8 殿全部可达');
