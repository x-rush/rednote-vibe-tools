/*
 * 毽子连击 · 真人玩家反应模型（三期：按 eazo 原版物理与判定闭环标定）
 *
 * 玩家模型（拍脑袋禁令的替代品）：
 *  - 反应延迟：随手玩家 uniform(180, 260) ms；熟练玩家 uniform(80, 120) ms。
 *  - 瞄准抖动：玩家想点在带中心，实际 tap 时刻 = 目标时刻 + 高斯抖动
 *    （随手 σ=70ms，熟练 σ=30ms）。
 *  - 策略：贪心瞄当前已解锁踢法里倍率最高的那一条带的中心。
 *  - 点空后重新调度：等毽子落进任意已解锁带 + 反应延迟再点；
 *    若下方已没有任何带中心 → 毽子落地，本局结束。
 *
 * 物理与判定复刻原版公式（reference/eazo-spec.txt）：
 *  - 阻力 s = 1.15*vy*|vy|*0.0016，vy += 760*dt - s*dt*60，vy>210 软钳制；
 *  - 踢击 vy = -560*power*(0.62+0.38*strength)；
 *  - 原版阻力符号缺陷使踢起仅数像素，毽子以约 83px/s 缓降穿过甜区带，
 *    带内即可反复点按（原版解压玩具属性），模拟只在纵轴上推进。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const content = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/content/content.json'), 'utf8').replace(/^\uFEFF/, '')
);

const PHY = content.meta.physics;
const STEP = 1 / 60; /* 与引擎帧步长一致：原版阻力缺陷是离散效应，细步长会失真 */
const MAX_RALLY = 300;
/* 原版物理运行在画布 CSS 像素空间，模拟用 390x780 标定视口 */
const FIELD_W = 390;
const FIELD_H = 780;
const PLAY_TOP = PHY.topSafe + 8;
const GROUND_Y = FIELD_H - PHY.bottomSafe - PHY.groundPad;
const PLAY_H = GROUND_Y - PLAY_TOP;

/* mulberry32：可复现的伪随机 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(seed) {
  const uniform01 = mulberry32(seed);
  let spare = null;
  return {
    uniform(lo, hi) {
      return lo + (hi - lo) * uniform01();
    },
    gauss(sigma) {
      if (spare !== null) {
        const v = spare;
        spare = null;
        return v * sigma;
      }
      let u = 0;
      let v = 0;
      while (u === 0) u = uniform01();
      while (v === 0) v = uniform01();
      const r = Math.sqrt(-2 * Math.log(u));
      const theta = 2 * Math.PI * v;
      spare = r * Math.sin(theta);
      return r * Math.cos(theta) * sigma;
    }
  };
}

function unlockedKicks(rally) {
  return content.meta.kicks.filter((k) => k.unlockRally <= rally);
}

function resolveBand(ny, rally) {
  let best = null;
  for (const kick of unlockedKicks(rally)) {
    const dist = Math.abs(ny - kick.bandCenter);
    if (dist <= kick.bandHalfWidth) {
      if (!best || kick.multiplier > best.kick.multiplier) {
        best = { kick, strength: 1 - dist / kick.bandHalfWidth };
      }
    }
  }
  return best;
}

function courtyardIndexFor(rally) {
  const yards = content.meta.courtyards;
  let index = 0;
  for (let i = 0; i < yards.length; i++) {
    if (yards[i].unlockRally <= rally) index = i;
  }
  return index;
}

/* 到达高度 targetY 还需多久；带内即可点（原版不分上升/下落支），
 * 这里取任意方向首次穿越 */
function timeToReach(y, vy, targetY) {
  let cy = y;
  let cvy = vy;
  let t = 0;
  const dt = 1 / 120;
  for (let i = 0; i < 4800; i++) {
    const drag = PHY.dragK * cvy * Math.abs(cvy) * PHY.dragUnit;
    cvy += (PHY.gravity - drag * PHY.dragTime) * dt;
    if (cvy > PHY.vySoftCap) cvy = PHY.vySoftCap + (cvy - PHY.vySoftCap) * PHY.vySoftKeep;
    const nextY = cy + cvy * dt;
    t += dt;
    if ((nextY >= targetY && cvy > 0) || (nextY <= targetY && cvy < 0)) return t;
    cy = nextY;
    if (cy >= GROUND_Y) return Infinity;
  }
  return Infinity;
}

/*
 * 模拟一局。profile: {
 *   reactionLo, reactionHi   响应窗口（秒）
 *   jitterSigma              瞄准抖动 σ（秒）
 *   pEarly                   冲动点按概率（不等带直接点，易点空）
 *   pLapse, lapseLo, lapseHi 走神概率与走神时长（秒）
 * }
 * 返回 { rally, combo, kicksUsed, maxMultiplier, courtyardIndex, whiffs, duration }。
 */
function simulateRun(profile, seed) {
  const rng = makeRng(seed);

  let rally = 0;
  let combo = 0;
  let bestCombo = 0;
  let whiffs = 0;
  let t = 0;
  let y = PLAY_TOP + PHY.serveNy * PLAY_H;
  let vy = PHY.serveVy;
  let duration = 0;
  const kicksUsed = [];
  let maxMultiplier = 0;

  let tapAt = -1; /* 已排定的 tap 时刻（秒），-1 = 尚未排定 */

  function nyNow() {
    return (y - PLAY_TOP) / PLAY_H;
  }

  function scheduleNextTap() {
    /* 注意力衰减：连得越多越容易上头乱点（真实随手玩家的有限局来源） */
    const earlyP = profile.pEarly + rally * profile.earlyPerRally;
    /* 冲动型：不等带，随机时刻就点（真实随手玩家的主要点空来源） */
    if (rng.uniform(0, 1) < earlyP) {
      tapAt = t + rng.uniform(0.18, 0.55);
      return;
    }
    /* 已在带内：反应过来就点（原版不分上升/下落支） */
    const resolvedNow = resolveBand(nyNow(), rally);
    if (resolvedNow) {
      tapAt = t + rng.uniform(profile.reactionLo, profile.reactionHi) * 0.4;
      return;
    }
    /* 否则瞄最近的已解锁带中心 */
    const kicks = unlockedKicks(rally);
    let bestTime = Infinity;
    for (const kick of kicks) {
      const centerY = PLAY_TOP + kick.bandCenter * PLAY_H;
      if (centerY === y) continue;
      const dt = timeToReach(y, vy, centerY);
      if (dt < bestTime) bestTime = dt;
    }
    if (bestTime === Infinity) {
      tapAt = -1;
      return;
    }
    let delay = bestTime + rng.uniform(profile.reactionLo, profile.reactionHi) + rng.gauss(profile.jitterSigma);
    /* 走神：偶尔多愣一会，落点滑出带沿 */
    if (rng.uniform(0, 1) < profile.pLapse) {
      delay += rng.uniform(profile.lapseLo, profile.lapseHi);
    }
    tapAt = t + Math.max(0.02, delay);
  }

  function doTap() {
    const ny = nyNow();
    const resolved = resolveBand(ny, rally);
    if (!resolved) {
      combo = 0;
      whiffs += 1;
      scheduleNextTap();
      return;
    }
    const kick = resolved.kick;
    const strength = resolved.strength;
    rally += 1;
    combo += 1;
    if (combo > bestCombo) bestCombo = combo;
    if (kicksUsed.indexOf(kick.id) < 0) kicksUsed.push(kick.id);
    if (kick.multiplier > maxMultiplier) maxMultiplier = kick.multiplier;

    vy = -PHY.kickV * kick.power * (PHY.kickPowerMin + PHY.kickPowerSpan * strength);
    scheduleNextTap();
  }

  scheduleNextTap();

  while (rally < MAX_RALLY) {
    const drag = PHY.dragK * vy * Math.abs(vy) * PHY.dragUnit;
    vy += (PHY.gravity - drag * PHY.dragTime) * STEP;
    if (vy > PHY.vySoftCap) {
      vy = PHY.vySoftCap + (vy - PHY.vySoftCap) * PHY.vySoftKeep;
    }
    y += vy * STEP;
    t += STEP;

    if (tapAt >= 0 && t >= tapAt) {
      tapAt = -1;
      doTap();
    }
    if (y >= GROUND_Y) {
      break;
    }
  }
  duration = t;

  return {
    rally,
    combo: bestCombo,
    kicksUsed,
    maxMultiplier,
    courtyardIndex: courtyardIndexFor(rally),
    whiffs,
    duration: +duration.toFixed(2)
  };
}

/* 跑一批并出统计 */
function simulateBatch(profile, runs, seedBase) {
  const rows = [];
  for (let i = 0; i < runs; i++) {
    rows.push(simulateRun(profile, seedBase + i * 7919));
  }
  const rallies = rows.map((r) => r.rally).sort((a, b) => a - b);
  const sum = rallies.reduce((a, b) => a + b, 0);
  const uniq = rows.map((r) => r.kicksUsed.length);
  const avgUniq = uniq.reduce((a, b) => a + b, 0) / rows.length;
  const maxMults = rows.map((r) => r.maxMultiplier);
  const avgMult = maxMults.reduce((a, b) => a + b, 0) / rows.length;
  return {
    runs,
    avgRally: +(sum / rows.length).toFixed(2),
    p50: rallies[Math.floor(runs * 0.5)],
    p90: rallies[Math.floor(runs * 0.9)],
    maxRally: rallies[rallies.length - 1],
    avgUniqueKicks: +avgUniq.toFixed(2),
    avgMaxMultiplier: +avgMult.toFixed(2),
    shareTwoKicks: +(rows.filter((r) => r.kicksUsed.length >= 2).length / rows.length).toFixed(3),
    shareYard2FirstRun: +(rows.filter((r) => r.courtyardIndex >= 1).length / rows.length).toFixed(3),
    shareYard5: +(rows.filter((r) => r.courtyardIndex >= 4).length / rows.length).toFixed(3),
    shareYard12: +(rows.filter((r) => r.courtyardIndex >= 11).length / rows.length).toFixed(3),
    avgWhiffs: +(rows.reduce((a, r) => a + r.whiffs, 0) / rows.length).toFixed(2),
    avgDuration: +(rows.reduce((a, r) => a + r.duration, 0) / rows.length).toFixed(1)
  };
}

const PROFILES = {
  /* 随手玩家：反应 180-260ms，抖动 σ70ms；12% 冲动点按（+每脚 0.2% 上头），10% 走神 */
  casual: {
    reactionLo: 0.18,
    reactionHi: 0.26,
    jitterSigma: 0.07,
    pEarly: 0.12,
    earlyPerRally: 0.002,
    pLapse: 0.1,
    lapseLo: 0.2,
    lapseHi: 0.55
  },
  /* 熟练玩家：反应 80-120ms，抖动 σ30ms；3% 冲动（+每脚 0.08%），2% 走神 */
  skilled: {
    reactionLo: 0.08,
    reactionHi: 0.12,
    jitterSigma: 0.03,
    pEarly: 0.03,
    earlyPerRally: 0.0008,
    pLapse: 0.02,
    lapseLo: 0.25,
    lapseHi: 0.45
  }
};

module.exports = {
  content,
  STEP,
  PLAY_TOP,
  GROUND_Y,
  PROFILES,
  simulateRun,
  simulateBatch
};

/* 直接运行时打印两个画像的标定结果 */
if (require.main === module) {
  const runs = Number(process.argv[2]) || 400;
  console.log('随手玩家(180-260ms, σ70):', JSON.stringify(simulateBatch(PROFILES.casual, runs, 20260101), null, 2));
  console.log('熟练玩家(80-120ms, σ30):', JSON.stringify(simulateBatch(PROFILES.skilled, runs, 31415000), null, 2));
}
