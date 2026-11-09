/*
 * 蛋落地 · 玩法逻辑（四期：严格 1:1 复刻 eazo 原版）
 *
 * 依据 reference/eazo-spec.txt（原版源码逐段提取）逐条对齐：
 *   1. 关卡表原值（含 impulse 190/190/195/…/250、gapHalf .20/.17/.15），
 *      不做任何重力 / 风 / 冲量缩放，无 gScale；
 *   2. 状态机：ready → falling → landed；ready 阶段 t > 0.8 自动开落；
 *   3. 初速 vx = 0.15 × wind；每帧 vy += gravity*dt、vx += wind*dt、
 *      x += vx*dt、y += vy*dt、t += dt；
 *   4. 边界墙 ±260：撞墙 vx = ±0.4×|vx| 向内反弹；
 *   5. 点按（原版 t.vy -= l.impulse）：纯竖直，没有任何水平分量；
 *      phase !== 'landed' 且 pulses > 0 才生效，点按即扣一发；
 *   6. 障碍带（第 6/9/12 关）：每落只判一次（usedObstacle）；蛋心不在缺口内
 *      （|x − (gapCenter−0.5)×520| > 2×gapHalf×260）且 pulses > 0 → 扣一发、
 *      蛋继续下落 —— 原版撞带不摔碎；
 *   7. 落地：y >= height → phase = 'landed'，landingSpeed = hypot(vx, vy)；
 *   8. 四档评级：speed > maxSpeed → broken；≤ 0.4×上限 perfect；
 *      ≤ 0.75×上限 safe；否则 cracked；
 *   9. 原版无天花板：反推可把蛋顶到 y < 0（起点上方），该行为原样保留。
 *
 * 原版缺陷保留：末段关卡在原版参数下数学上无法清零落速（脉冲预算 < 自由落体
 * 末速），本项目不做任何"救平衡"的修正 —— 这是复刻的正确结果。
 *
 * 保留的二期呈现层（不影响判定）：蛋的体积感绘制 / 速度刻度尺 / 玻璃 HUD /
 * 喷焰计时（egg.jet）、裂纹预警（egg.crack）、自转视觉（egg.spin）——
 * 三者都是纯视觉计时器，不参与任何物理判定。
 *
 * 坐标系：世界单位。x ∈ [-260, 260]，y ∈ [0, level.height]，地面在 y = height。
 * 渲染层把世界等比缩放到虚拟画布（蛋画成 64×66 虚拟单位，保证 ≥72 CSS px）。
 */
(function (root) {
  'use strict';

  /* 虚拟画布高度（渲染层共用，横向宽度随屏幕变化） */
  var VIEW_HEIGHT = 340;
  /*
   * 蛋的几何（渲染与判定分离）：
   *   EGG_HALF_W / EGG_HALF_H —— 虚拟画布单位的半宽半高，渲染层用它们画蛋壳；
   * 原版障碍带判定把蛋当作一个点（蛋心），判定式里没有蛋宽项，本项目保持一致。
   * 390px 竖屏（scale ≈ 1.647）→ 蛋约 105×109 CSS px，
   * 真横屏（scale ≈ 1.147）→ 约 73×76 CSS px，两种朝向都 ≥ 72px。
   */
  var EGG_RADIUS = 32;
  var EGG_HALF_W = 32;
  var EGG_HALF_H = 33;

  /* 世界常量（原版原值） */
  var WORLD_HALF = 260;        /* 世界半宽：±260 */
  var READY_TIME = 0.8;        /* 准备期：t > 0.8 自动开落；点按可提前开落 */
  var WALL_BOUNCE = 0.4;       /* 侧墙恢复系数 0.4 */
  var INIT_VX_WIND = 0.15;     /* 初始水平速度 = 0.15 × wind */
  var JET_VISUAL = 0.18;       /* 喷焰视觉计时（纯表现，不参与物理） */

  /* 原版直接使用关卡表的 gravity / wind 原值，不做任何缩放 */
  function gravityOf(level) {
    return level.gravity;
  }

  function windOf(level) {
    return level.wind || 0;
  }

  /* 原版 function r(e)：fresh drop state */
  function initDropState(level) {
    return {
      level: level,
      phase: 'ready',
      time: 0,
      pulses: level.pulses,
      usedObstacle: false,
      egg: {
        x: 0,
        y: 0,
        vx: INIT_VX_WIND * windOf(level),
        vy: 0,
        spin: 0,
        crack: 0,
        jet: 0
      }
    };
  }

  function createRun(content) {
    var state = {
      content: content,
      levelIndex: 0,
      level: null,
      phase: 'ready',
      time: 0,
      pulses: 0,
      usedObstacle: false,
      egg: null,
      streak: 0,
      bestStreak: 0,
      perfects: 0,
      run: { survived: 0, bestSpeed: Infinity, pulsesLeftOver: 0 }
    };
    loadLevel(state, 0);
    return state;
  }

  function loadLevel(state, index) {
    var levels = state.content.levels;
    var next = Math.max(0, Math.min(index, levels.length - 1));
    var fresh = initDropState(levels[next]);
    state.levelIndex = next;
    state.level = fresh.level;
    state.phase = fresh.phase;
    state.time = fresh.time;
    state.pulses = fresh.pulses;
    state.usedObstacle = false;
    state.egg = fresh.egg;
  }

  /* 原版 function n(e)：Math.hypot(vx, vy) */
  function currentSpeed(state) {
    return Math.hypot(state.egg.vx, state.egg.vy);
  }

  /* 刻度尺指针比例：1 = 限速线，>1 已在碎裂区 */
  function speedRatio(state) {
    var max = state.level.maxSpeed;
    if (!max) return 0;
    return Math.max(0, currentSpeed(state) / max);
  }

  /* 原版评级函数：e > t → broken；e/t ≤ .4 → perfect；≤ .75 → safe；否则 cracked */
  function gradeOf(speed, maxSpeed) {
    if (speed > maxSpeed) return 'broken';
    var ratio = speed / maxSpeed;
    if (ratio <= 0.4) return 'perfect';
    if (ratio <= 0.75) return 'safe';
    return 'cracked';
  }

  /*
   * 点按发射一发反推（原版："landed"!==t.phase && !(t.pulses<=0) &&
   * (t.vy-=l.impulse, t.pulses-=1, "ready"===t.phase&&(t.phase="falling"))）。
   * 纯竖直：不接收、不使用任何点击位置，没有水平分量。
   * 准备期内点按会立即开始下落（消耗这一发）。
   */
  function pulse(state) {
    if (state.phase === 'landed') return null;
    if (state.pulses <= 0) return { type: 'empty' };
    state.egg.vy -= state.level.impulse;
    state.egg.jet = JET_VISUAL;
    state.pulses -= 1;
    if (state.phase === 'ready') state.phase = 'falling';
    return { type: 'pulse' };
  }

  /*
   * 推进一帧（原版逐步对齐）：
   *   { type:'landed', grade, speed, pulsesLeft } —— 触地结算（四档评级）
   *   { type:'bandHit', pulsesLeft }              —— 撞上障碍带折损一发，蛋继续下落
   *   null —— 还在下落 / 准备中。
   */
  function step(state, dt) {
    if (state.phase === 'landed') return null;
    var level = state.level;
    var egg = state.egg;
    state.time += dt;
    if (egg.jet > 0) {
      egg.jet -= dt;
      if (egg.jet < 0) egg.jet = 0;
    }

    /* 准备期：t > 0.8 才转 falling（原版 if(!(e.t>.8))return a） */
    if (state.phase === 'ready') {
      if (!(state.time > READY_TIME)) return null;
      state.phase = 'falling';
    }

    egg.vy += gravityOf(level) * dt;
    egg.vx += windOf(level) * dt;
    egg.x += egg.vx * dt;
    egg.y += egg.vy * dt;
    egg.spin += egg.vx * dt * 0.004;

    /* 边界墙 ±260：x 夹回墙内，vx 按 0.4 恢复系数向内反弹（原版） */
    if (egg.x < -WORLD_HALF) {
      egg.x = -WORLD_HALF;
      egg.vx = WALL_BOUNCE * Math.abs(egg.vx);
    } else if (egg.x > WORLD_HALF) {
      egg.x = WORLD_HALF;
      egg.vx = -WALL_BOUNCE * Math.abs(egg.vx);
    }

    /*
     * 障碍带（原版，每落只判一次）：y 过 atY×height 时置 usedObstacle；
     * 蛋心不在缺口内（|x − (gapCenter−.5)×520| > 2×gapHalf×260）且 pulses > 0
     * → 扣一发；蛋继续下落，不摔碎。
     */
    var ob = level.obstacle;
    if (ob && !state.usedObstacle && egg.y >= ob.atY * level.height) {
      state.usedObstacle = true;
      var gapCx = (ob.gapCenter - 0.5) * 520;
      var passHalf = 2 * ob.gapHalf * 260;
      if (!(Math.abs(egg.x - gapCx) <= passHalf) && state.pulses > 0) {
        state.pulses -= 1;
        return { type: 'bandHit', pulsesLeft: state.pulses };
      }
    }

    /* 触地：y = height，landingSpeed = hypot(vx, vy)，立即评级（原版） */
    if (egg.y >= level.height) {
      egg.y = level.height;
      state.phase = 'landed';
      var speed = Math.hypot(egg.vx, egg.vy);
      return {
        type: 'landed',
        grade: gradeOf(speed, level.maxSpeed),
        speed: speed,
        pulsesLeft: state.pulses
      };
    }
    return null;
  }

  /*
   * 结算一落（原版："broken"!==grade → survived+1、bestSpeed 取幸存落的最小值；
   * pulsesLeftOver 每落都累加，碎裂落次也不例外）。
   * streak / perfects 是本项目的呈现层连击（不参与判定），一并维护。
   */
  function registerResult(state, event) {
    if (event.grade === 'perfect' || event.grade === 'safe') {
      state.streak += 1;
      if (state.streak > state.bestStreak) state.bestStreak = state.streak;
      if (event.grade === 'perfect') state.perfects += 1;
    } else {
      state.streak = 0;
    }
    state.run.pulsesLeftOver += event.pulsesLeft;
    if (event.grade !== 'broken') {
      state.run.survived += 1;
      if (event.speed < state.run.bestSpeed) state.run.bestSpeed = event.speed;
    }
    return event.grade;
  }

  /* 缺口中心的世界 x（原版：(gapCenter−.5)×520；暴露给渲染与模拟器） */
  function gapCenterX(level) {
    var ob = level.obstacle;
    if (!ob) return 0;
    return (ob.gapCenter - 0.5) * 520;
  }

  /* 缺口判定的通行半宽（原版：2×gapHalf×260；渲染画缺口用同一把尺） */
  function gapPassHalf(level) {
    var ob = level.obstacle;
    if (!ob) return 0;
    return 2 * ob.gapHalf * 260;
  }

  root.EggGame = {
    VIEW_HEIGHT: VIEW_HEIGHT,
    EGG_RADIUS: EGG_RADIUS,
    EGG_HALF_W: EGG_HALF_W,
    EGG_HALF_H: EGG_HALF_H,
    WORLD_HALF: WORLD_HALF,
    READY_TIME: READY_TIME,
    WALL_BOUNCE: WALL_BOUNCE,
    INIT_VX_WIND: INIT_VX_WIND,
    JET_VISUAL: JET_VISUAL,
    gravityOf: gravityOf,
    windOf: windOf,
    initDropState: initDropState,
    createRun: createRun,
    loadLevel: loadLevel,
    pulse: pulse,
    step: step,
    currentSpeed: currentSpeed,
    speedRatio: speedRatio,
    gradeOf: gradeOf,
    registerResult: registerResult,
    gapCenterX: gapCenterX,
    gapPassHalf: gapPassHalf
  };
})(typeof window !== 'undefined' ? window : global);
