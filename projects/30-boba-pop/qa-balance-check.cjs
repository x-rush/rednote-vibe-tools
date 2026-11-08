/*
 * 关卡可通关性验证（平衡性回归）。
 *
 * 盘面由 content.meta.seedBase + 关卡序号 决定，同一关每次开局完全一致，
 * 因此「某个策略能拿到多少分」是可精确复现的确定性结论。
 *
 * 两种策略：
 *   casual —— 贪心：每次点当前盘面上最大的那一组（普通玩家的直觉打法）
 *   expert —— 搜索：对每个候选组真实试演一次，取本次消除最多的选择
 * 关卡目标必须落在「casual 也能达成」的区间内，同时给 expert 留出余量，
 * 这样大多数玩家都能通关，水平高的玩家能打出更高分。
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

/* 按给定点击序列完整重演一遍，返回每一步的结果 */
function replay(levelIndex, seq) {
  const state = newState(levelIndex);
  const steps = [];
  for (let i = 0; i < seq.length; i++) {
    const res = Game.applyTap(state, seq[i]);
    if (!res.ok) return { steps: steps, state: state, aborted: true };
    steps.push({ popped: res.popped, score: res.score, chain: res.chain });
  }
  return { steps: steps, state: state, aborted: false };
}

/* 当前盘面上所有不同三连组，用每组的任意一颗作为点击索引 */
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

/* 贪心策略 */
function playCasual(levelIndex) {
  const state = newState(levelIndex);
  const steps = [];
  let taps = 0;
  while (taps < state.level.taps) {
    const cands = candidateGroups(state);
    if (!cands.length) break;
    let best = cands[0];
    for (let i = 1; i < cands.length; i++) {
      if (cands[i].size > best.size) best = cands[i];
    }
    const res = Game.applyTap(state, best.index);
    if (!res.ok) break;
    taps++;
    steps.push(res);
    if (state.cleared >= state.level.target) break;
  }
  return { steps: steps, taps: taps, cleared: state.cleared, score: state.score };
}

/* 专家策略：每次真实试演所有候选，取本次消除最多的（并列时取分数高的） */
function playExpert(levelIndex) {
  const state = newState(levelIndex);
  const seq = [];
  const steps = [];
  let taps = 0;
  while (taps < state.level.taps) {
    const cands = candidateGroups(state);
    if (!cands.length) break;
    let best = null;
    for (let i = 0; i < cands.length; i++) {
      const trial = replay(levelIndex, seq.concat([cands[i].index]));
      if (trial.aborted) continue;
      const last = trial.steps[trial.steps.length - 1];
      const cum = trial.state.cleared;
      if (!best || cum > best.cum || (cum === best.cum && last.score > best.score)) {
        best = { index: cands[i].index, cum: cum, score: last.score, popped: last.popped };
      }
    }
    if (!best) break;
    const res = Game.applyTap(state, best.index);
    if (!res.ok) break;
    seq.push(best.index);
    taps++;
    steps.push(res);
    if (state.cleared >= state.level.target) break;
  }
  return { steps: steps, taps: taps, cleared: state.cleared, score: state.score };
}

/* 关卡目标必须在 taps 步内可达：返回达到 target 所需的最少步数 */
function tapsToReach(levelIndex, goal) {
  const state = newState(levelIndex);
  let taps = 0;
  while (taps < 60 && state.cleared < goal) {
    const cands = candidateGroups(state);
    if (!cands.length) return null;
    let best = cands[0];
    for (let i = 1; i < cands.length; i++) {
      if (cands[i].size > best.size) best = cands[i];
    }
    const res = Game.applyTap(state, best.index);
    if (!res.ok) return null;
    taps++;
  }
  return state.cleared >= goal ? taps : null;
}

const rows = [];
let allPass = true;
const detail = [];
for (let i = 0; i < content.levels.length; i++) {
  const level = content.levels[i];
  const casual = playCasual(i);
  const expert = playExpert(i);
  const need = tapsToReach(i, level.target);
  const pass = casual.cleared >= level.target && casual.taps <= level.taps;
  if (!pass) allPass = false;
  rows.push(
    'L' + (i + 1) + ' ' + level.name +
    ' target=' + level.target + ' taps=' + level.taps +
    ' | casual ' + casual.cleared + '分/' + casual.taps + '步' +
    ' | expert ' + expert.cleared + '分/' + expert.taps + '步' +
    ' | 达标需 ' + (need === null ? '不可达' : need) + ' 步' +
    ' ' + (pass ? 'PASS' : 'FAIL')
  );
  detail.push({
    level: i + 1,
    name: level.name,
    target: level.target,
    taps: level.taps,
    casual: { cleared: casual.cleared, taps: casual.taps, score: casual.score },
    expert: { cleared: expert.cleared, taps: expert.taps, score: expert.score },
    tapsToReachTarget: need,
    pass: pass
  });
}

console.log(rows.join('\n'));
console.log('');
for (let i = 0; i < detail.length; i++) {
  const d = detail[i];
  console.log(
    'L' + d.level + ' casual ' + d.casual.cleared + '/' + d.target +
    ' (余 ' + (d.target - d.casual.cleared) + '，' + (d.taps - d.casual.taps) + ' 步富余)' +
    ' expert ' + d.expert.cleared + '/' + d.target +
    ' (余 ' + (d.expert.cleared - d.target) + '，' + (d.taps - d.expert.taps) + ' 步富余)'
  );
}
console.log('');
console.log(allPass ? '全部关卡可通过' : '存在无法通关的关卡');
fs.writeFileSync(path.join(__dirname, 'qa', 'balance-report.json'), JSON.stringify(detail, null, 2));
process.exitCode = allPass ? 0 : 1;
