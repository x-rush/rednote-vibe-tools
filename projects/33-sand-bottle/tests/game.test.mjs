/*
 * 彩沙瓶 · 玩法单测
 * 只测纯逻辑：沙的堆积与滑落、塑形搬沙、目标图案展开、吻合度与封口。
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
const game = global.SandGame;
const meta = content.meta;

function newRun(levelIndex) {
  const state = game.createRun(content);
  if (levelIndex) game.loadLevel(state, levelIndex);
  return state;
}

test('初始状态落在第一关，沙量配额由目标格数算出', () => {
  const state = newRun();
  assert.strictEqual(state.levelIndex, 0);
  assert.strictEqual(state.tool, 'pour');
  assert.strictEqual(state.used, 0);
  assert.strictEqual(state.cols.length, meta.cols);
  assert.ok(state.budget > state.target.cells, '沙量配额必须比目标格数宽裕');
});

test('倒沙会加一格并吃掉额度', () => {
  const state = newRun();
  const before = state.used;
  const res = game.pour(state, 12);
  assert.strictEqual(res.type, 'pour');
  assert.strictEqual(state.cols[12].length, 1);
  assert.strictEqual(state.used, before + 1);
});

test('沙会自己滑落：坡度超过安息角时流到邻列', () => {
  const state = newRun();
  for (let i = 0; i < 10; i++) game.pour(state, 12);
  const center = state.cols[12].length;
  const neighbor = state.cols[11].length;
  assert.ok(center > 0, '中间列应该有沙');
  assert.ok(neighbor > 0, '沙必须自己滑到邻列');
  assert.ok(center - neighbor <= meta.maxSlope, '相邻列高度差不能超过安息角');
});

test('塑形把沙从一列搬到另一列，总量不变', () => {
  const state = newRun();
  for (let i = 0; i < 6; i++) game.pour(state, 5);
  const totalBefore = game.totalCells(state);
  const fromBefore = state.cols[5].length;
  const toBefore = state.cols[6].length;
  const res = game.shape(state, 5, 6);
  assert.strictEqual(res.type, 'shape');
  assert.strictEqual(game.totalCells(state), totalBefore, '塑形不改变沙的总量');
  assert.strictEqual(state.cols[5].length, fromBefore - 1);
  assert.strictEqual(state.cols[6].length, toBefore + 1);
});

test('塑形不受安息角限制：可以堆出比安息角更陡的坡', () => {
  const state = newRun();
  for (let i = 0; i < 12; i++) game.pour(state, 3);
  for (let i = 0; i < 6; i++) {
    game.shape(state, 4, 3);
  }
  const diff = state.cols[3].length - state.cols[4].length;
  assert.ok(diff > meta.maxSlope, '塑形后的落差应该可以超过安息角（' + diff + '）');
});

test('挖沙拿走顶上一层并退还额度', () => {
  const state = newRun();
  game.pour(state, 8);
  const used = state.used;
  const res = game.scoop(state, 8);
  assert.strictEqual(res.type, 'scoop');
  assert.strictEqual(state.cols[8].length, 0);
  assert.strictEqual(state.used, used - 1);
});

test('目标图案按色带从下往上展开', () => {
  const target = game.buildTarget(content.levels[1], meta);
  const bottom = target.grid[0];
  const second = target.grid[4];
  assert.ok(bottom.every((c) => c === content.levels[1].bands[0].color), '底层应该是第一条色带');
  assert.ok(second.every((c) => c === content.levels[1].bands[1].color), '第二层应该是第二条色带');
  assert.strictEqual(target.grid[8].every((c) => c === -1), true, '色带之上应该是空的');
});

test('山峰是逐层收窄的三角形', () => {
  const level = content.levels[3];
  const target = game.buildTarget(level, meta);
  let row = level.bands.reduce((sum, b) => sum + b.height, 0);
  let prevWidth = -1;
  for (let k = 0; k < level.peak.height; k++) {
    const width = target.grid[row + k].filter((c) => c >= 0).length;
    assert.ok(width <= prevWidth || prevWidth < 0, '山峰每层必须不宽于上一层');
    prevWidth = width;
  }
});

test('堆得分毫不差时吻合度为 100%', () => {
  const state = newRun();
  const target = state.target;
  for (let c = 0; c < meta.cols; c++) {
    const height = (function () {
      let h = 0;
      for (let r = 0; r < target.grid.length; r++) if (target.grid[r][c] >= 0) h++;
      return h;
    })();
    for (let r = 0; r < height; r++) {
      state.cols[c].push(target.grid[r][c]);
    }
  }
  state.used = game.totalCells(state);
  const result = game.evaluate(state);
  assert.strictEqual(result.ratio, 1);
  assert.strictEqual(result.coverage, 1);
  assert.strictEqual(result.passed, true);
});

test('没达标不能封口，达标后只存结构化的层色清单', () => {
  const state = newRun();
  assert.strictEqual(game.seal(state), null, '空的瓶子不能封口');
  const target = state.target;
  for (let c = 0; c < meta.cols; c++) {
    for (let r = 0; r < target.grid.length; r++) {
      if (target.grid[r][c] >= 0) state.cols[c].push(target.grid[r][c]);
    }
  }
  state.used = game.totalCells(state);
  const bottle = game.seal(state);
  assert.ok(bottle, '达标后应该能封口');
  assert.strictEqual(bottle.colors.length, meta.cols);
  assert.ok(typeof bottle.colors[0][0] === 'number', '收藏只存颜色索引，不存图片');
  assert.strictEqual(state.sealed, 1);
});

test('八关都合法：目标不超瓶高，配额够用', () => {
  for (const level of content.levels) {
    const target = game.buildTarget(level, meta);
    let maxH = 0;
    for (let c = 0; c < meta.cols; c++) {
      let h = 0;
      for (let r = 0; r < target.grid.length; r++) if (target.grid[r][c] >= 0) h++;
      if (h > maxH) maxH = h;
    }
    assert.ok(maxH <= meta.maxHeight, level.name + '：目标超过瓶高');
    assert.ok(target.cells > 0, level.name + '：目标为空');
  }
});

/* 按目标图案把瓶子堆到分毫不差 */
function fillExact(state) {
  const target = state.target;
  for (let c = 0; c < meta.cols; c++) {
    for (let r = 0; r < target.grid.length; r++) {
      if (target.grid[r][c] >= 0) state.cols[c].push(target.grid[r][c]);
    }
  }
  state.used = game.totalCells(state);
}

test('逐列高度误差超标就不能过关：颜色全对也不行', () => {
  const state = newRun();
  fillExact(state);
  /* 挖掉一列的顶层：颜色仍然全对，但那一列矮了一层 */
  state.cols[0].pop();
  state.used = game.totalCells(state);
  const result = game.evaluate(state);
  assert.strictEqual(result.heightError, 1, '应该只差一层');
  assert.strictEqual(result.passed, true, '差一层仍在第一关的容差之内');

  /* 再挖三层：误差超过容差，颜色再对也不能过 */
  state.cols[0].pop();
  state.cols[0].pop();
  state.cols[0].pop();
  state.used = game.totalCells(state);
  const worse = game.evaluate(state);
  assert.strictEqual(worse.heightError, 4);
  assert.strictEqual(worse.passed, false);
});

test('高度误差超过容差时给出「沙面还不够平」', () => {
  const state = newRun();
  fillExact(state);
  /* 第一列挖掉四层：误差 4 层，远超第一关的容差 2 */
  for (let i = 0; i < 4; i++) state.cols[0].pop();
  state.used = game.totalCells(state);
  const result = game.evaluate(state);
  assert.strictEqual(result.heightError, 4);
  assert.strictEqual(result.passed, false);
  assert.strictEqual(result.reason, content.copy.reasonHeight);
});

test('颜色不对时给出「颜色还没对」，沙量不对时给出「沙量不对」', () => {
  const state = newRun();
  fillExact(state);
  /* 把底层全部换成另一种颜色：高度和沙量都对，只有颜色错 */
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < meta.cols; c++) state.cols[c][r] = 3;
  }
  const wrongColor = game.evaluate(state);
  assert.strictEqual(wrongColor.ratio, 0);
  assert.strictEqual(wrongColor.passed, false);
  assert.strictEqual(wrongColor.reason, content.copy.reasonColor);

  /* 沙太少：只堆一半 */
  const short = newRun();
  for (let c = 0; c < meta.cols; c++) {
    for (let r = 0; r < 2; r++) short.cols[c].push(0);
  }
  short.used = game.totalCells(short);
  const shortResult = game.evaluate(short);
  assert.ok(shortResult.coverage < 1 - 0.18, '覆盖率应该明显不足');
  assert.strictEqual(shortResult.passed, false);
  assert.strictEqual(shortResult.reason, content.copy.reasonAmount);
});

test('堆出山但高度不够时给出「山还不够高」', () => {
  const state = newRun(3);
  fillExact(state);
  /* 把最高的那一列削掉两层：颜色依然全对，但山矮了 */
  let tallest = 0;
  for (let c = 1; c < meta.cols; c++) {
    if (state.cols[c].length > state.cols[tallest].length) tallest = c;
  }
  assert.strictEqual(state.cols[tallest].length, state.target.maxHeight);
  state.cols[tallest].pop();
  state.cols[tallest].pop();
  state.used = game.totalCells(state);
  const result = game.evaluate(state);
  assert.strictEqual(result.peakError, 2, '山的那一列差了两层');
  assert.strictEqual(result.passed, false);
  assert.strictEqual(result.reason, content.copy.reasonPeak);
});
