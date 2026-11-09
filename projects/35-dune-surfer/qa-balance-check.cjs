/*
 * 沙丘速降 · 平衡标定（三期严格复刻版 · 闭环真人模型）
 *
 * ⚠ 2026-11-09 三期「严格 1:1 复刻」后重置基线：
 *   玩法常量已锁死为 eazo 原版值（reference/eazo-spec.txt），
 *   本表只输出原版机制下的真人模型曲线，作为严格复刻版的新基线。
 *
 * 真人玩家模型（闭环；原版转向是橡皮筋：手指位置 = 拖拽目标）：
 *   熟练玩家：反应 100ms、手抖 ±6px、每面旗门都上心
 *   随手玩家：反应 240ms、手抖 ±12px、开局 6 秒必然上心，
 *             之后对每面旗门独立掷骰「伸不伸手去够」（约 1/4 专门去够，
 *             其余顺其自然只在赛道中段游荡，蹭到算运气）
 *   躺平玩家：完全不去够门，只在中段游荡（压力下限参照）
 *
 * 2026-11-09 标定输出（8 局，模拟上限 120 秒）：
 *   熟练：全部活满 120 秒（原版 endless：全穿把 ava 压回地板，压不死）
 *   随手：平均 6190 米 / 90.1 秒 / 旗门 89.4
 *   躺平：平均 1310 米 / 23.2 秒（不穿门 13.3 秒必死的曲线成立）
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname);
require(path.join(ROOT, 'src/game.js'));
const game = global.DuneGame;

const W = 390;
const H = 844;
const DT = 16.6; /* ms */
const HORIZON = 120000; /* 单局模拟上限（ms） */

const SKILLED = { latency: 100, jitter: 6, weave: 8, weaveFreq: 0.6, commit: 1, warmup: 0 };
const CASUAL = { latency: 240, jitter: 12, weave: 6, weaveFreq: 0.42, commit: 0.25, warmup: 6000 };
const IDLE = { latency: 240, jitter: 12, weave: 0, weaveFreq: 0, commit: 0, warmup: 0 };

/*
 * 闭环真人玩家：
 *   - 每 60ms「看一眼」局面，找最近的一面未判定旗门；
 *   - 决策带上反应延迟生效，落点带手抖；
 *   - 随手玩家对每面门独立决定去不去够：不去够的时候只在赛道中段游荡。
 */
function playHuman(state, seed, opt) {
  const rand = game.makeRandom(seed);
  const phase = rand() * Math.PI * 2;
  let nextDecision = 0;
  const commitMemo = {};
  const queue = [];
  const stats = { gates: 0, misses: 0 };
  let t = 0;
  game.setDrag(state, W / 2); /* 按下即激活（原版 pointerdown） */

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
      if (!commitMemo[key] && t >= opt.warmup) gate = null; /* 这面门不去够 */
    }
    if (!gate) {
      const wobble = opt.weave * Math.sin(t * opt.weaveFreq + phase);
      return game.clamp(
        W / 2 + wobble + (rand() - 0.5) * opt.jitter * 0.4,
        game.WALL_MARGIN + 4,
        W - game.WALL_MARGIN - 4
      );
    }
    return game.clamp(
      gate.x + (rand() - 0.5) * opt.jitter,
      game.WALL_MARGIN + 4,
      W - game.WALL_MARGIN - 4
    );
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

function runProfile(profile, seeds, tag) {
  const rows = [];
  for (const seed of seeds) {
    const state = game.createRun(W);
    state.rand = game.makeRandom(seed * 7919 + 13);
    game.startRun(state, W);
    const s = playHuman(state, seed * 131 + 7, profile);
    rows.push({
      seed: seed,
      米: game.meters(state),
      秒: +(s.time / 1000).toFixed(1),
      旗门: s.gates,
      错门: s.misses,
      顶满: !state.finished
    });
  }
  const avg = (key) => rows.reduce((sum, r) => sum + r[key], 0) / rows.length;
  const worst = rows.reduce((a, b) => (b.米 < a.米 ? b : a));
  return {
    tag: tag,
    rows: rows,
    平均米: Math.round(avg('米')),
    最差米: worst.米,
    平均秒: +avg('秒').toFixed(1),
    平均旗门: +avg('旗门').toFixed(1),
    平均错门: +avg('错门').toFixed(1),
    顶满局数: rows.filter((r) => r.顶满).length
  };
}

/* ---------- 1. ava 经济铁律（原版常量逐条锁定） ---------- */
assert.strictEqual(game.AVA_START, 0.42, '开局 ava 必须是 0.42');
assert.strictEqual(game.AVA_FLOOR, 0.12, '穿门地板必须是 0.12');
assert.strictEqual(game.AVA_DEATH, 0.98, '死亡线必须是 0.98');
assert.strictEqual(game.AVA_DRIFT, 42e-6, 'ava 恒定上涨必须是每毫秒 42e-6');
assert.strictEqual(game.AVA_PASS_RELIEF, 0.1, '穿门推回必须是 0.10');
assert.strictEqual(game.AVA_MISS_PENALTY, 0.07, '错门逼近必须是 0.07');

{
  /* 不穿门的死亡时间 ≈ 13.3 秒：(0.98−0.42)/0.042 */
  const deathTime = (0.98 - 0.42) / (42e-6 * 1000);
  assert(deathTime > 12 && deathTime < 15, '不穿门约 13.3 秒被追上（实际 ' + deathTime.toFixed(1) + ' 秒）');
}

/* ---------- 2. 转向/边界/速度铁律 ---------- */
assert.strictEqual(game.WALL_MARGIN, 30, '边界必须是 30 画布像素');
assert.strictEqual(game.BOUNCE_KEEP, 0.4, '反弹必须保留 0.4 倍横向速度');
assert.strictEqual(game.DRAG_GAIN, 55e-5, '转向增益必须是 55e-5');
assert.strictEqual(game.CARVE_DAMP, 0.93, '松手阻尼必须是每帧 0.93');
assert.strictEqual(game.SPEED_BASE, 0.4, '起步速度必须是 0.4');
assert.strictEqual(game.SPEED_BONUS_MAX, 0.28, '速度加成封顶必须是 0.28');
assert.strictEqual(game.SPEED_DIST_K, 16e-5, '速度加成斜率必须是 16e-5');
assert.strictEqual(game.METERS_PER_UNIT, 0.11, '米数换算必须是 ×0.11');
assert.strictEqual(game.DEAD_DELAY, 700, '被追上后 700ms 才结算');

/* ---------- 3. 旗门系统铁律 ---------- */
assert.strictEqual(game.GATE_SPACING_BASE, 300, '门距基数必须是 300');
assert.strictEqual(game.GATE_SPACING_RAND, 160, '门距随机幅度必须是 160');
assert.strictEqual(game.GATE_X_MIN, 0.22, '门位起点必须是 0.22×W');
assert.strictEqual(game.GATE_X_SPAN, 0.56, '门位跨度必须是 0.56×W（22%–78%）');
assert.strictEqual(game.GATE_PASS_HALF, 52, '穿门判定半宽必须是 ±52 画布像素');
assert.strictEqual(game.GATE_SEED, 400, '开局生成器初值必须是 400');

/* ---------- 4. 原版缺陷照抄：巡航状态也标记门，但不计分 ---------- */
{
  const st = game.createRun(W);
  st.rand = game.makeRandom(7);
  game.startRun(st, W);
  const gate = st.gateList[0];
  gate.x = st.x;
  let t = 0;
  while (gate.passed === 0 && t < 20000) {
    game.step(st, DT, { width: W, height: H, mode: 'cruise', now: t });
    t += DT;
  }
  assert.ok(gate.passed !== 0, '巡航时到线的门也会被标记（原版缺陷必须保留）');
  assert.strictEqual(st.gates, 0, '但巡航不计分');
}

/* ---------- 5. 真人模型曲线 ---------- */
const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
const skilled = runProfile(SKILLED, seeds, '熟练玩家');
const casual = runProfile(CASUAL, seeds, '随手玩家');
const idle = runProfile(IDLE, seeds, '躺平玩家');

/* 躺平玩家：验证「不参与就得死」的压力下限 */
assert(
  idle.平均秒 < 30,
  '躺平玩家应该很快被追上（平均 ' + idle.平均秒 + ' 秒，需 < 30 秒）'
);
assert.strictEqual(
  idle.顶满局数, 0,
  '躺平玩家不应该有任何一局活满模拟上限'
);

/* 随手玩家：能玩下去，压力真实存在 */
assert(
  casual.平均秒 >= 40,
  '随手玩家平均只活了 ' + casual.平均秒 + ' 秒（至少 40 秒）'
);
assert(
  casual.平均米 >= 2000,
  '随手玩家平均只滑了 ' + casual.平均米 + ' 米（至少 2000 米）'
);
assert(
  casual.平均旗门 >= 30,
  '随手玩家平均只穿 ' + casual.平均旗门 + ' 面旗门（至少 30 面）'
);
assert(
  casual.最差米 >= 800,
  '随手玩家最差一局只有 ' + casual.最差米 + ' 米（至少 800 米）'
);

/* 熟练玩家：全穿把 ava 压回地板 → 原版 endless 曲线（活满模拟上限） */
assert(
  skilled.顶满局数 >= 6,
  '熟练玩家应该基本活满模拟上限（顶满 ' + skilled.顶满局数 + '/8 局）'
);
assert(
  skilled.平均米 >= 8000,
  '熟练玩家平均只滑了 ' + skilled.平均米 + ' 米（至少 8000 米）'
);
assert(
  skilled.平均旗门 > casual.平均旗门,
  '熟练玩家的穿门数不该比随手玩家少'
);
assert(
  skilled.平均米 > casual.平均米 * 1.5,
  '熟练玩家（' + skilled.平均米 + ' 米）相对随手玩家（' + casual.平均米 + ' 米）没有明显拉开感'
);

/* ---------- 6. 可解性：门距、门位在真人局内始终成立 ---------- */
for (const seed of [1, 2, 3, 5, 8, 13, 21, 34]) {
  const st = game.createRun(W);
  st.rand = game.makeRandom(seed * 7919 + 13);
  game.startRun(st, W);
  game.ensureGates(st, 30000, W);
  const seen = [];
  for (const f of st.gateList) {
    assert(
      f.x >= W * 0.22 - 0.01 && f.x <= W * 0.78 + 0.01,
      '种子 ' + seed + '：门位 ' + f.x.toFixed(1) + ' 超出画布宽 22%–78%'
    );
    seen.push(f.y);
  }
  for (let i = 1; i < seen.length; i++) {
    const d = seen[i] - seen[i - 1];
    assert(
      d >= 300 - 0.01 && d <= 460 + 0.01,
      '种子 ' + seed + '：门距 ' + d.toFixed(1) + ' 不在 300–460 内'
    );
  }
}

/* ---------- 输出：严格复刻版数值表（新基线） ---------- */
function table(p) {
  const lines = [];
  lines.push(p.tag + '（8 局）：');
  lines.push('  seed   滑降米   存活秒   旗门   错门   顶满');
  for (const r of p.rows) {
    lines.push(
      '  ' + String(r.seed).padEnd(6, ' ') +
      String(r.米).padStart(6, ' ') + '   ' +
      String(r.秒).padStart(6, ' ') + '   ' +
      String(r.旗门).padStart(5, ' ') + '   ' +
      String(r.错门).padStart(4, ' ') + '   ' +
      (r.顶满 ? '是' : '否')
    );
  }
  lines.push(
    '  合计   平均 ' + p.平均米 + ' 米 / ' + p.平均秒 + ' 秒 / 旗门 ' + p.平均旗门 +
    ' / 最差 ' + p.最差米 + ' 米 / 顶满 ' + p.顶满局数 + ' 局'
  );
  return lines.join('\n');
}

const report = {
  注: '三期严格复刻（eazo 原版常量）后重置基线，2026-11-09',
  常量: {
    ava: { start: game.AVA_START, floor: game.AVA_FLOOR, death: game.AVA_DEATH, driftPerMs: game.AVA_DRIFT, passRelief: game.AVA_PASS_RELIEF, missPenalty: game.AVA_MISS_PENALTY },
    gate: { spacingBase: game.GATE_SPACING_BASE, spacingRand: game.GATE_SPACING_RAND, xMin: game.GATE_X_MIN, xSpan: game.GATE_X_SPAN, passHalf: game.GATE_PASS_HALF, seed: game.GATE_SEED },
    steer: { wallMargin: game.WALL_MARGIN, bounceKeep: game.BOUNCE_KEEP, dragGain: game.DRAG_GAIN, carveDamp: game.CARVE_DAMP },
    speed: { base: game.SPEED_BASE, bonusMax: game.SPEED_BONUS_MAX, distK: game.SPEED_DIST_K, metersPerUnit: game.METERS_PER_UNIT }
  },
  熟练玩家: skilled,
  随手玩家: casual,
  躺平玩家: idle
};
fs.mkdirSync(path.join(ROOT, 'qa'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'qa', 'balance-report.json'), JSON.stringify(report, null, 2));

console.log('=== 平衡标定数值表（三期严格复刻基线）===');
console.log(table(skilled));
console.log('');
console.log(table(casual));
console.log('');
console.log(table(idle));
console.log('');
console.log(
  '全部 PASS：ava 经济常量锁定（0.42 开局 / +42e-6 每毫秒 / 穿门 −0.10 地板 0.12 / 错门 +0.07 / 0.98 死）；' +
  '门距 300–460 / 门位 22%–78% / 判定 ±52px；转向 55e-5·阻尼 0.93·边界 30 反弹 0.4；' +
  '速度 0.4+min(0.28, 16e-5·dist)；躺平 ' + idle.平均秒 + ' 秒死、随手 ' + casual.平均秒 + ' 秒 / ' + casual.平均米 +
  ' 米 / 旗门 ' + casual.平均旗门 + '、熟练顶满 ' + skilled.顶满局数 + '/8 局拉开 ' +
  (skilled.平均米 / casual.平均米).toFixed(2) + '×'
);
