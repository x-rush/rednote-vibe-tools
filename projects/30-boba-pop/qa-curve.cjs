/*
 * 关卡分数-步数曲线导出：用于给每关配 (target, taps)。
 * 输出每关在 casual / expert 策略下，逐 tap 的累计消除数。
 */
const fs = require('fs');
const path = require('path');
const Game = require('./src/game.js');
const content = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/content/content.json'), 'utf8'));

function newState(levelIndex) {
  const state = Game.createRun(content);
  Game.loadLevel(state, levelIndex);
  return state;
}

function candidateGroups(state) {
  const groups = Game.findAllGroups(state.board);
  const out = [];
  const seen = {};
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    if (g.length < 3) continue;
    const key = g.slice().sort((a, b) => a - b).join('-');
    if (seen[key]) continue;
    seen[key] = 1;
    out.push({ index: g[0], size: g.length });
  }
  return out;
}

function replay(levelIndex, seq) {
  const state = newState(levelIndex);
  const steps = [];
  for (let i = 0; i < seq.length; i++) {
    const res = Game.applyTap(state, seq[i]);
    if (!res.ok) return null;
    steps.push(res);
  }
  return { steps: steps, state: state };
}

function casualTrajectory(levelIndex, maxTaps) {
  const state = newState(levelIndex);
  const out = [];
  for (let t = 0; t < maxTaps; t++) {
    const cands = candidateGroups(state);
    if (!cands.length) break;
    let best = cands[0];
    for (let i = 1; i < cands.length; i++) if (cands[i].size > best.size) best = cands[i];
    const res = Game.applyTap(state, best.index);
    if (!res.ok) break;
    out.push({ tap: t + 1, cum: state.cleared, popped: res.popped, chain: res.chain });
  }
  return out;
}

function expertTrajectory(levelIndex, maxTaps) {
  const state = newState(levelIndex);
  const seq = [];
  const out = [];
  for (let t = 0; t < maxTaps; t++) {
    const cands = candidateGroups(state);
    if (!cands.length) break;
    let best = null;
    for (let i = 0; i < cands.length; i++) {
      const trial = replay(levelIndex, seq.concat([cands[i].index]));
      if (!trial) continue;
      const last = trial.steps[trial.steps.length - 1];
      if (!best || trial.state.cleared > best.cum || (trial.state.cleared === best.cum && last.score > best.score)) {
        best = { index: cands[i].index, cum: trial.state.cleared, score: last.score };
      }
    }
    if (!best) break;
    const res = Game.applyTap(state, best.index);
    if (!res.ok) break;
    seq.push(best.index);
    out.push({ tap: t + 1, cum: state.cleared, popped: res.popped, chain: res.chain });
  }
  return out;
}

const maxTaps = 24;
for (let i = 0; i < content.levels.length; i++) {
  const c = casualTrajectory(i, maxTaps);
  const e = expertTrajectory(i, maxTaps);
  const fmt = (arr) => arr.map((x) => x.tap + ':' + x.cum + '(x' + x.chain + ')').join(' ');
  console.log('L' + (i + 1) + ' ' + content.levels[i].name + '  palette=' + content.levels[i].palette.length);
  console.log('  casual ' + fmt(c));
  console.log('  expert ' + fmt(e));
}
