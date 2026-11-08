/*
 * 沙丘速降 · 手感探针
 * 对比「熟练玩家」与「随手玩家」两个模型的各项指标，用来定难度参数。
 * 正式回归在 qa-balance-check.cjs。
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const content = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/content/content.json'), 'utf8').replace(/^\uFEFF/, '')
);
require(path.join(ROOT, 'src/game.js'));
const game = global.DuneGame;

const DT = 1 / 60;

function playHuman(state, seed, opt) {
  const rand = game.makeRandom(seed);
  const queue = [];
  let nextDecision = 0;
  const phase = rand() * Math.PI * 2;

  function decide() {
    let ridge = null;
    let ridgeDist = Infinity;
    let gate = null;
    let gateDist = Infinity;
    for (const f of state.features) {
      const d = f.s - state.s;
      if (d < -10 || d > 620) continue;
      if (f.type === 'ridge' && d < ridgeDist) { ridge = f; ridgeDist = d; }
      if (f.type === 'gate' && !f.passed && d < gateDist) { gate = f; gateDist = d; }
    }
    if (ridge && ridgeDist < 400) {
      /* 只有真的会被这块石头挡住才躲 */
      const inPath = state.x > ridge.lo - 40 && state.x < ridge.hi + 40;
      if (inPath) {
        const cands = [];
        const left = ridge.lo - 16;
        const right = ridge.hi + 16;
        if (left >= 8 && left <= game.WIDTH - 8) cands.push(left);
        if (right >= 8 && right <= game.WIDTH - 8) cands.push(right);
        if (cands.length) {
          let best = cands[0];
          for (const c of cands) if (Math.abs(c - state.x) < Math.abs(best - state.x)) best = c;
          return best + (rand() - 0.5) * opt.jitter;
        }
      }
    }
    if (gate && gateDist < 200) {
      /* 只捡顺路的旗门：一头扎过去会把自己从快车道上拽下来，反而更慢 */
      const gx = gate.x + (rand() - 0.5) * opt.jitter;
      if (gx >= 8 && gx <= game.WIDTH - 8 && Math.abs(gx - state.x) < 80) return gx;
    }
    const line = game.fallLine(state.s);
    if (!opt.trackLine) {
      /* 随手玩家：不知道画面上那条发亮的线最快，
         就守在屏幕中间小范围瞎晃——这才是「没看懂玩法」的人的样子 */
      const wobble2 = opt.weave * Math.sin(state.time * opt.weaveFreq + phase);
      return game.clamp(opt.home + wobble2 + (rand() - 0.5) * opt.jitter, 8, game.WIDTH - 8);
    }
    const wobble = opt.weave * Math.sin(state.time * opt.weaveFreq + phase);
    return game.clamp(line + wobble + (rand() - 0.5) * opt.jitter, 8, game.WIDTH - 8);
  }

  const stats = { crashes: 0, gates: 0, carves: 0, jumps: 0, speedSum: 0, frames: 0 };
  while (state.phase === 'run' && state.time < 300) {
    if (state.time >= nextDecision) {
      nextDecision += 0.12;
      queue.push({ at: state.time + opt.latency, target: decide() });
    }
    while (queue.length && queue[0].at <= state.time) {
      state.targetX = queue.shift().target;
    }
    const before = state.events.length;
    game.update(state, DT);
    for (let i = before; i < state.events.length; i++) {
      const e = state.events[i];
      if (e.type === 'crash') stats.crashes++;
      else if (e.type === 'gate') stats.gates++;
      else if (e.type === 'carve') stats.carves++;
      else if (e.type === 'jump') stats.jumps++;
    }
    stats.speedSum += state.speed;
    stats.frames++;
  }
  return stats;
}

const PROFILES = {
  熟练玩家: { latency: 0.22, jitter: 4, weave: 10, weaveFreq: 0.55, trackLine: true },
  随手玩家: { latency: 0.38, jitter: 14, weave: 12, weaveFreq: 0.4, trackLine: false, home: 150 }
};

const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
const summary = {};

for (const name of Object.keys(PROFILES)) {
  const opt = PROFILES[name];
  let meters = 0, crashes = 0, gates = 0, carves = 0, jumps = 0, speed = 0, time = 0;
  let worst = Infinity;
  let best = 0;
  const rows = [];
  for (const seed of seeds) {
    const state = game.createRun(content, seed * 7919 + 13);
    game.startRun(state);
    const r = playHuman(state, seed * 131 + 7, opt);
    const m = game.meters(state);
    meters += m;
    crashes += r.crashes;
    gates += r.gates;
    carves += r.carves;
    jumps += r.jumps;
    speed += r.speedSum / r.frames;
    time += state.time;
    if (m < worst) worst = m;
    if (m > best) best = m;
    rows.push({
      seed: seed,
      米: m,
      秒: +state.time.toFixed(1),
      撞脊: r.crashes,
      旗门: r.gates,
      甩尾: r.carves,
      阶段: state.stageIndex + 1
    });
  }
  const n = seeds.length;
  summary[name] = {
    平均米: Math.round(meters / n),
    最差米: worst,
    最好米: best,
    平均秒: +(time / n).toFixed(1),
    平均撞脊: +(crashes / n).toFixed(1),
    平均旗门: +(gates / n).toFixed(1),
    平均甩尾: +(carves / n).toFixed(1),
    平均腾空: +(jumps / n).toFixed(1),
    平均速度: Math.round(speed / n),
    明细: rows
  };
}

console.log(JSON.stringify(summary, null, 1));
