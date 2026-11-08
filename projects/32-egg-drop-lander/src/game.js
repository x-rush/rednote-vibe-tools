/*
 * 蛋落地 · 玩法逻辑
 *
 * 一颗蛋在竖屏里不断下坠，玩家点一下喷一股气：
 *   1. 竖直方向给一个向上的冲量，把下坠速度压下来；
 *   2. 水平方向按点击位置给一个侧向冲量，用来修正落点。
 *
 * 关键是有空气阻力（线性阻力）：不加力时蛋会一路加速到终端速度，
 * 加力之后蛋会先减速、再被重力重新拉回，所以「在落地前喷气」确实能让蛋更轻地着陆。
 * 没有阻力的话，任何上推都只会让蛋弹得更高、落得更重，玩法就不成立。
 */
(function (root) {
  'use strict';

  var VIEW_HEIGHT = 420;
  var EGG_RADIUS = 11;
  var CEILING = 16;
  var SPAWN_Y = 34;
  var DEFAULT_FIELD_WIDTH = 400;

  function createEgg(fieldWidth) {
    return {
      x: fieldWidth / 2,
      y: SPAWN_Y,
      vx: 0,
      vy: 0,
      spin: 0,
      crack: 0
    };
  }

  function createRun(content) {
    var state = {
      content: content,
      levelIndex: 0,
      level: null,
      fieldWidth: DEFAULT_FIELD_WIDTH,
      score: 0,
      softLandings: 0,
      perfects: 0,
      lives: 3,
      thrusts: 0,
      time: 0,
      phase: 'falling',
      egg: createEgg(DEFAULT_FIELD_WIDTH),
      padBaseX: DEFAULT_FIELD_WIDTH / 2,
      padX: DEFAULT_FIELD_WIDTH / 2,
      padPhase: 0
    };
    loadLevel(state, 0);
    return state;
  }

  function loadLevel(state, index) {
    var levels = state.content.levels;
    var next = Math.max(0, Math.min(index, levels.length - 1));
    state.levelIndex = next;
    state.level = levels[next];
    state.lives = 3;
    state.gas = state.level.gas || 5;
    state.thrusts = 0;
    state.phase = 'falling';
    state.egg = createEgg(state.fieldWidth);
    state.padPhase = 0;
    state.padBaseX = state.level.padXRatio * state.fieldWidth;
    state.padX = state.padBaseX;
  }

  /* 同一关内换一颗蛋重来：保留机会数与气量 */
  function resetDrop(state) {
    state.phase = 'falling';
    state.egg = createEgg(state.fieldWidth);
    state.padPhase = 0;
  }

  function setFieldWidth(state, width) {
    if (!width || width <= 0) return;
    state.fieldWidth = width;
    state.padBaseX = state.level.padXRatio * width;
    if (!state.level.moveAmp) state.padX = state.padBaseX;
  }

  /* 终端速度：不下坠时的极限速度，用来判断这一关是不是必须动手 */
  function terminalSpeed(level) {
    return level.gravity / level.drag;
  }

  /*
   * 推进一帧。返回 { type: 'land', impact, safe } / { type: 'miss' } 或 null。
   */
  function step(state, dt) {
    if (state.phase !== 'falling') return null;
    var level = state.level;
    var egg = state.egg;
    state.time += dt;

    egg.vy += level.gravity * dt;
    egg.vy -= egg.vy * level.drag * dt;
    egg.vx += level.wind * dt;
    egg.vx -= egg.vx * level.drag * dt;

    egg.x += egg.vx * dt;
    egg.y += egg.vy * dt;
    egg.spin += egg.vx * dt * 0.02;

    if (egg.y < CEILING) {
      egg.y = CEILING;
      if (egg.vy < 0) egg.vy = -egg.vy * 0.35;
    }
    if (egg.x < EGG_RADIUS) {
      egg.x = EGG_RADIUS;
      egg.vx = Math.abs(egg.vx) * 0.5;
    } else if (egg.x > state.fieldWidth - EGG_RADIUS) {
      egg.x = state.fieldWidth - EGG_RADIUS;
      egg.vx = -Math.abs(egg.vx) * 0.5;
    }

    if (level.moveAmp) {
      state.padPhase += level.moveSpeed * dt;
      state.padX = state.padBaseX + Math.sin(state.padPhase) * level.moveAmp;
    }

    /* 落地判定：蛋底越过垫面且水平方向压在垫子上 */
    if (egg.vy > 0 && egg.y + EGG_RADIUS >= level.padY && egg.y - EGG_RADIUS < level.padY) {
      if (Math.abs(egg.x - state.padX) <= level.padW / 2 + EGG_RADIUS * 0.4) {
        state.phase = 'landed';
        return { type: 'land', impact: egg.vy, safe: egg.vy <= level.safe };
      }
    }

    if (egg.y - EGG_RADIUS > VIEW_HEIGHT) {
      state.phase = 'missed';
      return { type: 'miss' };
    }
    return null;
  }

  /*
   * 点按喷气。tapX 是虚拟坐标系里的点击位置。
   * 越偏离蛋的正上方，水平冲量越大，方便修正落点。
   */
  function thrust(state, tapX) {
    if (state.phase !== 'falling') return null;
    if (state.gas <= 0) return { type: 'empty' };
    var egg = state.egg;
    var reach = Math.max(40, state.fieldWidth * 0.35);
    var dir = (tapX - egg.x) / reach;
    if (dir > 1) dir = 1;
    if (dir < -1) dir = -1;
    egg.vy -= state.level.thrust;
    egg.vx += dir * state.level.tilt;
    state.gas -= 1;
    state.thrusts += 1;
    return { type: 'thrust', dir: dir, speed: egg.vy, gas: state.gas };
  }

  /* 当前离垫子的落速比例：1 = 安全线 */
  function speedRatio(state) {
    if (!state.level.safe) return 0;
    return Math.max(0, state.egg.vy) / state.level.safe;
  }

  root.EggGame = {
    VIEW_HEIGHT: VIEW_HEIGHT,
    EGG_RADIUS: EGG_RADIUS,
    CEILING: CEILING,
    SPAWN_Y: SPAWN_Y,
    createRun: createRun,
    loadLevel: loadLevel,
    resetDrop: resetDrop,
    setFieldWidth: setFieldWidth,
    step: step,
    thrust: thrust,
    speedRatio: speedRatio,
    terminalSpeed: terminalSpeed
  };
})(typeof window !== 'undefined' ? window : global);
