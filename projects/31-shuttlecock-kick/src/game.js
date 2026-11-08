/*
 * 毽子连击 · 玩法逻辑
 *
 * 设计要点：
 * 1. 虚拟坐标系固定 400x640，不同机型只做等比缩放，保证手感一致。
 * 2. 物理是纯净弹道（无空气阻力），落点可预测，便于玩家记住节奏。
 * 3. 接球窗口由「接球线」与「地面」之间的下落距离决定：
 *    接球线越靠近抛物线顶点，窗口越长；越靠近地面，窗口越短。
 * 4. 合法踢 = 毽子正在下落且已越过接球线；否则是「踢早了」，连击清零。
 */
(function (root) {
  'use strict';

  /*
   * 虚拟画布固定 380 高（宽度随屏幕比例变化），不同机型只做等比缩放，
   * 保证抛物线高度与操作窗口完全一致。
   * GROUND_Y 固定在 330：抛物线顶点约在 79~90 之间，画面上方只留一小片天空，
   * 大部分面积留给毽子飞行，接球线落在 27% 高度、地面线落在 87% 高度。
   */
  var VIEW_HEIGHT = 380;
  var GROUND_Y = 330;
  var DEFAULT_FIELD_WIDTH = 400;
  var WHIFF_SCALE = 0.45;
  var PERFECT_SCALE = 1.04;

  function createBird(fieldWidth) {
    return {
      x: fieldWidth / 2,
      y: GROUND_Y,
      vx: 0,
      vy: 0,
      spin: 0,
      spinSpeed: 0,
      alive: true
    };
  }

  function createRun(content) {
    var state = {
      content: content,
      levelIndex: 0,
      level: null,
      fieldWidth: DEFAULT_FIELD_WIDTH,
      score: 0,
      combo: 0,
      bestCombo: 0,
      caught: 0,
      perfects: 0,
      lives: 3,
      cycle: 0,
      time: 0,
      phase: 'ready',
      bird: createBird(DEFAULT_FIELD_WIDTH)
    };
    loadLevel(state, 0);
    return state;
  }

  function loadLevel(state, index) {
    var levels = state.content.levels;
    var next = Math.max(0, Math.min(index, levels.length - 1));
    state.levelIndex = next;
    state.level = levels[next];
    state.caught = 0;
    state.perfects = 0;
    state.lives = state.level.lives || 3;
    state.combo = 0;
    state.cycle = 0;
    state.phase = 'ready';
    state.bird = createBird(state.fieldWidth);
  }

  function setFieldWidth(state, width) {
    if (!width || width <= 0) return;
    state.fieldWidth = width;
    state.bird.x = width / 2;
  }

  /* 抛物线顶点相对地面的高度 */
  function apexHeight(level) {
    return (level.kickSpeed * level.kickSpeed) / (2 * level.gravity);
  }

  /* 接球线：顶点下方 apexHeight * catchFactor 处 */
  function catchLineY(state) {
    var level = state.level;
    return GROUND_Y - apexHeight(level) * level.catchFactor;
  }

  /* 完美线：接球窗口最靠近地面的那一段 */
  function perfectLineY(state) {
    var level = state.level;
    var fall = GROUND_Y - catchLineY(state);
    return GROUND_Y - fall * level.perfectRatio;
  }

  function isCatchWindow(state) {
    var bird = state.bird;
    return bird.vy > 0 && bird.y >= catchLineY(state);
  }

  function launch(state, scale, fromGround) {
    var level = state.level;
    var bird = state.bird;
    state.cycle += 1;
    /* 每脚都略有偏差，避免玩家靠固定节奏蒙混 */
    var sway = 1 + (level.sway || 0) * Math.sin(state.cycle * 1.73);
    if (fromGround) {
      bird.y = GROUND_Y;
    }
    bird.vy = -level.kickSpeed * scale * sway;
    bird.vx = 0;
    /* 转速压低：羽毛裙始终大致朝上，不会看着像躺着 */
    bird.spinSpeed = (state.cycle % 2 === 0 ? 1 : -1) * (2.4 + Math.min(state.combo, 20) * 0.12);
    state.phase = 'flying';
  }

  /*
   * 玩家点按。返回事件对象，或 null（当前不接受输入）。
   * 事件类型：kick / whiff / levelClear
   */
  function kick(state) {
    if (!state.level) return null;
    if (state.phase === 'levelClear' || state.phase === 'levelFail' || state.phase === 'runDone') return null;

    var level = state.level;
    var bird = state.bird;

    if (state.phase === 'ready') {
      /* 开踢：起手一脚，连击从 1 开始，但不计入接住次数 */
      state.combo = 1;
      if (state.combo > state.bestCombo) state.bestCombo = state.combo;
      launch(state, 1, true);
      return { type: 'kick', first: true, perfect: false, combo: state.combo, gain: 0 };
    }

    if (state.phase !== 'flying') return null;

    if (!isCatchWindow(state)) {
      /* 踢早了：毽子还在往上或者还没过接球线 */
      state.combo = 0;
      launch(state, WHIFF_SCALE, false);
      return { type: 'whiff', combo: 0 };
    }

    var perfect = bird.y >= perfectLineY(state);
    state.combo += 1;
    state.caught += 1;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;
    if (perfect) state.perfects += 1;

    var gain = level.baseScore + state.combo * level.comboStep + (perfect ? level.perfectBonus : 0);
    state.score += gain;

    if (state.caught >= level.target) {
      launch(state, perfect ? PERFECT_SCALE : 1, true);
      state.phase = 'levelClear';
      return { type: 'levelClear', perfect: perfect, combo: state.combo, gain: gain, score: state.score };
    }

    launch(state, perfect ? PERFECT_SCALE : 1, true);
    return { type: 'kick', perfect: perfect, combo: state.combo, gain: gain };
  }

  /*
   * 推进一帧物理。返回 { type: 'land' } 或 null。
   */
  function step(state, dt) {
    state.time += dt;
    if (state.phase !== 'flying') return null;
    var bird = state.bird;
    bird.vy += state.level.gravity * dt;
    bird.y += bird.vy * dt;
    bird.x = state.fieldWidth / 2;
    bird.spin += bird.spinSpeed * dt;
    if (bird.y >= GROUND_Y) {
      bird.y = GROUND_Y;
      bird.vy = 0;
      state.phase = 'landed';
      return { type: 'land' };
    }
    return null;
  }

  /* 落地后恢复：扣一次机会，毽子重新落地待踢 */
  function recover(state) {
    if (state.phase !== 'landed') return null;
    state.lives -= 1;
    state.combo = 0;
    state.bird = createBird(state.fieldWidth);
    if (state.lives <= 0) {
      state.phase = 'levelFail';
      return { type: 'levelFail', levelIndex: state.levelIndex };
    }
    state.phase = 'ready';
    return { type: 'lifeLost', lives: state.lives };
  }

  /* 当前连击对应的外观档位 */
  function tierOf(content, combo) {
    var tiers = content.meta.tiers;
    var result = tiers[0];
    for (var i = 0; i < tiers.length; i++) {
      if (combo >= tiers[i].min) result = tiers[i];
    }
    return result;
  }

  /* 本次运行解锁到的最高档位 */
  function unlockedTier(content, bestCombo) {
    var tiers = content.meta.tiers;
    var result = tiers[0];
    for (var i = 0; i < tiers.length; i++) {
      if (bestCombo >= tiers[i].min) result = tiers[i];
    }
    return result;
  }

  /*
   * 解析一次完整回合的时间窗口，供平衡回归使用。
   * 返回从「合法踢」到「落地」之间的可操作时长（秒）。
   */
  function windowSeconds(level) {
    var apex = apexHeight(level);
    var fall = apex * level.catchFactor;
    var vCatch = Math.sqrt(Math.max(0, level.kickSpeed * level.kickSpeed - 2 * level.gravity * fall));
    return (level.kickSpeed - vCatch) / level.gravity;
  }

  root.JianziGame = {
    VIEW_HEIGHT: VIEW_HEIGHT,
    GROUND_Y: GROUND_Y,
    createRun: createRun,
    loadLevel: loadLevel,
    setFieldWidth: setFieldWidth,
    kick: kick,
    step: step,
    recover: recover,
    catchLineY: catchLineY,
    perfectLineY: perfectLineY,
    apexHeight: apexHeight,
    isCatchWindow: isCatchWindow,
    tierOf: tierOf,
    unlockedTier: unlockedTier,
    windowSeconds: windowSeconds
  };
})(typeof window !== 'undefined' ? window : global);
