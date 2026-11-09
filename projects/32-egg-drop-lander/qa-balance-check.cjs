/*
 * 蛋落地 · 平衡回归（四期：严格 1:1 复刻 eazo 原版）
 *
 * 全部断言按 eazo 原版数值如实设定（reference/eazo-spec.txt），不为让断言
 * 通过而修改任何原版参数：
 *   1. 关卡表 12 行与原版逐字段一致（含 impulse 190/…/250、gapHalf .2/.17/.15，
 *      且不允许残留 gScale / 缩放字段）；
 *   2. 不动手必碎（12 关自由落体末速全部超过限速）；
 *   3. 一直乱点必碎（原版冲量大，狂点 = 把自己弹上高空再摔死）；
 *   4. 闭环玩家（承诺式刹车，纯竖直点按）通过率回归：
 *      前段关 1–3 ≥ 16/20、关 4 ≥ 12/20、关 5 ≥ 8/20（实测 20/15/10，留回归余量）；
 *   5. 原版缺陷锁定：末四关（9–12）在原版参数下随手 / 熟练模型全部 0 通过 ——
 *      脉冲预算 < 自由落体末速，数学上不可通关。这是复刻的正确结果，
 *      断言其保持 0，防止未来误改参数“救平衡”；
 *   6. 整轮 run（随手口径）：末关通过 = 0、平均幸存 ≤ 6（实测 4.5）；
 *   7. 手感与物理：反推 0 延迟（点下当帧 vy 变化恰为 -冲量）、
 *      初始 vx = 0.15 × wind（原值）、四档评级边界（0.4 / 0.75 / 限速）、
 *      缺口几何（中心 (gapCenter−.5)×520、通行半宽 2×gapHalf×260）。
 *
 * 旧基线说明：三期“求解器重算冲量 + 重力/风缩放”的平衡基线随四期复刻作废，
 * 本文件按原版数值重写，为 1:1 复刻的平衡基线生成器（qa/balance-report.json）。
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname);
const sim = require(path.join(ROOT, 'tools/level-sim.cjs'));
const game = sim.game;
const content = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/content/content.json'), 'utf8').replace(/^\uFEFF/, '')
);

/* —— eazo 原版关卡表锁定（总控下发，玩法的身份基准） —— */
const TABLE = [
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

assert.strictEqual(content.levels.length, 12, '关卡数应为 12');
for (let i = 0; i < TABLE.length; i++) {
  const t = TABLE[i];
  const lv = content.levels[i];
  for (const key of ['name', 'zhName', 'height', 'gravity', 'wind', 'pulses', 'impulse', 'maxSpeed']) {
    assert.strictEqual(lv[key], t[key], '关卡 ' + (i + 1) + ' 的 ' + key + ' 与原版表不符');
  }
  assert.strictEqual(lv.gravity, game.gravityOf(lv), '关卡 ' + (i + 1) + '：gravity 必须原值使用，不得缩放');
  assert.strictEqual(lv.wind || 0, game.windOf(lv), '关卡 ' + (i + 1) + '：wind 必须原值使用，不得缩放');
  assert.ok(!('gScale' in lv), '关卡 ' + (i + 1) + ' 不应保留 gScale 缩放字段');
  if (t.obstacle) {
    assert(lv.obstacle, '关卡 ' + (i + 1) + ' 缺少障碍带');
    assert.strictEqual(lv.obstacle.atY, t.obstacle.atY, '关卡 ' + (i + 1) + ' 障碍带 atY 与原版表不符');
    assert.strictEqual(lv.obstacle.gapCenter, t.obstacle.gapCenter, '关卡 ' + (i + 1) + ' 缺口位置与原版表不符');
    assert.strictEqual(lv.obstacle.gapHalf, t.obstacle.gapHalf, '关卡 ' + (i + 1) + ' 缺口半宽与原版表不符（原值 .2/.17/.15）');
  } else {
    assert(!lv.obstacle, '关卡 ' + (i + 1) + ' 不应有障碍带');
  }
}

/* —— 逐关复算 —— */
/* 通过率回归下限：按原版参数实测（20/20/20/15/10/0/5/0/0/0/0/0）留余量锁定 */
const EARLY_FLOOR = 16;   /* 关 1–3 实测 20/20 */
const MID_FLOOR = 12;     /* 关 4 实测 15 */
const LATE_FLOOR = 8;     /* 关 5 实测 10 */
/* 原版缺陷锁：末四关（9–12）原版参数下不可通关，必须保持 0 */
const DEFECT_FROM = 8;    /* 从索引 8（第 9 关 峡谷）起 */

const rows = [];
for (let i = 0; i < content.levels.length; i++) {
  const level = content.levels[i];
  const idle = sim.idleDrop(level);
  assert(!idle.ok, level.zhName + '：不动手也能幸存（落速 ' + idle.speed.toFixed(0) + ' ≤ 限速），这一关没有挑战');

  const spam = sim.spamDrop(level);
  assert(!spam.ok, level.zhName + '：一直乱点也能幸存，「一直点」变成了最优解');

  const casual = sim.casualScore(level);
  const pro = sim.proScore(level);

  rows.push({
    关卡: level.zhName,
    高度: level.height,
    重力: game.gravityOf(level),
    风: game.windOf(level),
    脉冲数: level.pulses,
    冲量: level.impulse,
    限速: level.maxSpeed,
    不喷气落速: Math.round(idle.speed),
    随手通过: casual.pass + '/' + casual.total,
    熟练通过: pro.pass + '/' + pro.total,
    障碍带: level.obstacle ? '有' : '无'
  });

  if (i < 3) {
    assert(casual.pass >= EARLY_FLOOR,
      rows[i].关卡 + '：随手玩家只过 ' + casual.pass + '/20（要求 ≥ ' + EARLY_FLOOR + '/20），开局就劝退');
  } else if (i === 3) {
    assert(casual.pass >= MID_FLOOR,
      rows[i].关卡 + '：随手玩家只过 ' + casual.pass + '/20（要求 ≥ ' + MID_FLOOR + '/20）');
  } else if (i === 4) {
    assert(casual.pass >= LATE_FLOOR,
      rows[i].关卡 + '：随手玩家只过 ' + casual.pass + '/20（要求 ≥ ' + LATE_FLOOR + '/20）');
  }
  if (i >= DEFECT_FROM) {
    assert.strictEqual(casual.pass, 0,
      rows[i].关卡 + '：原版参数下末段关应不可通关（随手 0/20），若 >0 说明有人改了原版数值');
    assert.strictEqual(pro.pass, 0,
      rows[i].关卡 + '：原版参数下末段关应不可通关（熟练 0/6），若 >0 说明有人改了原版数值');
  }
}

/* —— 整轮 run（随手口径） —— */
const run = sim.runCasual(content);
assert.strictEqual(run.finalPass, 0,
  '末关通过率应为 0/20（原版缺陷：末关不可通关），实际 ' + run.finalPass + '/20');
assert(
  run.meanSurvived <= 6,
  '整轮平均幸存 ' + run.meanSurvived.toFixed(2) + ' 落，超过 6 落说明参数被改动过（原版实测 4.5 落）'
);

/* —— 手感与物理 —— */
for (const level of content.levels) {
  const tap = sim.tapResponse(level);
  assert.strictEqual(tap.type, 'pulse', level.zhName + '：点按没有生效');
  assert(
    Math.abs(tap.sameFrameDelta + level.impulse) < 0.001,
    level.zhName + '：点下当帧速度变化应恰好等于 -冲量（实际 ' + tap.sameFrameDelta.toFixed(1) + '）'
  );
  const state = game.initDropState(level);
  assert(
    Math.abs(state.egg.vx - game.windOf(level) * 0.15) < 0.001,
    level.zhName + '：初始水平速度应为 0.15 × wind 原值'
  );
}

/* —— 评级边界（原版 0.4 / 0.75 / 限速） —— */
assert.strictEqual(game.gradeOf(40, 100), 'perfect');
assert.strictEqual(game.gradeOf(40.1, 100), 'safe');
assert.strictEqual(game.gradeOf(41, 100), 'safe');
assert.strictEqual(game.gradeOf(75, 100), 'safe');
assert.strictEqual(game.gradeOf(76, 100), 'cracked');
assert.strictEqual(game.gradeOf(100, 100), 'cracked');
assert.strictEqual(game.gradeOf(100.1, 100), 'broken');

/* —— 障碍带几何（原版判定式） —— */
assert.strictEqual(game.gapCenterX(content.levels[5]).toFixed(1), (-41.6).toFixed(1), '峡沟缺口中心');
assert.ok(Math.abs(game.gapPassHalf(content.levels[5]) - 104) < 1e-6, '峡沟通行半宽 2×0.2×260');
assert.ok(Math.abs(game.gapCenterX(content.levels[8]) - 52) < 1e-6, '峡谷缺口中心 (0.6−.5)×520');
assert.ok(Math.abs(game.gapPassHalf(content.levels[8]) - 88.4) < 1e-6, '峡谷通行半宽 2×0.17×260');
assert.strictEqual(game.gapCenterX(content.levels[11]).toFixed(1), '0.0', '尖峰缺口中心');
assert.ok(Math.abs(game.gapPassHalf(content.levels[11]) - 78) < 1e-6, '尖峰通行半宽 2×0.15×260');

/* —— 原版缺陷的数学注脚：末四关脉冲预算不足以清零落速 —— */
for (let i = 8; i < 12; i++) {
  const lv = content.levels[i];
  const idleSpeed = Math.sqrt(2 * game.gravityOf(lv) * lv.height);
  const residual = idleSpeed - lv.pulses * lv.impulse;
  assert(
    residual > 0,
    lv.zhName + '：自由落体末速 ' + idleSpeed.toFixed(0) + ' − 脉冲预算 ' + (lv.pulses * lv.impulse) +
      ' 应为正（原版缺陷，不可修复）'
  );
}

/* —— 落盘数值表 —— */
fs.mkdirSync(path.join(ROOT, 'qa'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'qa', 'balance-report.json'), JSON.stringify(rows, null, 2));
console.log(JSON.stringify(rows, null, 2));

console.log(
  '原版参数回归 PASS：不动手必碎、乱点必碎；随手通过 ' +
    rows.map(function (r) { return r['随手通过'].split('/')[0]; }).join('/') +
    '（末四关按原版缺陷锁定 0 通过）'
);
console.log(
  '整轮 run（随手口径）：平均幸存 ' + run.meanSurvived.toFixed(2) + '/12' +
    '（最差 ' + run.minSurvived + '），末关通过 ' + run.finalPass + '/20' +
    '，末关平均反推用量 ' + run.finalMeanUsed.toFixed(2) + '/' + content.levels[11].pulses + ' 发'
);
console.log('说明：原版末段关卡（9–12）数学上不可通关，本文件按原版数值如实锁定该缺陷。');
