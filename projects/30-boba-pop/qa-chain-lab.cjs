/* 连锁规则实验：比较不同判定基准下的连锁表现 */
const fs = require('fs');
const Game = require('./src/game.js');
const content = JSON.parse(fs.readFileSync('src/content/content.json', 'utf8'));

function simulate(seedBase, rounds) {
  const state = Game.createRun(content);
  const poppedPerTap = [];
  const chains = [];
  for (let r = 0; r < rounds; r++) {
    let idx = -1;
    for (let i = 0; i < state.board.cells.length; i++) {
      if (Game.findGroup(state.board, i).length >= 3) { idx = i; break; }
    }
    if (idx < 0) break;
    const res = Game.applyTap(state, idx);
    poppedPerTap.push(res.popped);
    chains.push(res.chain);
    if (state.tapsLeft <= 0) break;
  }
  return { poppedPerTap, chains, avgPop: (poppedPerTap.reduce((a, b) => a + b, 0) / poppedPerTap.length).toFixed(1), maxPop: Math.max(...poppedPerTap), maxChain: Math.max(...chains) };
}

console.log('--- 当前规则 ---');
for (const s of [1, 2, 3]) {
  console.log('seed', s, JSON.stringify(simulate(s, 10)));
}
