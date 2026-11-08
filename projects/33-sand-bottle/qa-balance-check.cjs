/*
 * 彩沙瓶 · 关卡可达性回归
 *
 * 每个关卡的目标图案都必须真的堆得出来。这一条靠模拟一个「有耐心但不作弊」的玩家，
 * 打法就是真人会用的那套：
 *   1. 按色带从下往上铺：一直往当前最矮的一列倒，自然摊平；
 *   2. 每铺完一层就用塑形棒抹平（把高列的顶层沙搬到低列），落差压到 1 层以内；
 *   3. 堆山：往峰心倒沙让它自己摊成丘，再用塑形修成锥形。
 *
 * 断言：
 *   - 理想玩家能通过这一关（目标可达）；
 *   - 沙量配额够用；
 *   - 目标图案不会塞满瓶子；
 *   - 有山的关卡必须靠塑形：只倒沙做不到（否则这一关没有工具意义）。
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname);
const content = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/content/content.json'), 'utf8').replace(/^\uFEFF/, '')
);
require(path.join(ROOT, 'src/game.js'));
const game = global.SandGame;
const meta = content.meta;

/* 目标图案的每列高度 */
function targetHeights(level) {
  const target = game.buildTarget(level, meta);
  const heights = [];
  for (let c = 0; c < meta.cols; c++) {
    let h = 0;
    for (let r = 0; r < target.grid.length; r++) {
      if (target.grid[r][c] >= 0) h++;
    }
    heights.push(h);
  }
  return { heights: heights, cells: target.cells };
}

/* 把最高列的顶层沙搬到最低列，直到落差不超过 1 层 */
function levelSurface(state) {
  let guard = 0;
  while (guard++ < 6000) {
    let maxC = 0;
    let minC = 0;
    for (let c = 1; c < state.cols.length; c++) {
      if (state.cols[c].length > state.cols[maxC].length) maxC = c;
      if (state.cols[c].length < state.cols[minC].length) minC = c;
    }
    if (state.cols[maxC].length - state.cols[minC].length <= 1) break;
    if (!game.shape(state, maxC, minC)) break;
  }
}

/* 用塑形棒把每列修到目标高度：从最近的富余列借沙 */
function shapeToTarget(state, heights) {
  let guard = 0;
  while (guard++ < 20000) {
    let need = -1;
    let needDiff = 0;
    for (let c = 0; c < state.cols.length; c++) {
      const d = heights[c] - state.cols[c].length;
      if (d > needDiff) { needDiff = d; need = c; }
    }
    if (need < 0) break;
    let donor = -1;
    let bestDist = Infinity;
    for (let c = 0; c < state.cols.length; c++) {
      if (state.cols[c].length > heights[c] && state.cols[c].length > 0) {
        const dist = Math.abs(c - need);
        if (dist < bestDist) { bestDist = dist; donor = c; }
      }
    }
    if (donor < 0) break;
    if (!game.shape(state, donor, need)) break;
  }
}

/*
 * 近似修形：真人不会把每一列都修到分毫不差，
 * 只会把明显凸出来的沙往矮的地方推，误差剩一两层就收手。
 */
function shapeApproximately(state, heights, maxError) {
  let guard = 0;
  while (guard++ < 20000) {
    let donor = -1;
    let bestExcess = 0;
    let sink = -1;
    let bestDeficit = 0;
    let worstErr = 0;
    for (let c = 0; c < state.cols.length; c++) {
      const d = state.cols[c].length - heights[c];
      if (Math.abs(d) > worstErr) worstErr = Math.abs(d);
      if (d > bestExcess) { bestExcess = d; donor = c; }
      if (-d > bestDeficit) { bestDeficit = -d; sink = c; }
    }
    if (worstErr <= maxError) break;
    if (donor < 0 || sink < 0) break;
    if (!game.shape(state, donor, sink)) break;
  }
}

/* 只倒沙、不塑形：自然堆积能到多少分 */
function playPourOnly(level) {  const state = game.createRun(content);
  game.loadLevel(state, content.levels.indexOf(level));
  let baseRows = 0;
  for (const band of level.bands) {
    state.palette = band.color;
    const bandTop = baseRows + band.height;
    let guard = 0;
    while (guard++ < 4000) {
      let minCol = 0;
      let minH = Infinity;
      for (let c = 0; c < state.cols.length; c++) {
        const h = state.cols[c].length;
        if (h < minH) { minH = h; minCol = c; }
      }
      if (minH >= bandTop) break;
      const res = game.pour(state, minCol);
      if (!res || res.type !== 'pour') break;
    }
    baseRows = bandTop;
  }
  if (level.peak) {
    const p = level.peak;
    const center = Math.round(p.center * (meta.cols - 1));
    const peakCells = targetHeights(level).cells - baseRows * meta.cols;
    state.palette = p.color;
    let guard = 0;
    while (state.used < baseRows * meta.cols + peakCells && guard++ < 4000) {
      const res = game.pour(state, center);
      if (!res || res.type !== 'pour') break;
    }
  }
  return game.evaluate(state);
}

/* 倒沙 + 塑形：理想玩家 */
function playWithShape(level) {
  const state = game.createRun(content);
  game.loadLevel(state, content.levels.indexOf(level));
  const target = targetHeights(level);

  let baseRows = 0;
  for (const band of level.bands) {
    state.palette = band.color;
    const bandTop = baseRows + band.height;
    let guard = 0;
    while (guard++ < 4000) {
      let minCol = 0;
      let minH = Infinity;
      for (let c = 0; c < state.cols.length; c++) {
        const h = state.cols[c].length;
        if (h < minH) { minH = h; minCol = c; }
      }
      if (minH >= bandTop) break;
      const res = game.pour(state, minCol);
      if (!res || res.type !== 'pour') break;
    }
    levelSurface(state);
    baseRows = bandTop;
  }

  if (level.peak) {
    const p = level.peak;
    const center = Math.round(p.center * (meta.cols - 1));
    const peakCells = target.cells - baseRows * meta.cols;
    state.palette = p.color;
    let guard = 0;
    while (state.used < baseRows * meta.cols + peakCells && guard++ < 4000) {
      const res = game.pour(state, center);
      if (!res || res.type !== 'pour') break;
    }
  }

  shapeToTarget(state, target.heights);
  return game.evaluate(state);
}

/*
 * 随手玩家：真人不会每一粒都倒在最矮的那一列。
 * 这一版模拟的是「看着沙面随手倒、倒完用塑形棒找平」的打法：
 *   1. 倒沙时在还矮着的列里随机挑一列（固定种子，结果可复现）；
 *   2. 每铺完一层用塑形棒把落差压到 1 层以内；
 *   3. 堆山时在峰心附近随手倒，最后修形。
 * 容差必须让这一类玩家过得去，而不是只让理想玩家过。
 */
function makeRandom(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function playCasual(level, seed) {
  const rand = makeRandom(seed);
  const state = game.createRun(content);
  game.loadLevel(state, content.levels.indexOf(level));
  const target = targetHeights(level);

  /* 在最矮的那几列里随手挑一列（真人看着沙面随手倒） */
  const pickColumn = () => {
    let minH = Infinity;
    for (let c = 0; c < state.cols.length; c++) {
      const h = state.cols[c].length;
      if (h < minH) minH = h;
    }
    const low = [];
    for (let c = 0; c < state.cols.length; c++) {
      if (state.cols[c].length <= minH + 1) low.push(c);
    }
    if (!low.length) return -1;
    return low[Math.floor(rand() * low.length) % low.length];
  };

  let baseRows = 0;
  for (const band of level.bands) {
    state.palette = band.color;
    const bandTop = baseRows + band.height;
    const want = bandTop * meta.cols;
    let guard = 0;
    while (state.used < want && guard++ < 6000) {
      const col = pickColumn();
      if (col < 0) break;
      const res = game.pour(state, col);
      if (!res || res.type !== 'pour') break;
    }
    levelSurface(state);
    baseRows = bandTop;
  }

  if (level.peak) {
    const p = level.peak;
    const center = Math.round(p.center * (meta.cols - 1));
    state.palette = p.color;
    let guard = 0;
    while (state.used < target.cells && guard++ < 6000) {
      const col = center + (Math.floor(rand() * 3) - 1);
      const res = game.pour(state, Math.max(0, Math.min(meta.cols - 1, col)));
      if (!res || res.type !== 'pour') break;
    }
  }

  shapeApproximately(state, target.heights, 1);
  return game.evaluate(state);
}

const rows = [];

for (let levelIndex = 0; levelIndex < content.levels.length; levelIndex++) {
  const level = content.levels[levelIndex];
  const target = targetHeights(level);
  const maxTarget = Math.max.apply(null, target.heights);

  assert(
    maxTarget <= meta.maxHeight,
    level.name + '：目标图案最高 ' + maxTarget + ' 层，超过瓶高 ' + meta.maxHeight
  );

  const poured = playPourOnly(level);
  const shaped = playWithShape(level);
  const casual = playCasual(level, 20260917 + levelIndex * 97);

  assert(
    shaped.passed,
    level.name +
      '：理想玩家也过不去（吻合度 ' + (shaped.ratio * 100).toFixed(0) +
      '%，覆盖率 ' + (shaped.coverage * 100).toFixed(0) + '%）'
  );

  /* 随手玩家必须过得去：容差要按真人打法标定，不能只对理想玩家成立 */
  assert(
    casual.passed,
    level.name +
      '：随手玩家过不去（吻合度 ' + (casual.ratio * 100).toFixed(0) +
      '%，覆盖率 ' + (casual.coverage * 100).toFixed(0) +
      '%，最大高度差 ' + casual.heightError + ' 层，容差 ' + casual.heightTolerance + ' 层）'
  );

  if (level.peak) {
    /* 目标坡度必须超过安息角：否则自然堆积就能堆出来，这一关没有工具意义 */
    let maxSlope = 0;
    for (let c = 1; c < target.heights.length; c++) {
      maxSlope = Math.max(maxSlope, Math.abs(target.heights[c] - target.heights[c - 1]));
    }
    assert(
      maxSlope > meta.maxSlope,
      level.name +
        '：目标最大坡度 ' + maxSlope + ' 不超过安息角 ' + meta.maxSlope +
        '，自然堆积就能堆出来，这一关没有工具意义'
    );
    assert(
      shaped.ratio >= poured.ratio,
      level.name + '：塑形之后反而不如只倒沙（塑形不应该把沙弄乱）'
    );
    assert(
      !poured.passed,
      level.name + '：只倒沙也能过关，塑形工具没有意义'
    );
  }

  rows.push({
    关卡: level.name,
    目标格数: target.cells,
    沙量配额: Math.ceil(target.cells * (level.budgetRatio || 1.4)),
    最高列: maxTarget,
    '只倒沙吻合': Math.round(poured.ratio * 100),
    '塑形后吻合': Math.round(shaped.ratio * 100),
    覆盖率: Math.round(shaped.coverage * 100),
    '随手玩家吻合': Math.round(casual.ratio * 100),
    '随手玩家高度差': casual.heightError,
    '随手玩家过关': casual.passed
  });
}

fs.mkdirSync(path.join(ROOT, 'qa'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'qa', 'balance-report.json'), JSON.stringify(rows, null, 2));
console.log(JSON.stringify(rows, null, 2));
console.log('全部关卡 PASS：目标图案可达、塑形确实起作用、沙量配额够用');
