/*
 * 沙丘速降 · 手感探针（三期严格复刻版）
 * 扫掠「随手玩家够门率」与反应延迟，看存活曲线怎么动，
 * 用来定真人模型参数。正式回归（含断言）在 qa-balance-check.cjs。
 * 转向是原版橡皮筋：手指位置 = 拖拽目标（setDrag 激活 + moveDrag 更新）。
 */
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
require(path.join(ROOT, 'src/game.js'));
const game = global.DuneGame;

const W = 390;
const H = 844;
const DT = 16.6; /* ms */
const HORIZON = 120000; /* ms */
const seeds = [1, 2, 3, 4, 5, 6, 7, 8];

function playHuman(state, seed, opt) {
  const rand = game.makeRandom(seed);
  const phase = rand() * Math.PI * 2;
  let nextDecision = 0;
  const commitMemo = {};
  const queue = [];
  const stats = { gates: 0, misses: 0 };
  let t = 0;
  game.setDrag(state, W / 2);

  function sense() {
    let gate = null;
    let gd = Infinity;
    for (const f of state.gateList) {
      if (f.passed) continue;
      const d = f.y - state.wy;
      if (d < 0 || d > 900) continue;
      if (d < gd) {
        gd = d;
        gate = f;
      }
    }
    if (gate && opt.commit < 1) {
      const key = Math.round(gate.y);
      if (commitMemo[key] === undefined) commitMemo[key] = rand() < opt.commit;
      if (!commitMemo[key] && t >= opt.warmup) gate = null;
    }
    if (!gate) {
      const wobble = opt.weave * Math.sin(t * opt.weaveFreq + phase);
      return game.clamp(W / 2 + wobble + (rand() - 0.5) * opt.jitter * 0.4, game.WALL_MARGIN + 4, W - game.WALL_MARGIN - 4);
    }
    return game.clamp(gate.x + (rand() - 0.5) * opt.jitter, game.WALL_MARGIN + 4, W - game.WALL_MARGIN - 4);
  }

  while (!state.finished && t < HORIZON) {
    if (t >= nextDecision) {
      nextDecision = t + 60;
      queue.push({ at: t + opt.latency, target: sense() });
    }
    while (queue.length && queue[0].at <= t) {
      game.moveDrag(state, queue.shift().target);
    }
    const g0 = state.gates;
    game.step(state, DT, { width: W, height: H, mode: 'play', now: t });
    stats.gates += state.gates - g0;
    for (const f of state.gateList) {
      if (f.passed === 2 && !f.missSeen) {
        f.missSeen = true;
        stats.misses++;
      }
    }
    t += DT;
  }
  stats.time = t;
  return stats;
}

function sweep(label, base, key, values) {
  console.log('--- ' + label + ' ---');
  console.log('值       平均米   平均秒   旗门   错门   最差米   顶满');
  for (const v of values) {
    const opt = Object.assign({}, base);
    opt[key] = v;
    const rows = [];
    for (const seed of seeds) {
      const state = game.createRun(W);
      state.rand = game.makeRandom(seed * 7919 + 13);
      game.startRun(state, W);
      const s = playHuman(state, seed * 131 + 7, opt);
      rows.push({
        m: game.meters(state),
        t: s.time / 1000,
        g: s.gates,
        miss: s.misses,
        full: !state.finished
      });
    }
    const avg = (k) => rows.reduce((a, r) => a + r[k], 0) / rows.length;
    const worst = Math.min.apply(null, rows.map((r) => r.m));
    console.log(
      String(v).padEnd(8, ' ') +
      String(Math.round(avg('m'))).padEnd(8, ' ') +
      (+avg('t').toFixed(1)).toString().padEnd(8, ' ') +
      (+avg('g').toFixed(1)).toString().padEnd(6, ' ') +
      (+avg('miss').toFixed(1)).toString().padEnd(6, ' ') +
      String(worst).padEnd(8, ' ') +
      rows.filter((r) => r.full).length
    );
  }
}

const CASUAL = { latency: 240, jitter: 12, weave: 6, weaveFreq: 0.42, commit: 0.25, warmup: 6000 };

sweep('够门率 commit（当前 0.25）', CASUAL, 'commit', [0.1, 0.15, 0.25, 0.35, 0.5, 1]);
sweep('反应延迟 latency ms（当前 240）', CASUAL, 'latency', [100, 160, 240, 300, 380]);
sweep('手抖 jitter px（当前 12）', CASUAL, 'jitter', [4, 8, 12, 16, 24]);
