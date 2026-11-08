/*
 * 毽子连击 · 手感平衡回归
 *
 * 用与游戏一致的时间步长模拟每一关的飞行，测出：
 *  1. 从越过接球线到落地之间，玩家实际可操作的时间窗口；
 *  2. 完整一次「起踢 → 落地」的周期；
 *  3. 接球线必须落在抛物线顶点之下，否则窗口会在顶点就打开，没有意义。
 *
 * 窗口要随关卡单调变窄，但必须留出反应余量。
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname);
const content = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/content/content.json'), 'utf8').replace(/^\uFEFF/, '')
);

const GROUND_Y = 330;
const STEP = 1 / 120;

function apexHeight(level) {
  return (level.kickSpeed * level.kickSpeed) / (2 * level.gravity);
}

function catchLineY(level) {
  return GROUND_Y - apexHeight(level) * level.catchFactor;
}

/* 模拟一整趟：从起踢到落地，记录越过接球线的时刻 */
function simulate(level) {
  let y = GROUND_Y;
  let vy = -level.kickSpeed;
  let t = 0;
  let crossed = null;
  let apexY = y;
  while (t < 10) {
    vy += level.gravity * STEP;
    y += vy * STEP;
    t += STEP;
    if (y < apexY) apexY = y;
    if (crossed === null && vy > 0 && y >= catchLineY(level)) crossed = t;
    if (y >= GROUND_Y) {
      return { window: crossed === null ? 0 : t - crossed, cycle: t, apexY: apexY };
    }
  }
  return { window: 0, cycle: 0, apexY: apexY };
}

const rows = [];
let previousWindow = Infinity;

for (const level of content.levels) {
  const apexY = GROUND_Y - apexHeight(level);
  const line = catchLineY(level);
  const sim = simulate(level);

  /* 接球线必须低于顶点，且不能贴着地面 */
  assert(line >= apexY, level.name + '：接球线高于抛物线顶点，窗口会在顶点就打开');
  assert(line < GROUND_Y - 40, level.name + '：接球线过低，窗口太短');
  /* 顶点必须留在画面里，不能顶出上边缘 */
  assert(apexY >= 24, level.name + '：抛物线顶点过高，会被上边缘切掉');

  /* 窗口必须留出反应余量 */
  assert(sim.window >= 0.16, level.name + '：操作窗口 ' + (sim.window * 1000).toFixed(0) + 'ms 过短');
  assert(sim.window <= 0.75, level.name + '：操作窗口 ' + (sim.window * 1000).toFixed(0) + 'ms 过长');

  /* 随关卡单调变窄 */
  assert(
    sim.window <= previousWindow + 0.012,
    level.name + '：窗口未随关卡变窄（' + (sim.window * 1000).toFixed(0) + 'ms > ' + (previousWindow * 1000).toFixed(0) + 'ms）'
  );
  previousWindow = Math.min(previousWindow, sim.window);

  /* 目标次数与机会数必须合理 */
  assert(level.target >= 5, level.name + '：目标过少');
  assert(level.target <= 30, level.name + '：目标过多');
  assert(level.lives >= 2, level.name + '：机会过少，容错太低');

  rows.push({
    关卡: level.name,
    目标: level.target,
    机会: level.lives,
    '窗口ms': Math.round(sim.window * 1000),
    '周期ms': Math.round(sim.cycle * 1000),
    '顶点高度': Math.round(apexHeight(level)),
    '接球线离地': Math.round(GROUND_Y - line)
  });
}

const first = rows[0]['窗口ms'];
const last = rows[rows.length - 1]['窗口ms'];
assert(last < first * 0.8, '难度曲线太平：末关窗口 ' + last + 'ms 相对首关 ' + first + 'ms 收窄不足');

fs.mkdirSync(path.join(ROOT, 'qa'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'qa', 'balance-report.json'), JSON.stringify(rows, null, 2));
console.log(JSON.stringify(rows, null, 2));
console.log('窗口收窄：' + first + 'ms → ' + last + 'ms，所有关卡 PASS');
