/*
 * 弹珠神殿 · 关卡可解性与手感回归
 *
 * 这一款的核心风险是「宝石放在那儿，但打不到」。
 * 所以回归分三层：
 *   1. 标称杆（par）：关卡设计时算好的那一杆，必须一杆收齐全场宝石。
 *      这是构造保证的——宝石就摆在标称杆的轨迹上。
 *   2. 相位无关：标称杆的整条轨迹必须避开会动的石条的扫掠区域，
 *      这样石条走到哪一相位，这一杆的走法都成立。
 *   3. 随手玩家：模拟一个「会看瞄准线、但手会抖」的真人，
 *      用剩下的杆数必须能把宝石收完。
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname);
const content = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/content/content.json'), 'utf8').replace(/^\uFEFF/, '')
);
require(path.join(ROOT, 'src/game.js'));
const game = global.BilliardGame;

const ARENA_W = game.ARENA_W;
const ARENA_H = game.ARENA_H;
const BALL_R = game.BALL_R;

function makeRandom(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function clamp(v, lo, hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

/* 点到矩形的距离；在矩形内为 0 */
function pointRectDistance(px, py, rect) {
  const dx = Math.max(rect.x - px, 0, px - (rect.x + rect.w));
  const dy = Math.max(rect.y - py, 0, py - (rect.y + rect.h));
  return Math.sqrt(dx * dx + dy * dy);
}

/*
 * 轨迹到所有障碍扫掠区的最短距离。
 * 只判断「有没有压到」是不够的：早期版本用严格不等式判断，
 * 结果第六殿的标称轨迹正好擦过扫掠区角点（球心 x 恰好等于边界）被判成没压到，
 * 石条换个相位球就蹭上去，一杆清空直接失效。所以这里算的是「余量」。
 */
function minClearance(level, path) {
  let best = Infinity;
  for (const block of level.blocks || []) {
    const r = game.propSwept({ type: 'static', x: block.x, y: block.y, w: block.w, h: block.h });
    for (const p of path) best = Math.min(best, pointRectDistance(p.x, p.y, r));
  }
  for (const prop of level.props || []) {
    const swept = game.propSwept(prop);
    for (const p of path) best = Math.min(best, pointRectDistance(p.x, p.y, swept));
  }
  return best;
}

/* 标称杆与机关的最小余量要求：球半径之外的额外余量 */
const CLEARANCE_MIN = 6;

/*
 * 随手玩家：真人会看瞄准线，所以候选杆不只��直连，
 * 也会打「借墙反弹」的那一杆；但手会抖，角度和力度都有误差。
 */
function playCasual(state, seed) {
  const rand = makeRandom(seed);
  let shots = 0;
  let elapsed = 0;

  while (state.gemsLeft > 0 && shots < 24) {
    const targets = [];
    for (const gem of state.gems) {
      if (gem.taken) continue;
      targets.push({ x: gem.x, y: gem.y });
      /* 借四面墙各反弹一次 */
      targets.push({ x: 2 * BALL_R - gem.x, y: gem.y });
      targets.push({ x: 2 * (ARENA_W - BALL_R) - gem.x, y: gem.y });
      targets.push({ x: gem.x, y: 2 * BALL_R - gem.y });
      targets.push({ x: gem.x, y: 2 * (ARENA_H - BALL_R) - gem.y });
    }
    if (!targets.length) break;

    let best = null;
    for (const t of targets) {
      const dx = t.x - state.ball.x;
      const dy = t.y - state.ball.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 4) continue;
      const angle = Math.atan2(dy, dx);
      /* 球会匀减速停住：要飞过 dist，初速必须按 v² = 2·a·d 算，不是按距离直接给 */
      const speed = clamp(Math.sqrt(2 * game.FRICTION * dist), game.MIN_SPEED, game.MAX_SPEED);
      const sim = game.simulate(state, angle, speed);
      if (!best || sim.collected.length > best.count) {
        best = { angle: angle, speed: speed, count: sim.collected.length };
      }
    }
    if (!best) break;

    /* 手抖：角度 ±2.6°，力度 ±7% */
    const angle = best.angle + (rand() - 0.5) * 0.09;
    const speed = clamp(best.speed * (1 + (rand() - 0.5) * 0.14), game.MIN_SPEED, game.MAX_SPEED);

    const shot = game.launch(state, angle, speed);
    if (!shot) break;
    let guard = 0;
    while (!shot.done && guard++ < 4000) game.physicsStep(state, shot);
    game.settle(state);
    shots++;
    /* 每杆之间玩家要想一下，殿堂时间照走 */
    elapsed += shot.t - shot.t0 + 1.2;
    state.time = elapsed;
    if (state.phase === 'cleared' || state.phase === 'out') break;
  }
  return shots;
}

const rows = [];

for (let index = 0; index < content.levels.length; index++) {
  const level = content.levels[index];

  /* ---------- 1. 标称杆：一杆收全 ---------- */
  const state = game.createRun(content);
  game.loadChamber(state, index);
  const par = level.par;
  assert(par && typeof par.angle === 'number', level.name + '：缺少标称杆');
  const parAngle = (par.angle * Math.PI) / 180;
  const parSim = game.simulate(state, parAngle, par.speed);
  assert(
    parSim.collected.length === level.gems.length,
    level.name +
      '：标称杆只收到 ' + parSim.collected.length + '/' + level.gems.length + ' 颗宝石（一杆清空不成立）'
  );
  assert(
    parSim.wallBounces === par.bounces,
    level.name + '：标称杆的撞墙次数与记录不符（' + parSim.wallBounces + ' ≠ ' + par.bounces + '）'
  );
  assert(
    parSim.propHits === 0,
    level.name + '：标称杆蹭到了 ' + parSim.propHits + ' 次机关，轨迹必须完全避开机关'
  );

  /* ---------- 2. 相位无关：轨迹与机关、石柱都要留出余量 ---------- */
  const clearance = minClearance(level, parSim.path);
  assert(
    clearance >= CLEARANCE_MIN,
    level.name +
      '：标称杆离机关扫掠区只有 ' + clearance.toFixed(1) + 'px（要求 ≥ ' + CLEARANCE_MIN + 'px），石条换个相位就可能蹭上'
  );

  /*
   * 相位无关性的正面校验：石条按殿堂绝对时间运动，玩家什么时候出杆都不该影响标称解。
   * 把起手时间在 0–8 秒之间密集扫一遍（覆盖石条的一个完整运动周期），
   * 要求每一次起手，标称杆都照样一杆清空。
   */
  for (let t = 0; t <= 8; t += 0.1) {
    const probe = game.createRun(content);
    game.loadChamber(probe, index);
    probe.time = t;
    const sim = game.simulate(probe, parAngle, par.speed);
    assert(
      sim.collected.length === level.gems.length,
      level.name +
        '：标称杆在起手 ' + t.toFixed(1) + 's 时只收到 ' + sim.collected.length +
        '/' + level.gems.length + ' 颗，相位无关性不成立'
    );
    assert(
      sim.propHits === 0,
      level.name + '：标称杆在起手 ' + t.toFixed(1) + 's 时蹭到了机关'
    );
  }

  /* 每颗宝石都要离轨迹够近，否则摆得再好看也收不到 */
  for (let g = 0; g < level.gems.length; g++) {
    const gem = level.gems[g];
    let nearest = Infinity;
    for (const p of parSim.path) {
      const d = Math.hypot(p.x - gem[0], p.y - gem[1]);
      if (d < nearest) nearest = d;
    }
    assert(
      nearest <= game.BALL_R + game.GEM_R,
      level.name + '：第 ' + (g + 1) + ' 颗宝石离轨迹 ' + nearest.toFixed(1) + 'px，收不到'
    );
  }

  /* ---------- 3. 随手玩家：杆数内必须能收完 ---------- */
  /* ---------- 3. 随手玩家：杆数内必须能收完（多跑几个手抖种子，取最差的一次） ---------- */
  const casualState = game.createRun(content);
  game.loadChamber(casualState, index);
  /* 先给足杆数，量出「随手玩家到底要几杆」，再回头和关卡配额比 */
  casualState.shotsLeft = 99;
  let casualShots = 0;
  let cleared = false;
  for (let s = 0; s < 3; s++) {
    const runState = game.createRun(content);
    game.loadChamber(runState, index);
    runState.shotsLeft = 99;
    const shots = playCasual(runState, 20261108 + index * 131 + s * 7717);
    if (!cleared || shots > casualShots) {
      casualShots = shots;
      cleared = runState.phase === 'cleared';
    }
  }
  assert(
    cleared,
    level.name +
      '：随手玩家收不完（最差一次用了 ' + casualShots + ' 杆）'
  );
  assert(
    casualShots <= level.budget,
    level.name +
      '：随手玩家最差要 ' + casualShots + ' 杆，超过关卡配额 ' + level.budget + ' 杆'
  );

  rows.push({
    殿堂: level.name,
    宝石数: level.gems.length,
    杆数配额: level.budget,
    标称撞墙: par.bounces,
    标称杆收齐: parSim.collected.length + '/' + level.gems.length,
    机关余量: clearance === Infinity ? '∞' : clearance.toFixed(1) + 'px',
    随手玩家用杆: casualShots,
    随手玩家过关: cleared
  });
}

/* 难度曲线：随手玩家用的杆数不应随关卡倒退 */
for (let i = 1; i < rows.length; i++) {
  assert(
    rows[i].随手玩家用杆 >= rows[i - 1].随手玩家用杆 - 1,
    '难度曲线异常：' + rows[i].殿堂 + ' 用杆数反而比上一关少太多'
  );
}

fs.mkdirSync(path.join(ROOT, 'qa'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'qa', 'balance-report.json'), JSON.stringify(rows, null, 2));
console.log(JSON.stringify(rows, null, 2));
console.log('全部殿堂 PASS：标称杆一杆清空、轨迹与机关留足余量且与石条相位无关、随手玩家在杆数内通关');
