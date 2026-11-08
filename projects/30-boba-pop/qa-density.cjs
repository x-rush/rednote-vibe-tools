/*
 * 盘面密度与连锁体检：
 *   1) 各颜色数下，开局盘面平均有多少组可点目标（玩家有没有选择）
 *   2) 单击消除量分布（有没有「一键清半盘」）
 *   3) 连锁深度分布
 */
const fs = require('fs');
const path = require('path');
const Game = require('./src/game.js');
const content = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/content/content.json'), 'utf8'));

function paletteOf(n) {
  return content.flavors.slice(0, n).map((f) => f.id);
}

function groupSizes(board) {
  const groups = Game.findAllGroups(board).filter((g) => g.length >= 3);
  return groups.map((g) => g.length);
}

console.log('--- 开局可点目标数（20 个种子均值）---');
[4, 5, 6].forEach((n) => {
  const pal = paletteOf(n);
  let total = 0;
  let maxSize = 0;
  let minGroups = 99;
  for (let s = 0; s < 20; s++) {
    const board = Game.makeBoard(6, 8, pal, Game.createRng((s + 1) * 104729));
    const sizes = groupSizes(board);
    total += sizes.length;
    minGroups = Math.min(minGroups, sizes.length);
    sizes.forEach((x) => { if (x > maxSize) maxSize = x; });
  }
  console.log(n + ' 色: 平均 ' + (total / 20).toFixed(1) + ' 组，最少 ' + minGroups + ' 组，最大色块 ' + maxSize);
});

console.log('');
console.log('--- 单击消除量 / 连锁分布（每种颜色数 40 次随机点击）---');
[4, 5, 6].forEach((n) => {
  const pal = paletteOf(n);
  const popped = [];
  const chains = [];
  for (let s = 0; s < 40; s++) {
    const state = Game.createRun(content);
    state.palette = pal.slice();
    state.board = Game.makeBoard(6, 8, pal, Game.createRng((s + 1) * 7919));
    state.queue = [];
    state.rng = Game.createRng((s + 1) * 7919 + 7);
    Game.previewColors(state, 12);
    for (let t = 0; t < 6; t++) {
      const groups = Game.findAllGroups(state.board).filter((g) => g.length >= 3);
      if (!groups.length) break;
      let best = groups[0];
      for (let i = 1; i < groups.length; i++) if (groups[i].length > best.length) best = groups[i];
      const res = Game.applyTap(state, best[0]);
      if (!res.ok) break;
      popped.push(res.popped);
      chains.push(res.chain);
      state.tapsLeft = 99;
    }
  }
  const avg = popped.reduce((a, b) => a + b, 0) / popped.length;
  const chainHist = {};
  chains.forEach((c) => { chainHist[c] = (chainHist[c] || 0) + 1; });
  console.log(
    n + ' 色: 均消除 ' + avg.toFixed(1) + ' 颗，最大 ' + Math.max.apply(null, popped) +
    ' 颗；连锁分布 ' + JSON.stringify(chainHist)
  );
});
