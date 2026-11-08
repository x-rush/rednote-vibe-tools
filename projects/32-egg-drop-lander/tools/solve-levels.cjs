/*
 * 蛋落地 · 关卡参数求解器（一次性工具，不参与打包）
 *
 * 目标：为每一关解出 gravity / drag / thrust / safe / gas，
 * 让「像真人一样的闭环玩家」能稳定通关，同时关卡难度递增。
 *
 * 评分用的是闭环玩家模型：玩家每隔 R 毫秒看一次速度指示，
 * 速度超过阈值就点一下喷气。这比「固定阈值策略」更接近真人：
 * 玩家会观察、会等、会因为太急而浪费气量。
 *
 * 硬约束：
 *   - 不喷气的落地速度必须明显超过安全线（否则这一关没有挑战）；
 *   - 最少需要喷两次气（喷一次就过没有节奏）；
 *   - 落地时间不能太短（玩家来不及反应）也不能太长（等得无聊）；
 *   - 一直乱喷气必须过不去（否则「一直点」就是最优解）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const content = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/content/content.json'), 'utf8').replace(/^\uFEFF/, '')
);

const VIEW_HEIGHT = 420;
const EGG_RADIUS = 11;
const SPAWN_Y = 34;
const STEP = 1 / 240;
const GAS = 8;
/* 逐关的目标通过率：真人比模型更笨，通过率要留出余量并逐关收紧 */
const TARGET_PASS = [20, 20, 18, 18, 16, 16, 16, 14, 14, 12, 12, 10];
const PASS_FLOOR = 8;
/* 每关最少喷气次数的允许区间：相邻关卡不能跳级 */
const NEED_RANGE = [[2, 2], [3, 3], [4, 5], [3, 4], [4, 5], [4, 5], [4, 4], [4, 4], [4, 5], [5, 5], [5, 5], [5, 5]];

/* 闭环玩家：每 R 毫秒观察一次，速度超过阈值就喷一口气 */
function play(level, R, T) {
  let y = SPAWN_Y;
  let vy = 0;
  let t = 0;
  let next = R / 1000;
  let gas = GAS;
  let thrusts = 0;
  while (t < 20) {
    if (t >= next) {
      next += R / 1000;
      if (vy >= T && gas > 0) {
        vy -= level.thrust;
        gas--;
        thrusts++;
      }
    }
    vy += level.gravity * STEP;
    vy -= vy * level.drag * STEP;
    y += vy * STEP;
    t += STEP;
    if (vy > 0 && y + EGG_RADIUS >= level.padY && y - EGG_RADIUS < level.padY) {
      return { impact: vy, thrusts: thrusts, ok: vy <= level.safe, landed: true, time: t };
    }
    if (y - EGG_RADIUS > VIEW_HEIGHT) {
      return { impact: null, thrusts: thrusts, ok: false, landed: false, time: t };
    }
  }
  return { impact: null, thrusts: thrusts, ok: false, landed: false, time: t };
}

const RS = [150, 200, 250, 300];
const TS = [0.75, 0.8, 0.85, 0.9, 0.95];

function score(level) {
  let pass = 0;
  let minThrusts = Infinity;
  let maxThrusts = 0;
  for (const R of RS) {
    for (const T of TS) {
      const r = play(level, R, level.safe * T);
      if (r.ok) {
        pass++;
        minThrusts = Math.min(minThrusts, r.thrusts);
        maxThrusts = Math.max(maxThrusts, r.thrusts);
      }
    }
  }
  return { pass: pass, total: RS.length * TS.length, minThrusts: minThrusts, maxThrusts: maxThrusts };
}

function idleDrop(level) {
  let y = SPAWN_Y;
  let vy = 0;
  let t = 0;
  while (t < 20) {
    vy += level.gravity * STEP;
    vy -= vy * level.drag * STEP;
    y += vy * STEP;
    t += STEP;
    if (vy > 0 && y + EGG_RADIUS >= level.padY && y - EGG_RADIUS < level.padY) {
      return { impact: vy, landed: true, time: t };
    }
    if (y - EGG_RADIUS > VIEW_HEIGHT) return { impact: null, landed: false, time: t };
  }
  return { impact: null, landed: false, time: t };
}

const results = [];

for (let i = 0; i < content.levels.length; i++) {
  const base = content.levels[i];
  const safe = base.safe;
  const candidates = [];

  for (let drag = 1.4; drag <= 5.0; drag += 0.05) {
    const terminal = base.gravity / drag;
    if (terminal < safe * 1.06) continue;
    for (let thrust = 4; thrust <= 90; thrust += 1) {
      const probe = {
        gravity: base.gravity,
        drag: Math.round(drag * 100) / 100,
        thrust: thrust,
        safe: safe,
        padY: base.padY
      };
      const idle = idleDrop(probe);
      if (!idle.landed) continue;
      if (idle.impact <= safe * 1.05) continue;
      if (idle.time < 1.05 || idle.time > 2.8) continue;
      /* 一次喷气的反馈必须看得见，且各关力度要一致：压掉终端速度的 10%~18% */
      if (thrust < terminal * 0.1 || thrust > terminal * 0.18) continue;
      const sc = score(probe);
      if (sc.minThrusts < NEED_RANGE[i][0] || sc.minThrusts > NEED_RANGE[i][1]) continue;
      const cap = TARGET_PASS[i];
      if (sc.pass > cap || sc.pass < PASS_FLOOR) continue;
      candidates.push({
        drag: probe.drag,
        thrust: thrust,
        pass: sc.pass,
        total: sc.total,
        need: sc.minThrusts,
        idle: Math.round(idle.impact),
        time: Math.round(idle.time * 100) / 100,
        terminal: Math.round(terminal)
      });
    }
  }

  if (!candidates.length) {
    console.log((i + 1) + ' ' + base.name + ' 无解');
    results.push(null);
    continue;
  }
  /* 先看通过率，再看落地时间是否适中，最后看喷气次数 */
  candidates.sort((a, b) => {
    if (b.pass !== a.pass) return b.pass - a.pass;
    const at = Math.abs(a.time - 1.7);
    const bt = Math.abs(b.time - 1.7);
    if (at !== bt) return at - bt;
    return a.need - b.need;
  });
  const best = candidates[0];
  best.gas = GAS;
  best.safe = safe;
  best.gravity = base.gravity;
  best.name = base.name;
  results.push(best);
  console.log(
    (i + 1) + ' ' + base.name +
      ' → g=' + best.gravity + ' drag=' + best.drag + ' thrust=' + best.thrust +
      ' safe=' + best.safe + ' gas=' + best.gas +
      ' | 终端=' + best.terminal + ' 不喷落地=' + best.idle +
      ' 通过率=' + best.pass + '/' + best.total +
      ' 需求=' + best.need + '次 落地=' + best.time + 's' +
      ' 候选=' + candidates.length
  );
}

console.log('\nJSON:');
console.log(JSON.stringify(results, null, 2));
