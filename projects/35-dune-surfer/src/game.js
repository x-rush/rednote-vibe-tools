/*
 * 沙丘速降 · 玩法逻辑（eazo 原版 1:1 复刻）
 *
 * 唯一依据：原版运行地址 https://dune-surfer-21a385cd.eazo.dev
 *   （逆向常量表见 projects/35-dune-surfer/reference/eazo-spec.txt）
 *
 * 本文件只保留原版的机制与常量，不含任何自创规则：
 *   · 世界坐标以「画布像素」为单位：x 是玩家在画布上的横向像素，
 *     边界 [30, W-30] 反弹；wy 是沿坡方向累计的世界距离；
 *   · ava 是雪崩压力：开局 0.42，每毫秒 +42e-6，穿门 -0.10（下限 0.12），
 *     错门 +0.07（上限 1），超过 0.98 被追上；
 *   · 旗门每 300+160×rand 世界单位一面，横向 W×(0.22+0.56×rand)，
 *     到线时 |门.x − 人.x| < 52 判定穿过；
 *   · 速度 p = 0.4 + min(0.28, 16e-5×dist)（米数驱动），米数 dist += dt×p×0.11；
 *   · 非游玩状态（封面 / 结算）走原版自动巡航：
 *     x = W/2 + sin(0.0011t)×W×0.2，vx = 0.3×cos(0.0011t)，
 *     ava = 0.5 + 0.08×sin(5e-4t)。
 *
 * 原版缺陷一并照抄（例如雪崩渐变位置与死亡线的方向关系、
 * 错门时旗门仍会被标记为已判定），不做修正。
 *
 * Chrome 61 基线：ES2017，不用可选链、空值合并、逻辑赋值等新语法。
 */
(function (root) {
  'use strict';

  /* ---------- 原版常量（逐条照抄原版源码） ---------- */
  var AVA_START = 0.42;        /* 开局压力 */
  var AVA_FLOOR = 0.12;        /* 穿门把压力压回的地板 */
  var AVA_DEATH = 0.98;        /* 超过即被追上 */
  var AVA_DRIFT = 42e-6;       /* 每毫秒恒定上涨（原版 42e-6 × dt(ms)） */
  var AVA_PASS_RELIEF = 0.10;  /* 穿过一面门推回多少 */
  var AVA_MISS_PENALTY = 0.07; /* 错过一面门逼近多少 */

  var GATE_SPACING_BASE = 300; /* 门距基数 */
  var GATE_SPACING_RAND = 160; /* 门距随机幅度 */
  var GATE_X_MIN = 0.22;       /* 门位起点：画布宽度的 22% */
  var GATE_X_SPAN = 0.56;      /* 门位跨度：画布宽度的 56%（即 22%~78%） */
  var GATE_PASS_HALF = 52;     /* 穿门判定半宽（画布像素） */
  var GATE_SEED = 400;         /* 开局时生成器的初值 */
  var GATE_LOOKAHEAD = 2.4;    /* 提前生成多少个屏高 */
  var GATE_KEEP_BEHIND = 400;  /* 回收：门落后玩家多少世界单位后丢弃 */
  var GATE_TRIGGER_GAP = 6;    /* 到线判定：门线越过玩家行的容差 */

  var WALL_MARGIN = 30;        /* 左右边界（画布像素） */
  var BOUNCE_KEEP = 0.4;       /* 反弹保留的横向速度比例 */
  var DRAG_GAIN = 55e-5;       /* vx += (dragX − x) × 55e-5 × dt(ms) */
  var CARVE_DAMP = 0.93;       /* 每帧横向阻尼（原版无条件施加） */

  var SPEED_BASE = 0.4;        /* 起步速度 */
  var SPEED_BONUS_MAX = 0.28;  /* 加成封顶 */
  var SPEED_DIST_K = 16e-5;    /* 加成随米数增长 */
  var METERS_PER_UNIT = 0.11;  /* 米数 = 世界距离 × 0.11 */

  var DEAD_DELAY = 700;        /* 被追上后延迟多少毫秒才结算 */
  var DT_CAP = 48;             /* 单帧最多吃 48ms */

  var LINE_PLAY = 0.66;        /* 玩家行 u = 屏高 × 0.66 */
  var LINE_CRUISE = 0.4;       /* 巡航时玩家行 u = 屏高 × 0.4 */
  var EDGE_PLAY = 0.2;         /* 坡顶线 d = 屏高 × 0.2 */
  var EDGE_CRUISE = 0.3;       /* 巡航时坡顶线 d = 屏高 × 0.3 */
  var CRUISE_SPEED = 0.3;      /* 巡航速度 */

  var PASS_PARTICLES = 18;     /* 穿门生成的粒子数 */
  var PARTICLE_CAP = 220;      /* 粒子上限 */
  var SPRAY_VX_MIN = 0.06;     /* 刻沙扬沙的横向速度门槛 */
  var SPRAY_CHANCE = 0.8;      /* 刻沙扬沙的触发概率 */
  var TRAIL_STEP = 26;         /* 轨迹采样间隔（世界单位） */
  var TRAIL_CAP = 200;         /* 轨迹点上限 */

  /* ---------- 伪随机（测试用；运行时用 Math.random） ---------- */
  function makeRandom(seed) {
    var s = seed >>> 0;
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

  function rand(run) {
    return run && typeof run.rand === 'function' ? run.rand() : Math.random();
  }

  /* ---------- 一局的状态（原版字段名照抄） ---------- */
  function createRun(width) {
    var w = width || 0;
    return {
      wy: 0,      /* 世界距离 */
      x: w / 2,   /* 横向位置（画布像素） */
      vx: 0,      /* 横向速度（像素/毫秒） */
      ava: AVA_START,
      dist: 0,    /* 已滑米数 */
      gates: 0,   /* 已穿过的旗门数 */
      dead: 0,    /* 0 = 活着；非 0 = 被追上的计时（毫秒） */
      gen: 0,     /* 旗门生成游标 */
      air: 0,     /* 原版保留字段（始终为 0） */
      drag: { on: false, x: 0 },
      gateList: [],
      particles: [],
      trail: [],
      finished: false,
      rand: null
    };
  }

  /* ---------- 开局（原版 j()） ---------- */
  function startRun(run, width) {
    run.wy = 0;
    run.x = width / 2;
    run.vx = 0;
    run.ava = AVA_START;
    run.dist = 0;
    run.gates = 0;
    run.dead = 0;
    run.gen = GATE_SEED;
    run.air = 0;
    run.drag.on = false;
    run.drag.x = 0;
    run.gateList = [];
    run.particles = [];
    run.trail = [];
    run.finished = false;
    ensureGates(run, 2600, width);
  }

  /* ---------- 旗门生成（原版 E()） ---------- */
  function ensureGates(run, target, width) {
    while (run.gen < target) {
      run.gen += GATE_SPACING_BASE + GATE_SPACING_RAND * rand(run);
      run.gateList.push({
        y: run.gen,
        x: width * (GATE_X_MIN + GATE_X_SPAN * rand(run)),
        passed: 0
      });
    }
    var keep = [];
    for (var i = 0; i < run.gateList.length; i++) {
      if (run.gateList[i].y > run.wy - GATE_KEEP_BEHIND) keep.push(run.gateList[i]);
    }
    run.gateList = keep;
  }

  /* ---------- 输入 ---------- */
  function setDrag(run, x) {
    run.drag.on = true;
    run.drag.x = x;
  }

  function moveDrag(run, x) {
    run.drag.x = x;
  }

  function releaseDrag(run) {
    run.drag.on = false;
  }

  /* ---------- 米数 ---------- */
  function meters(run) {
    return Math.round(run.dist);
  }

  /* ---------- 单帧推进（原版帧循环） ---------- */
  /*
   * opts: { width, height, mode: 'play' | 'cruise', now }
   * 返回本帧的屏幕基准线，供渲染层照抄原版取用。
   */
  function step(run, dtMs, opts) {
    var width = opts.width;
    var height = opts.height;
    var mode = opts.mode === 'play' ? 'play' : 'cruise';
    var now = opts.now || 0;
    var cruise = mode !== 'play';

    var a = Math.min(DT_CAP, dtMs);
    if (a < 0) a = 0;

    var u = height * (cruise ? LINE_CRUISE : LINE_PLAY);
    var d = height * (cruise ? EDGE_CRUISE : EDGE_PLAY);
    var p = cruise ? CRUISE_SPEED : SPEED_BASE + Math.min(SPEED_BONUS_MAX, SPEED_DIST_K * run.dist);

    /* 世界推进 + 旗门续生成 */
    run.wy += a * p;
    ensureGates(run, run.wy + GATE_LOOKAHEAD * height, width);

    /* 生存状态：死了就只累计死亡计时 */
    if (!cruise) {
      if (run.dead) {
        run.dead += a;
        if (run.dead > DEAD_DELAY) run.finished = true;
      } else {
        run.dist += a * p * METERS_PER_UNIT;
        run.ava += AVA_DRIFT * a;
        if (run.ava > AVA_DEATH) run.dead = 1;
      }
    }

    if (cruise) {
      /* 原版自动巡航 */
      run.x = width / 2 + Math.sin(0.0011 * now) * width * 0.2;
      run.vx = 0.3 * Math.cos(0.0011 * now);
      run.ava = 0.5 + 0.08 * Math.sin(5e-4 * now);
    } else {
      if (run.drag.on) {
        run.vx += (run.drag.x - run.x) * DRAG_GAIN * a;
      }
      run.vx *= CARVE_DAMP;
      run.x += run.vx * a;
      if (run.x < WALL_MARGIN) {
        run.x = WALL_MARGIN;
        run.vx = BOUNCE_KEEP * Math.abs(run.vx);
      } else if (run.x > width - WALL_MARGIN) {
        run.x = width - WALL_MARGIN;
        run.vx = -(BOUNCE_KEEP * Math.abs(run.vx));
      }
    }

    /* 旗门判定：到线的那一帧结算 */
    for (var i = 0; i < run.gateList.length; i++) {
      var g = run.gateList[i];
      var t = u - (g.y - run.wy);
      if (g.passed === 0 && t > u - GATE_TRIGGER_GAP) {
        /* 原版：判定标记与计分分离 —— 非游玩状态也会把门标成已判定 */
        g.passed = Math.abs(g.x - run.x) < GATE_PASS_HALF ? 1 : 2;
        if (!cruise) {
          if (g.passed === 1) {
            run.gates += 1;
            run.ava = Math.max(AVA_FLOOR, run.ava - AVA_PASS_RELIEF);
            for (var k = 0; k < PASS_PARTICLES; k++) {
              run.particles.push({
                x: run.x + (rand(run) - 0.5) * 60,
                y: u,
                vx: (rand(run) - 0.5) * 0.4,
                vy: -0.1 - 0.2 * rand(run),
                life: 1,
                r: 3 + 5 * rand(run)
              });
            }
          } else {
            run.ava = Math.min(1, run.ava + AVA_MISS_PENALTY);
          }
        }
      }
    }

    /* 刻沙扬沙（原版条件：|vx| > 0.06 且 0.8 > rand） */
    if (Math.abs(run.vx) > SPRAY_VX_MIN && SPRAY_CHANCE > rand(run)) {
      var sign = run.vx < 0 ? -1 : 1;
      run.particles.push({
        x: run.x - 20 * sign,
        y: u + 14,
        vx: -(0.25 * run.vx) + (rand(run) - 0.5) * 0.1,
        vy: -0.03 - 0.1 * rand(run),
        life: 1,
        r: 2.4 + 4.6 * rand(run)
      });
    }

    /* 粒子更新 */
    var keep = [];
    for (i = 0; i < run.particles.length; i++) {
      var q = run.particles[i];
      q.x += q.vx * a;
      q.y += q.vy * a + a * p * 0.5;
      q.vy += 8e-4 * a;
      q.life -= 0.0016 * a;
      if (q.life > 0.03) keep.push(q);
    }
    run.particles = keep.slice(-PARTICLE_CAP);

    /* 轨迹（原版用于分享图上的滑降线） */
    if (!cruise && !run.dead) {
      var trail = run.trail;
      var last = trail[trail.length - 1];
      if (!last || run.wy - last.y > TRAIL_STEP) {
        trail.push({ y: run.wy, x: run.x / width });
        if (trail.length > TRAIL_CAP) trail.shift();
      }
    }

    return { u: u, d: d, p: p };
  }

  root.DuneGame = {
    AVA_START: AVA_START,
    AVA_FLOOR: AVA_FLOOR,
    AVA_DEATH: AVA_DEATH,
    AVA_DRIFT: AVA_DRIFT,
    AVA_PASS_RELIEF: AVA_PASS_RELIEF,
    AVA_MISS_PENALTY: AVA_MISS_PENALTY,
    GATE_SPACING_BASE: GATE_SPACING_BASE,
    GATE_SPACING_RAND: GATE_SPACING_RAND,
    GATE_X_MIN: GATE_X_MIN,
    GATE_X_SPAN: GATE_X_SPAN,
    GATE_PASS_HALF: GATE_PASS_HALF,
    GATE_SEED: GATE_SEED,
    GATE_LOOKAHEAD: GATE_LOOKAHEAD,
    GATE_KEEP_BEHIND: GATE_KEEP_BEHIND,
    WALL_MARGIN: WALL_MARGIN,
    BOUNCE_KEEP: BOUNCE_KEEP,
    DRAG_GAIN: DRAG_GAIN,
    CARVE_DAMP: CARVE_DAMP,
    SPEED_BASE: SPEED_BASE,
    SPEED_BONUS_MAX: SPEED_BONUS_MAX,
    SPEED_DIST_K: SPEED_DIST_K,
    METERS_PER_UNIT: METERS_PER_UNIT,
    DEAD_DELAY: DEAD_DELAY,
    DT_CAP: DT_CAP,
    LINE_PLAY: LINE_PLAY,
    LINE_CRUISE: LINE_CRUISE,
    EDGE_PLAY: EDGE_PLAY,
    EDGE_CRUISE: EDGE_CRUISE,
    CRUISE_SPEED: CRUISE_SPEED,
    makeRandom: makeRandom,
    clamp: clamp,
    createRun: createRun,
    startRun: startRun,
    ensureGates: ensureGates,
    setDrag: setDrag,
    moveDrag: moveDrag,
    releaseDrag: releaseDrag,
    step: step,
    meters: meters
  };
})(typeof window !== 'undefined' ? window : global);
