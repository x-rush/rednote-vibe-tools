/*
 * 蛋落地 · 手感平衡回归
 *
 * 用与游戏一致的时间步长模拟每一关的降落，量四件事：
 *  1. 完全不喷气的落地速度 —— 必须明显超过安全线，否则玩家什么都不用做；
 *  2. 「像真人一样」能不能过这一关 —— 用闭环玩家模型评估：
 *     玩家每隔 R 毫秒看一次速度指示，速度超阈值就点一下喷气。
 *     这比固定阈值策略更接近真人：玩家会观察、会等、也会因为太急而浪费气量。
 *  3. 最少要喷几次气 —— 至少两次，否则「轻轻放」没有节奏；
 *  4. 一直乱喷气必须过不去 —— 否则「一直点」就是最优解。
 *
 * 通过率必须逐关收紧（真人比模型更笨），但不能归零。
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname);
const content = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/content/content.json'), 'utf8').replace(/^\uFEFF/, '')
);

const VIEW_HEIGHT = 420;
const EGG_RADIUS = 11;
const SPAWN_Y = 34;
const STEP = 1 / 240;

/* 闭环玩家：每 R 毫秒观察一次，下坠速度超过阈值就点一下喷气 */
function play(level, R, T) {
  let y = SPAWN_Y;
  let vy = 0;
  let t = 0;
  let next = R / 1000;
  let gas = level.gas;
  let thrusts = 0;
  while (t < 20) {
    if (t >= next) {
      next += R / 1000;
      if (vy >= T && gas > 0) {
        vy -= level.thrust;
        gas--;
        thrusts++;
      }
    }
    vy += level.gravity * STEP;
    vy -= vy * level.drag * STEP;
    y += vy * STEP;
    t += STEP;
    if (vy > 0 && y + EGG_RADIUS >= level.padY && y - EGG_RADIUS < level.padY) {
      return { impact: vy, thrusts: thrusts, gas: gas, ok: vy <= level.safe, landed: true, time: t };
    }
    if (y - EGG_RADIUS > VIEW_HEIGHT) {
      return { impact: null, thrusts: thrusts, gas: gas, ok: false, landed: false, time: t };
    }
  }
  return { impact: null, thrusts: thrusts, gas: gas, ok: false, landed: false, time: t };
}

/* 不喷气时的降落，用来确认这一关必须有动作 */
function idleDrop(level) {
  let y = SPAWN_Y;
  let vy = 0;
  let t = 0;
  while (t < 20) {
    vy += level.gravity * STEP;
    vy -= vy * level.drag * STEP;
    y += vy * STEP;
    t += STEP;
    if (vy > 0 && y + EGG_RADIUS >= level.padY && y - EGG_RADIUS < level.padY) {
      return { impact: vy, landed: true, time: t };
    }
    if (y - EGG_RADIUS > VIEW_HEIGHT) return { impact: null, landed: false, time: t };
  }
  return { impact: null, landed: false, time: t };
}

/* 一直喷气，看能不能靠无脑点击过关 */
function spamDrop(level) {
  let y = SPAWN_Y;
  let vy = 0;
  let t = 0;
  let thrusts = 0;
  while (t < 20) {
    vy -= level.thrust;
    thrusts++;
    vy += level.gravity * STEP;
    vy -= vy * level.drag * STEP;
    y += vy * STEP;
    t += STEP;
    if (vy > 0 && y + EGG_RADIUS >= level.padY && y - EGG_RADIUS < level.padY) {
      return { impact: vy, thrusts: thrusts, landed: true };
    }
    if (y - EGG_RADIUS > VIEW_HEIGHT) return { impact: null, thrusts: thrusts, landed: false };
  }
  return { impact: null, thrusts: thrusts, landed: false };
}

const RS = [150, 200, 250, 300];
const TS = [0.75, 0.8, 0.85, 0.9, 0.95];
const TOTAL = RS.length * TS.length;
const PASS_FLOOR = 8;

const rows = [];

for (const level of content.levels) {
  /* 1. 不动手会摔碎，而且差距要明显 */
  const idle = idleDrop(level);
  assert(idle.landed, level.name + '：不动手时蛋会掉出场地，落地判定失效');
  assert(
    idle.impact > level.safe * 1.05,
    level.name + '：不动手也能安全落地（' + idle.impact.toFixed(0) + ' ≤ ' + level.safe + '），这一关没有挑战'
  );

  /* 2. 闭环玩家通过率 */
  let pass = 0;
  let minThrusts = Infinity;
  let maxGasUsed = 0;
  for (const R of RS) {
    for (const T of TS) {
      const r = play(level, R, level.safe * T);
      if (r.ok) {
        pass++;
        minThrusts = Math.min(minThrusts, r.thrusts);
        maxGasUsed = Math.max(maxGasUsed, r.thrusts);
      }
    }
  }
  assert(
    pass >= PASS_FLOOR,
    level.name + '：真人玩法只有 ' + pass + '/' + TOTAL + ' 种操作节奏能过关，太难了'
  );

  /* 3. 节奏：至少要喷两次 */
  assert(minThrusts !== Infinity, level.name + '：没有任何操作节奏能安全着陆');
  assert(minThrusts >= 2, level.name + '：喷一次气就能过（' + minThrusts + ' 次），这一关没有节奏');

  /* 4. 一直乱喷气必须过不去 */
  const spam = spamDrop(level);
  assert(
    spam.thrusts > level.gas * 2,
    level.name + '：一直喷气只用 ' + spam.thrusts + ' 次就够（气量 ' + level.gas + '），节奏没有意义'
  );
  assert(
    !spam.landed || spam.impact > level.safe,
    level.name + '：一直喷气也能安全着陆，「一直点」变成了最优解'
  );

  rows.push({
    关卡: level.name,
    安全线: level.safe,
    '终端速度': Math.round(level.gravity / level.drag),
    '不喷气落地': Math.round(idle.impact),
    '最少喷气': minThrusts,
    气量预算: level.gas,
    '最费气节奏': maxGasUsed,
    '真人通过率': pass + '/' + TOTAL,
    '落地秒': Math.round(idle.time * 100) / 100
  });
}

fs.mkdirSync(path.join(ROOT, 'qa'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'qa', 'balance-report.json'), JSON.stringify(rows, null, 2));
console.log(JSON.stringify(rows, null, 2));

/* 通过率应逐关收紧：允许一格的抖动，但整体趋势不能变宽 */
for (let i = 1; i < rows.length; i++) {
  const prev = Number(rows[i - 1]['真人通过率'].split('/')[0]);
  const cur = Number(rows[i]['真人通过率'].split('/')[0]);
  assert(
    cur <= prev + 1,
    rows[i].关卡 + '：真人通过率未逐关收紧（' + cur + '/' + TOTAL + ' > ' + prev + '/' + TOTAL + '）'
  );
}
console.log(
  '全部关卡 PASS：不喷气必碎、每关至少喷两次、乱喷无效、' +
    '真人通过率 ' + rows[0]['真人通过率'] + ' → ' + rows[rows.length - 1]['真人通过率']
);
