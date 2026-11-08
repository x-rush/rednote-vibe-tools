/*
 * 沙丘速降 · 手感回归
 *
 * 这一款是纯手感向的（竞速 + 躲避 + 甩尾），风险是「数学上能过、真人过不去」，
 * 或者反过来「太容易，一口气滑到天荒地老」。所以用两个真人玩家模型量曲线：
 *
 *   熟练玩家：反应 220ms、手抖 ±4、主动追落水线
 *   随手玩家：反应 380ms、手抖 ±14、只会躲障碍不追线
 *
 * 断言：
 *   1. 随手玩家也能跑出一段像样的距离——不能开局就被雪崩吃掉；
 *   2. 熟练玩家明显强于随手玩家——技术要有回报；
 *   3. 一局的距离、旗门、甩尾、撞脊次数都落在合理区间；
 *   4. 岩脊留出的通道一定来得及横移过去（可解性）；
 *   5. 难度段越往后雪崩追得越紧（难度曲线）。
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname);
const content = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/content/content.json'), 'utf8').replace(/^\uFEFF/, '')
);
require(path.join(ROOT, 'src/game.js'));
const game = global.DuneGame;

const DT = 1 / 60;

/*
 * 闭环真人玩家：
 *   - 看到前方最近的岩脊，会往安全通道那边靠；
 *   - 看到旗门会去穿（穿不到就不追）；
 *   - 平时追着落水线跑，并左右摆着切下去（真人不会走直线）；
 *   - 所有决策都有反应延迟，落点有手抖。
 */
function playHuman(state, seed, opt) {
  const rand = game.makeRandom(seed);
  const latency = opt.latency;
  const jitter = opt.jitter;
  const weaveAmp = opt.weave;
  const weaveFreq = opt.weaveFreq;
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
      if (f.type === 'ridge' && d < ridgeDist) {
        ridge = f;
        ridgeDist = d;
      }
      if (f.type === 'gate' && !f.passed && d < gateDist) {
        gate = f;
        gateDist = d;
      }
    }
    if (ridge && ridgeDist < 400) {
      /* 只有真的会被这块石头挡住才躲。
         早先写成「只要前方有岩脊就往边缘靠」，结果 84% 的决策都在做无谓的躲避，
         玩家根本没有机会去追落水线——专业和不专业跑出来一样远。 */
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
          return best + (rand() - 0.5) * jitter;
        }
      }
    }
    if (gate && gateDist < 200) {
      /* 只捡顺路的旗门：旗门挂在快车道上，位置比玩家现在站的线还靠前，
         一头扎过去会把自己从快车道上拽下来，反而更慢 */
      const gx = gate.x + (rand() - 0.5) * jitter;
      if (gx >= 8 && gx <= game.WIDTH - 8 && Math.abs(gx - state.x) < 80) return gx;
    }
    /* 追落水线 + 左右摆动 */
    const line = game.fallLine(state.s);
    if (!opt.trackLine) {
      /* 随手玩家：不知道画面上那条发亮的线最快，
         就守在屏幕中间小范围瞎晃——这才是「没看懂玩法」的人的样子 */
      const wobble = weaveAmp * Math.sin(state.time * weaveFreq + phase);
      return game.clamp(opt.home + wobble + (rand() - 0.5) * jitter, 8, game.WIDTH - 8);
    }
    const wobble = weaveAmp * Math.sin(state.time * weaveFreq + phase);
    return game.clamp(line + wobble + (rand() - 0.5) * jitter, 8, game.WIDTH - 8);
  }

  const stats = { crashes: 0, gates: 0, carves: 0, jumps: 0 };
  while (state.phase === 'run' && state.time < 300) {
    if (state.time >= nextDecision) {
      nextDecision += 0.12;
      queue.push({ at: state.time + latency, target: decide() });
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
  }
  return stats;
}

/*
 * 两个模型代表的正是这款游戏的两条学习曲线：
 *   熟练玩家：认得那条发亮的落水线，会追着它切弯（反应快、手稳）
 *   随手玩家：不知道线在哪，就在原地瞎晃（反应慢、手抖）
 * 两者唯一的结构性差别就是「会不会用画面上给出的信息」。
 */
const SKILLED = { latency: 0.22, jitter: 4, weave: 10, weaveFreq: 0.55, trackLine: true };
const CASUAL = { latency: 0.38, jitter: 14, weave: 12, weaveFreq: 0.4, trackLine: false, home: 150 };

function runProfile(profile, seeds, tag) {
  const rows = [];
  for (const seed of seeds) {
    const state = game.createRun(content, seed * 7919 + 13);
    game.startRun(state);
    const s = playHuman(state, seed * 131 + 7, profile);
    rows.push({
      seed: seed,
      米: game.meters(state),
      秒: +state.time.toFixed(1),
      旗门: s.gates,
      甩尾: s.carves,
      撞岩脊: s.crashes,
      腾空: s.jumps,
      最高时速: game.topKmh(state),
      阶段: state.stageIndex + 1,
      被追上: state.gap <= 0
    });
  }
  const avg = (key) => rows.reduce((sum, r) => sum + r[key], 0) / rows.length;
  const worst = rows.reduce((a, b) => (b.米 < a.米 ? b : a));
  const best = rows.reduce((a, b) => (b.米 > a.米 ? b : a));
  return { tag: tag, rows: rows, 平均米: Math.round(avg('米')), 最差米: worst.米, 最好米: best.米, 平均旗门: +avg('旗门').toFixed(1), 平均甩尾: +avg('甩尾').toFixed(1), 平均撞脊: +avg('撞岩脊').toFixed(1) };
}

const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
const skilled = runProfile(SKILLED, seeds, '熟练玩家');
const casual = runProfile(CASUAL, seeds, '随手玩家');

/* ---------- 1. 随手玩家也得能玩下去 ---------- */
assert(
  casual.最差米 >= 900,
  '随手玩家最差只跑了 ' + casual.最差米 + ' 米，一开局就被雪崩吃掉可不行（至少 900 米）'
);
assert(
  casual.平均米 >= 1200,
  '随手玩家平均只有 ' + casual.平均米 + ' 米，起势太陡了'
);

/* ---------- 2. 技术要有回报 ---------- */
assert(
  skilled.平均米 > casual.平均米 * 1.15,
  '熟练玩家（' + skilled.平均米 + ' 米）应该明显强于随手玩家（' + casual.平均米 + ' 米）'
);

/* ---------- 3. 单局的各项指标都要在合理区间 ---------- */
assert(skilled.平均旗门 >= 6, '旗门平均只过了 ' + skilled.平均旗门 + ' 个，机制没被玩到');
assert(skilled.平均甩尾 >= 6, '甩尾平均只有 ' + skilled.平均甩尾 + ' 次，甩尾机制太难触发');
assert(skilled.平均撞脊 <= 8, '熟练玩家平均撞 ' + skilled.平均撞脊 + ' 次岩脊，躲避太苛刻');
assert(skilled.平均米 <= 9000, '一局能滑 ' + skilled.平均米 + ' 米，未免太长了');
assert(skilled.平均米 >= 1200, '熟练玩家平均只有 ' + skilled.平均米 + ' 米，太短了');
assert(casual.平均旗门 < skilled.平均旗门, '随手玩家拿到的旗门不该比熟练玩家还多');

/* ---------- 4. 可解性：岩脊的逃逸距离一定来得及横移过去 ---------- */
for (const seed of [1, 2, 3, 5, 8, 13, 21, 34]) {
  const state = game.createRun(content, seed * 7919 + 13);
  game.startRun(state);
  playHuman(state, seed * 131 + 7, SKILLED);
  for (const log of state.corridorLog) {
    assert(
      log.need <= log.reach + 0.001,
      '种子 ' + seed + '：逃逸要横移 ' + log.need.toFixed(1) + '，超过来得及的范围 ' + log.reach.toFixed(1)
    );
  }
}

/* ---------- 5. 难度曲线：雪崩越追越紧 ---------- */
for (let i = 1; i < content.stages.length; i++) {
  assert(
    content.stages[i].wallDrain >= content.stages[i - 1].wallDrain,
    '第 ' + (i + 1) + ' 段的雪崩没有比上一段更紧'
  );
  assert(
    content.stages[i].featureGap <= content.stages[i - 1].featureGap,
    '第 ' + (i + 1) + ' 段的障碍没有比上一段更密'
  );
}

fs.mkdirSync(path.join(ROOT, 'qa'), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, 'qa', 'balance-report.json'),
  JSON.stringify({ 熟练玩家: skilled, 随手玩家: casual }, null, 2)
);
console.log(JSON.stringify({ 熟练玩家: skilled, 随手玩家: casual }, null, 2));
console.log(
  '全部 PASS：随手玩家玩得下去、技术有回报、旗门与甩尾机制都能玩到、通道一定来得及横移、难度段逐段收紧'
);
