/*
 * 蛋落地 · 关卡模拟模型（供 qa-balance-check 使用）
 *
 * 物理与判定直接调用 src/game.js（initDropState / pulse / step / registerResult），
 * 保证模型与游戏本体零漂移 —— 模拟器里的一次点按就是真实的一发反推。
 *
 * 复刻后的点按是纯竖直（原版 t.vy -= l.impulse，无水平分量），因此玩家模型
 * 没有转向：是否穿过障碍带缺口完全由风与初始漂移决定 —— 这正是原版的命运感。
 *
 * 玩家模型是「闭环真人（承诺式刹车）」：每隔 R 毫秒观察一次，平时不动手；
 * 通过前瞻模拟比较「现在就开始连点 vs 再等等」的预计落速，一旦开始刹车
 * 就连点到底（承诺式级联）。T 是懒惰度（越懒越晚肯开始），R 是反应间隔
 * （越慢越容易错过窗口）。
 *
 * 两个口径：
 *   casual —— 随手玩家：反应 180–260ms，阈值 0.75–1.0×限速（4×5 = 20 组）；
 *   pro    —— 熟练玩家：反应 80–120ms，阈值 0.78–0.92×限速（2×3 = 6 组）。
 */
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
require(path.join(ROOT, 'src/game.js'));

const game = global.EggGame;
const STEP = 1 / 240;

/* 随手玩家网格：4 种反应 × 5 种阈值 = 20 组（通过率按 x/20 汇报） */
const RS_CASUAL = [0.18, 0.205, 0.23, 0.26];
const TS_CASUAL = [0.75, 0.82, 0.88, 0.94, 1.0];
/* 熟练玩家网格：2 × 3 = 6 组 */
const RS_PRO = [0.08, 0.12];
const TS_PRO = [0.78, 0.85, 0.92];
const TOTAL_CASUAL = RS_CASUAL.length * TS_CASUAL.length;
const TOTAL_PRO = RS_PRO.length * TS_PRO.length;

function clamp(v, lo, hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

/* 复制一个可独立推进的落次状态（前瞻模拟用） */
function cloneState(state) {
  return {
    level: state.level,
    phase: state.phase,
    time: state.time,
    pulses: state.pulses,
    usedObstacle: state.usedObstacle,
    egg: {
      x: state.egg.x, y: state.egg.y,
      vx: state.egg.vx, vy: state.egg.vy,
      spin: state.egg.spin, crack: state.egg.crack, jet: 0
    }
  };
}

/*
 * 前瞻模拟（承诺式级联）：从当前状态出发，延迟 delay 后开始每隔 fireEvery
 * 点一发、直到脉冲耗尽，返回预计落地速度（摔碎 → Infinity）。
 * 「承诺」意味着一旦开始刹车就点到底 —— 与真实玩家的连点直觉一致。
 */
function forecast(state, delay, fireEvery) {
  const sim = cloneState(state);
  let t = 0;
  let next = delay;
  const FSTEP = 1 / 120;
  while (t < 30) {
    if (t >= next && sim.pulses > 0) {
      next += fireEvery;
      /* 蛋还没重新加速时点一发是纯浪费（甚至有害）——真人不会这么点 */
      if (sim.phase === 'falling' && sim.egg.vy >= 0.5 * sim.level.impulse) {
        game.pulse(sim);
      }
    }
    const event = game.step(sim, FSTEP);
    t += FSTEP;
    /* 撞带只折损脉冲，蛋继续下落；只有落地（landed）才终结前瞻 */
    if (event && event.type === 'landed') {
      return event.grade === 'broken' ? Infinity : event.speed;
    }
  }
  return Infinity;
}

/*
 * 一次闭环观察：决定要不要点。真人策略（承诺式刹车）：
 *   - 平时不动手；当「现在就开始连点」比「再等等才开始」预计落速明显更轻
 *     （或再等必碎）时，开始承诺式级联（之后每拍连点直到脉冲耗尽）；
 *   - T 是「懒惰度」：懒惰的玩家会多等几拍才肯开始（0.75 起步 → 1.0 最懒）。
 */
function observe(state, R, T, braking) {
  if (state.phase !== 'falling') return null;
  if (state.pulses <= 0) return null;

  /* 承诺式级联：一旦开始就连点到底，但蛋没重新加速时不出手 */
  if (braking) {
    if (state.egg.vy < 0.5 * state.level.impulse) return null;
    return { braking: true };
  }

  const laziness = clamp((T - TS_CASUAL[0]) / (TS_CASUAL[TS_CASUAL.length - 1] - TS_CASUAL[0]), 0, 1);
  const maxWait = 1 + Math.round(laziness * 3);
  const fireNow = forecast(state, 0, R);
  let bestLater = Infinity;
  for (let w = 1; w <= maxWait; w++) {
    const v = forecast(state, w * R, R);
    if (v < bestLater) bestLater = v;
  }
  /* 现在点必须严格更好（脱离必碎，或明显更轻） */
  if (!Number.isFinite(bestLater) && Number.isFinite(fireNow)) {
    return { braking: true };
  }
  if (fireNow < bestLater - 1) {
    return { braking: true };
  }
  return null;
}

/*
 * 完整打完一关。返回：
 *   { grade, speed, pulsesLeft, pulsesUsed, ok, smash, time }
 */
function play(level, R, T) {
  const state = game.initDropState(level);
  let t = 0;
  let next = R;
  let braking = false;
  while (t < 30) {
    if (t >= next) {
      next += R;
      const decision = observe(state, R, T, braking);
      if (decision) {
        game.pulse(state);
        braking = braking || decision.braking;
      }
    }
    const event = game.step(state, STEP);
    t += STEP;
    if (event && event.type === 'landed') {
      return {
        grade: event.grade,
        speed: event.speed,
        pulsesLeft: event.pulsesLeft,
        pulsesUsed: level.pulses - event.pulsesLeft,
        ok: event.grade !== 'broken',
        time: t
      };
    }
  }
  return {
    grade: 'broken',
    speed: Infinity,
    pulsesLeft: state.pulses,
    pulsesUsed: level.pulses - state.pulses,
    ok: false,
    timeout: true,
    time: t
  };
}

/* 一关在一组网格上的通过率与反推用量 */
function playGrid(level, RS, TS) {
  let pass = 0;
  let usedSum = 0;
  let usedCount = 0;
  for (const R of RS) {
    for (const T of TS) {
      const r = play(level, R, T);
      if (r.ok) {
        pass += 1;
        usedSum += r.pulsesUsed;
        usedCount += 1;
      }
    }
  }
  return {
    pass: pass,
    total: RS.length * TS.length,
    meanUsed: usedCount ? usedSum / usedCount : null
  };
}

function casualScore(level) {
  return playGrid(level, RS_CASUAL, TS_CASUAL);
}

function proScore(level) {
  return playGrid(level, RS_PRO, TS_PRO);
}

/* 完全不点：必须摔碎（没有动作就没有挑战） */
function idleDrop(level) {
  const state = game.initDropState(level);
  let t = 0;
  while (t < 30) {
    const event = game.step(state, STEP);
    t += STEP;
    if (event && event.type === 'landed') {
      return { grade: event.grade, speed: event.speed, ok: event.grade !== 'broken', time: t };
    }
  }
  return { grade: 'broken', speed: Infinity, ok: false, timeout: true, time: t };
}

/* 狂点（每 0.12s 一发）：必须摔碎 —— 「一直点」不是最优解 */
function spamDrop(level) {
  const state = game.initDropState(level);
  let t = 0;
  let next = 0.12;
  let fired = 0;
  while (t < 30) {
    if (t >= next) {
      next += 0.12;
      if (game.pulse(state).type === 'pulse') fired += 1;
    }
    const event = game.step(state, STEP);
    t += STEP;
    if (event && event.type === 'landed') {
      return { grade: event.grade, speed: event.speed, ok: event.grade !== 'broken', fired: fired, time: t };
    }
  }
  return { grade: 'broken', speed: Infinity, ok: false, fired: fired, timeout: true, time: t };
}

/*
 * 十二关整轮：每个 casual 组合从第 1 关打到第 12 关（失败不重试，直接进下一关，
 * 与「幸存落数」口径一致）。返回逐人幸存数、末关通过数、末关反推用量。
 */
function runCasual(content) {
  const survivedList = [];
  let finalPass = 0;
  let finalUsedSum = 0;
  for (const R of RS_CASUAL) {
    for (const T of TS_CASUAL) {
      let survived = 0;
      let lastResult = null;
      for (const level of content.levels) {
        const r = play(level, R, T);
        if (r.ok) survived += 1;
        lastResult = r;
      }
      survivedList.push(survived);
      if (lastResult && lastResult.ok) finalPass += 1;
      if (lastResult) finalUsedSum += lastResult.pulsesUsed;
    }
  }
  const mean = survivedList.reduce((a, b) => a + b, 0) / survivedList.length;
  return {
    survivedList: survivedList,
    meanSurvived: mean,
    minSurvived: Math.min.apply(null, survivedList),
    finalPass: finalPass,
    finalTotal: TOTAL_CASUAL,
    finalMeanUsed: finalUsedSum / survivedList.length
  };
}

/*
 * 点按反馈量化：点下当帧（还没走任何积分步）竖直速度的变化，
 * 必须恰好等于 -impulse（0 延迟）。
 */
function tapResponse(level) {
  const state = game.initDropState(level);
  state.phase = 'falling';
  state.egg.vy = level.maxSpeed * 0.8;
  const before = state.egg.vy;
  const event = game.pulse(state);
  return {
    type: event.type,
    sameFrameDelta: state.egg.vy - before,
    pulsesLeft: state.pulses,
    impulse: level.impulse
  };
}

module.exports = {
  game: game,
  STEP: STEP,
  RS_CASUAL: RS_CASUAL,
  TS_CASUAL: TS_CASUAL,
  RS_PRO: RS_PRO,
  TS_PRO: TS_PRO,
  TOTAL_CASUAL: TOTAL_CASUAL,
  TOTAL_PRO: TOTAL_PRO,
  play: play,
  playGrid: playGrid,
  casualScore: casualScore,
  proScore: proScore,
  idleDrop: idleDrop,
  spamDrop: spamDrop,
  runCasual: runCasual,
  tapResponse: tapResponse,
  forecast: forecast,
  observe: observe
};
