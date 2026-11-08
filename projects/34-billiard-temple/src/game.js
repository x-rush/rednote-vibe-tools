/*
 * 弹珠神殿 · 玩法逻辑
 *
 * 一颗翠玉弹珠在殿堂里弹跳：拖拽瞄准、松手发射，球撞墙反弹并沿路收集宝石，
 * 房间里的宝石收齐就算过关，但杆数有限。
 *
 * 两套运动必须分清：
 *   1. 球：真实物理。直线减速、撞墙按恢复系数反弹、切向有损失，停下来就停在那儿。
 *   2. 障碍（滑块 / 转闸）：会动。位置随本次飞行的时间变化，所以同一个杆在不同时间打出去，
 *      走位可能不同——这也是「宝石要留在可行位置」必须靠模拟验证的原因。
 *
 * 坐标系是固定的虚拟画布（ARENA_W × ARENA_H），渲染层再等比缩放到屏幕。
 * 所有物理都用固定步长 DT 推进，保证「求解器算的」和「玩家打的」是同一条轨迹。
 */
(function (root) {
  'use strict';

  var ARENA_W = 300;
  var ARENA_H = 480;
  var BALL_R = 7;
  var GEM_R = 10;
  var FRICTION = 430;        /* 每秒减速（虚拟像素/秒²） */
  var RESTITUTION = 0.88;    /* 墙面恢复系数 */
  var TANGENT_LOSS = 0.97;   /* 墙面切向损失 */
  var STOP_SPEED = 16;       /* 低于这个速度就停 */
  var MIN_SPEED = 150;
  var MAX_SPEED = 880;
  var MAX_DRAG = 150;        /* 拖拽多长算满力 */
  var DT = 1 / 240;          /* 固定步长：最远一帧位移 3.7px < 球半径 */

  function clamp(v, lo, hi) {
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
  }

  function createRun(content) {
    var state = {
      content: content,
      levelIndex: 0,
      level: null,
      ball: { x: 0, y: 0, vx: 0, vy: 0 },
      shot: null,
      gems: [],
      gemsLeft: 0,
      shotsLeft: 0,
      shotsUsed: 0,
      score: 0,
      cleared: [],
      best: null,
      phase: 'aim',
      settled: false,
      time: 0,
      lastEvents: []
    };
    loadChamber(state, 0);
    return state;
  }

  function loadChamber(state, index) {
    var levels = state.content.levels;
    var next = clamp(index, 0, levels.length - 1);
    state.levelIndex = next;
    state.level = levels[next];
    state.ball.x = state.level.ball[0];
    state.ball.y = state.level.ball[1];
    state.ball.vx = 0;
    state.ball.vy = 0;
    state.shot = null;
    state.gems = [];
    state.gemsLeft = 0;
    for (var i = 0; i < state.level.gems.length; i++) {
      var g = state.level.gems[i];
      state.gems.push({ x: g[0], y: g[1], taken: false, order: i });
      state.gemsLeft++;
    }
    state.shotsLeft = state.level.budget;
    state.shotsUsed = 0;
    state.phase = 'aim';
    state.settled = false;
    state.time = 0;
    state.lastEvents = [];
    return state;
  }

  /* ---------- 障碍 ---------- */
  /* 障碍分两类：固定的石柱（blocks）与会动的石条（props）。 */
  /* 石条位置随飞行时间变化：slide 沿轴往复 */
  function propRect(prop, t) {
    var w = prop.w;
    var h = prop.h;
    if (prop.type === 'slide') {
      var offset = Math.sin(t * prop.speed + prop.phase) * prop.range;
      if (prop.axis === 'x') return { x: prop.x + offset, y: prop.y, w: w, h: h };
      return { x: prop.x, y: prop.y + offset, w: w, h: h };
    }
    return { x: prop.x, y: prop.y, w: w, h: h };
  }

  /* 障碍的扫掠区域：不论石条在哪一相位，球都不能穿过去 */
  function propSwept(prop) {
    if (prop.type === 'slide') {
      if (prop.axis === 'x') {
        return { x: prop.x - prop.range - BALL_R, y: prop.y - BALL_R, w: prop.w + prop.range * 2 + BALL_R * 2, h: prop.h + BALL_R * 2 };
      }
      return { x: prop.x - BALL_R, y: prop.y - prop.range - BALL_R, w: prop.w + BALL_R * 2, h: prop.h + prop.range * 2 + BALL_R * 2 };
    }
    return { x: prop.x - BALL_R, y: prop.y - BALL_R, w: prop.w + BALL_R * 2, h: prop.h + BALL_R * 2 };
  }

  /* 某一时刻场上的所有矩形：固定石柱 + 会动的石条 */
  function levelRects(state, t) {
    var rects = [];
    var blocks = state.level.blocks || [];
    for (var i = 0; i < blocks.length; i++) rects.push(blocks[i]);
    var props = state.level.props || [];
    for (var j = 0; j < props.length; j++) rects.push(propRect(props[j], t));
    return rects;
  }

  /* ---------- 一次击球 ---------- */
  /*
   * 击球时刻 state.time 就是这一杆的起始时刻：
   * 会动的石条按「殿堂内的绝对时间」走，所以玩家的瞄准快慢不影响石条位置，
   * 但这杆的走位仍然可复算——关卡设计已经把「解」摆成与石条相位无关的路径。
   */
  function makeShot(state, angle, speed) {
    var start = state.time || 0;
    return {
      x: state.ball.x,
      y: state.ball.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      t: start,
      t0: start,
      path: [{ x: state.ball.x, y: state.ball.y }],
      collected: [],
      bounces: 0,
      wallBounces: 0,
      propHits: 0,
      done: false,
      reason: '',
      acc: 0
    };
  }

  /* 球与障碍的碰撞：把球推出障碍并按法线反弹 */
  function hitProp(state, shot, rect) {
    var nx = shot.x;
    var ny = shot.y;
    var cx = clamp(nx, rect.x, rect.x + rect.w);
    var cy = clamp(ny, rect.y, rect.y + rect.h);
    var dx = nx - cx;
    var dy = ny - cy;
    var d2 = dx * dx + dy * dy;
    if (d2 >= BALL_R * BALL_R) return false;

    var vx;
    var vy;
    if (d2 > 0.0001) {
      var d = Math.sqrt(d2);
      vx = dx / d;
      vy = dy / d;
      shot.x = cx + vx * BALL_R;
      shot.y = cy + vy * BALL_R;
    } else {
      /* 球心陷在障碍里：沿最浅的一侧顶出去 */
      var left = nx - rect.x;
      var right = rect.x + rect.w - nx;
      var top = ny - rect.y;
      var bottom = rect.y + rect.h - ny;
      var m = Math.min(left, right, top, bottom);
      if (m === left) { vx = -1; vy = 0; shot.x = rect.x - BALL_R; }
      else if (m === right) { vx = 1; vy = 0; shot.x = rect.x + rect.w + BALL_R; }
      else if (m === top) { vx = 0; vy = -1; shot.y = rect.y - BALL_R; }
      else { vx = 0; vy = 1; shot.y = rect.y + rect.h + BALL_R; }
    }
    var dot = shot.vx * vx + shot.vy * vy;
    if (dot < 0) {
      shot.vx -= 2 * dot * vx;
      shot.vy -= 2 * dot * vy;
      shot.vx *= TANGENT_LOSS;
      shot.vy *= TANGENT_LOSS;
      shot.bounces++;
      shot.propHits++;
    }
    return true;
  }

  /* 固定步长推进一颗球 */
  function physicsStep(state, shot) {
    shot.x += shot.vx * DT;
    shot.y += shot.vy * DT;
    shot.t += DT;

    /* 四面墙 */
    if (shot.x < BALL_R) {
      shot.x = BALL_R;
      if (shot.vx < 0) { shot.vx = -shot.vx * RESTITUTION; shot.vy *= TANGENT_LOSS; shot.bounces++; shot.wallBounces++; }
    } else if (shot.x > ARENA_W - BALL_R) {
      shot.x = ARENA_W - BALL_R;
      if (shot.vx > 0) { shot.vx = -shot.vx * RESTITUTION; shot.vy *= TANGENT_LOSS; shot.bounces++; shot.wallBounces++; }
    }
    if (shot.y < BALL_R) {
      shot.y = BALL_R;
      if (shot.vy < 0) { shot.vy = -shot.vy * RESTITUTION; shot.vx *= TANGENT_LOSS; shot.bounces++; shot.wallBounces++; }
    } else if (shot.y > ARENA_H - BALL_R) {
      shot.y = ARENA_H - BALL_R;
      if (shot.vy > 0) { shot.vy = -shot.vy * RESTITUTION; shot.vx *= TANGENT_LOSS; shot.bounces++; shot.wallBounces++; }
    }

    /* 障碍：固定石柱 + 会动的石条 */
    var rects = levelRects(state, shot.t);
    for (var i = 0; i < rects.length; i++) {
      hitProp(state, shot, rects[i]);
    }

    /* 宝石 */
    var reach = BALL_R + GEM_R;
    for (var j = 0; j < state.gems.length; j++) {
      var gem = state.gems[j];
      if (gem.taken) continue;
      var gx = gem.x - shot.x;
      var gy = gem.y - shot.y;
      if (gx * gx + gy * gy <= reach * reach) {
        gem.taken = true;
        state.gemsLeft--;
        shot.collected.push(gem.order);
        state.lastEvents.push({ type: 'gem', x: gem.x, y: gem.y });
      }
    }

    /* 减速与停止 */
    var speed = Math.sqrt(shot.vx * shot.vx + shot.vy * shot.vy);
    if (speed > 0) {
      var next = speed - FRICTION * DT;
      if (next <= STOP_SPEED) {
        shot.vx = 0;
        shot.vy = 0;
        shot.done = true;
        shot.reason = 'stop';
      } else {
        shot.vx = (shot.vx / speed) * next;
        shot.vy = (shot.vy / speed) * next;
      }
    } else {
      shot.done = true;
      shot.reason = 'stop';
    }
  }

  /* 把一杆推进 dt 秒（内部按固定步长走，保证与求解器完全一致） */
  function advanceShot(state, shot, dt) {
    shot.acc += dt;
    var guard = 0;
    while (shot.acc >= DT && !shot.done && guard++ < 600) {
      shot.acc -= DT;
      physicsStep(state, shot);
      shot.path.push({ x: shot.x, y: shot.y });
    }
    if (shot.done) {
      state.ball.x = shot.x;
      state.ball.y = shot.y;
    }
    return shot.done;
  }

  /*
   * 无界面地模拟一杆：给定角度与初速，返回路径、吃到的宝石、反弹次数。
   * 求解器与「随手玩家」模型都用它，保证判定口径一致。
   * 用一份克隆的宝石状态，绝不污染真实局面。
   */
  function simulate(state, angle, speed) {
    var fake = {
      level: state.level,
      ball: state.ball,
      time: state.time || 0,
      gems: [],
      gemsLeft: state.gemsLeft,
      lastEvents: []
    };
    for (var i = 0; i < state.gems.length; i++) {
      fake.gems.push({ x: state.gems[i].x, y: state.gems[i].y, taken: state.gems[i].taken, order: i });
    }
    var shot = makeShot(fake, angle, speed);
    var guard = 0;
    while (!shot.done && guard++ < 4000) {
      physicsStep(fake, shot);
      shot.path.push({ x: shot.x, y: shot.y });
    }
    return {
      path: shot.path,
      collected: shot.collected,
      bounces: shot.bounces,
      wallBounces: shot.wallBounces,
      propHits: shot.propHits,
      x: shot.x,
      y: shot.y
    };
  }

  /* ---------- 瞄准 ---------- */
  function aimAngle(dx, dy) {
    return Math.atan2(dy, dx);
  }

  function dragSpeed(dragLength) {
    var t = clamp(dragLength / MAX_DRAG, 0, 1);
    return MIN_SPEED + (MAX_SPEED - MIN_SPEED) * t;
  }

  /*
   * 射线预测反弹：瞄准线画到第一个障碍（最多两段），这是本作的难度来源。
   * 返回命中点列表，元素带 kind（wall / prop）。
   */
  function raycast(state, angle) {
    var x = state.ball.x;
    var y = state.ball.y;
    var dx = Math.cos(angle);
    var dy = Math.sin(angle);
    var hits = [];
    var rects = levelRects(state, 0);

    for (var step = 0; step < 3; step++) {
      var tWall = Infinity;
      var wnx = 0;
      var wny = 0;
      if (dx > 1e-6) {
        tWall = (ARENA_W - BALL_R - x) / dx;
        wnx = -1;
      } else if (dx < -1e-6) {
        tWall = (BALL_R - x) / dx;
        wnx = 1;
      }
      if (dy > 1e-6) {
        var ty = (ARENA_H - BALL_R - y) / dy;
        if (ty < tWall) { tWall = ty; wnx = 0; wny = -1; }
      } else if (dy < -1e-6) {
        var ty2 = (BALL_R - y) / dy;
        if (ty2 < tWall) { tWall = ty2; wnx = 0; wny = 1; }
      }
      var best = null;
      if (isFinite(tWall)) best = { t: tWall, nx: wnx, ny: wny, kind: 'wall' };

      for (var i = 0; i < rects.length; i++) {
        var hit = rayRect(x, y, dx, dy, rects[i]);
        if (hit && (!best || hit.t < best.t)) {
          best = { t: hit.t, nx: hit.nx, ny: hit.ny, kind: 'prop' };
        }
      }
      if (!best) break;

      var hx = x + dx * best.t;
      var hy = y + dy * best.t;
      hits.push({ x: hx, y: hy, kind: best.kind });
      if (hits.length >= 2) break;

      var dot = dx * best.nx + dy * best.ny;
      dx -= 2 * dot * best.nx;
      dy -= 2 * dot * best.ny;
      x = hx;
      y = hy;
    }
    return hits;
  }

  /* 射线与矩形相交的最早距离与命中面的法线 */
  function rayRect(x, y, dx, dy, rect) {
    var tmin = 0;
    var tmax = Infinity;
    var axis = 0;
    var axes = [
      [x, dx, rect.x, rect.x + rect.w],
      [y, dy, rect.y, rect.y + rect.h]
    ];
    for (var i = 0; i < 2; i++) {
      var o = axes[i][0];
      var d = axes[i][1];
      var lo = axes[i][2];
      var hi = axes[i][3];
      if (Math.abs(d) < 0.000001) {
        if (o < lo || o > hi) return null;
        continue;
      }
      var t1 = (lo - o) / d;
      var t2 = (hi - o) / d;
      var entry = t1 < t2 ? t1 : t2;
      var exitT = t1 < t2 ? t2 : t1;
      if (entry > tmin) { tmin = entry; axis = i; }
      if (exitT < tmax) tmax = exitT;
      if (tmin > tmax) return null;
    }
    if (tmin === Infinity) return null;
    var d = axes[axis][1];
    var face = d > 0 ? -1 : 1;
    return { t: tmin, nx: axis === 0 ? face : 0, ny: axis === 1 ? face : 0 };
  }

  /* ---------- 一杆的完整流程 ---------- */
  function launch(state, angle, speed) {
    if (state.phase !== 'aim') return null;
    if (state.shotsLeft <= 0) return null;
    state.shotsLeft--;
    state.shotsUsed++;
    state.lastEvents = [];
    var shot = makeShot(state, angle, speed);
    state.shot = shot;
    state.phase = 'roll';
    return shot;
  }

  function settle(state) {
    var shot = state.shot;
    if (!shot) return;
    state.ball.x = shot.x;
    state.ball.y = shot.y;
    state.shot = null;
    if (!state.best || shot.path.length > state.best.path.length) {
      state.best = {
        path: shot.path.slice(),
        bounces: shot.bounces,
        wallBounces: shot.wallBounces,
        level: state.levelIndex
      };
    }
    if (state.gemsLeft <= 0) {
      state.phase = 'cleared';
      var bonus = state.shotsLeft * 300;
      if (state.shotsUsed === 1) bonus += 1500;
      state.score += 1000 + bonus;
      state.cleared[state.levelIndex] = { shots: state.shotsUsed, left: state.shotsLeft, score: 1000 + bonus };
    } else if (state.shotsLeft <= 0) {
      state.phase = 'out';
    } else {
      state.phase = 'aim';
    }
  }

  root.BilliardGame = {
    ARENA_W: ARENA_W,
    ARENA_H: ARENA_H,
    BALL_R: BALL_R,
    GEM_R: GEM_R,
    DT: DT,
    MIN_SPEED: MIN_SPEED,
    MAX_SPEED: MAX_SPEED,
    MAX_DRAG: MAX_DRAG,
    FRICTION: FRICTION,
    createRun: createRun,
    loadChamber: loadChamber,
    makeShot: makeShot,
    advanceShot: advanceShot,
    simulate: simulate,
    launch: launch,
    settle: settle,
    raycast: raycast,
    propRect: propRect,
    propSwept: propSwept,
    levelRects: levelRects,
    aimAngle: aimAngle,
    dragSpeed: dragSpeed,
    physicsStep: physicsStep
  };
})(typeof window !== 'undefined' ? window : global);
