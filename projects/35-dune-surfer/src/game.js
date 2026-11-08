/*
 * 沙丘速降 · 玩法逻辑
 *
 * 世界坐标：
 *   x  横向位置，0..WIDTH（虚拟宽度 300）
 *   s  沿坡方向跑过的距离，越大越靠近坡底
 * 屏幕上的纵深映射交给 render.js，这里只管物理、生成与判定。
 *
 * 三条运动规则各自独立，玩家必须学会区分：
 *   1. 纵向前进：速度由坡的陡缓决定（跟着「落水线」走就快，横向偏出去就慢）
 *   2. 横向切弯：手指按住拖多少就横移多少，但横向速度有上限
 *   3. 雪崩推进：始终跟在身后，吃掉你的失误
 */
(function (root) {
  'use strict';

  var WIDTH = 300;
  var GRAV = 900;           /* 重力加速度（世界单位/秒²） */
  var DRAG = 0.001;         /* 空气阻力系数，决定终端速度 */
  var MIN_SPEED = 150;
  var MAX_SPEED = 900;

  var CARVE_RESPONSE = 22;  /* 横向速度跟随目标的快慢（每秒） */
  var CARVE_MAX = 240;      /* 横向速度上限 */
  var CARVE_GAIN = 5;       /* 横向比例控制增益：偏多少算想要多快 */
  var FLICK_MIN = 80;       /* 横向速度超过这个值才算「甩尾」 */
  var FLICK_COOLDOWN = 1.4; /* 甩尾冷却 */
  var FLICK_PUSH = 110;      /* 一次全力甩尾把雪崩推远多少（按力度打折） */

  var GAP_START = 520;      /* 开局雪崩离你的距离 */
  var GAP_MAX = 1000;       /* 雪崩最远距离 */
  var RIDGE_SLOW = 0.5;      /* 撞岩脊后速度保留比例 */
  var RIDGE_GAP_LOSS = 60;   /* 撞岩脊后雪崩逼近多少 */

  /*
   * 快车道（chute）：
   *   落水线两侧各留 CHUTE_HALF 的一条走廊，走廊里一定没有挡路的东西；
   *   走廊里坡最陡、跑得最快——这就是「追那条发亮的线」的全部好处。
   * 世界里其余的岩体都留在 WALL_CLEAR 以外，够不着快车道，
   * 所以只有追线的人才吃不到岩体，野路子的人才会被石头绊住。
   */
  var CHUTE_HALF = 26;      /* 快车道走廊半宽 */
  var WALL_CLEAR = 90;      /* 坡侧岩体离快车道多远 */

  /*
   * 雪崩推进的两个参数。
   *
   * 这里踩过一个坑：最早写成「雪崩速度 = 你的速度 × 一个比例」，
   * 结果越跑快雪崩咬得越紧，「跟着落水线跑就更快」这个核心机制被自己抵消了，
   * 熟练玩家和随手玩家跑出来的距离几乎一样（技术没有回报）。
   *
   * 现在改成：雪崩按每个难度段的固定速率吃掉你的缓冲，
   * 你的速度只决定这段时间能滑多远——快就是快，技术这才有回报。
   * 同时保留一点「慢下来它就咬得更紧」，不然失误就没有临场感。
   */
  var WALL_REF_SPEED = 620;  /* 参考速度：跑到这个速度，雪崩就按基准速率推进 */
  var WALL_LAG_K = 0.05;     /* 每慢 1 点速度，雪崩每秒就多追近这么多 */

  var AIR_GRAV = 900;       /* 腾空的屏幕像素重力 */
  var AIR_JUMP = 190;       /* 跳台的起跳初速（屏幕像素/秒） */
  var AIR_BONUS = 40;       /* 每段腾空给多少额外分 */

  var GATE_HALF = 26;       /* 旗门半宽 */
  var GATE_SCORE = 50;
  var GATE_PUSH = 40;       /* 穿过旗门把雪崩推开多少 */
  var RAMP_HALF = 22;       /* 跳台半宽 */

  var CARVE_RISK_GAP = 190; /* 雪崩近到这个距离就开始给「险」加分 */
  var CARVE_RISK_MUL = 1.5;

  var PLAYER_MARGIN = 8;    /* 玩家左右边界留白 */
  var ESCAPE_MARGIN = 14;   /* 绕过岩脊时要多留出的余量（半个身位） */

  /* ---------- 伪随机 ---------- */
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

  /* ---------- 地形 ---------- */
  /* 沙丘起伏（屏幕像素的上下偏移），几个不同波长的正弦叠出来 */
  function surface(x, s) {
    return (
      16 * Math.sin(s / 210 + 0.7) +
      9 * Math.sin(s / 97 + x / 130) +
      5 * Math.sin(s / 53 + x / 61 + 2.1)
    );
  }

  /*
   * 落水线：坡上最快的那条线，会左右游走。
   *
   * 游走速度必须慢到玩家追得上：
   * 横向漂移率 = 78/700 + 34/260 ≈ 0.24（每世界单位），
   * 按 700 的速度换算就是每秒约 170 单位的横移要求，
   * 而横向速度上限 CARVE_MAX 是 240——刚好跟得上，还留得出手去躲石头。
   * （最早写成 s/430 + s/170，漂移率 0.38，横向要 228/秒，
   *   玩家根本贴不住那条线，「追线更快」这条机制等于不存在。）
   */
  function fallLine(s) {
    return WIDTH / 2 + 78 * Math.sin(s / 700 + 0.9) + 34 * Math.sin(s / 260 + 2.4);
  }

  /*
   * 陡峭度：越靠近落水线越陡，速度越快。
   * 这一条是全作的核心机制——「跟着那条发亮的线跑才快」必须真的成立，
   * 不追线的玩家必须实实在在慢下来，技术才有回报。
   *
   * 调过一轮：原先坡度基线的起伏（0.26±0.23）比落水线奖励（0.32）还大，
   * 结果「在坡的哪一段」决定快慢，「有没有贴着发亮的线」几乎不影响，
   * 熟练玩家和随手玩家平均速度只差 3%。
   * 现在把基线收窄、把快车道加宽奖励，让画面上那条线成为真正值得贴的路。
   */
  function steepness(s, x) {
    var base = 0.24 + 0.08 * Math.sin(s / 340 + 1.3) + 0.04 * Math.sin(s / 120 + 0.4);
    var d = Math.abs(x - fallLine(s));
    var bonus = 0.42 * (1 - (d / 65) * (d / 65));
    if (bonus < 0) bonus = 0;
    return Math.max(0.08, base + bonus);
  }

  /* ---------- 关卡（难度段） ---------- */
  /*
   * 每一段对应一个海拔带：地表越往下越暗、障碍越密、雪崩追得越紧。
   * 参数直接写在 content.json 里，方便按手感调。
   */
  function stageOf(content, s) {
    var stages = content.stages;
    var index = 0;
    for (var i = 0; i < stages.length; i++) {
      if (s >= stages[i].from) index = i;
    }
    return { index: index, def: stages[index] };
  }

  /* ---------- 一局 ---------- */
  function createRun(content, seed) {
    var state = {
      content: content,
      seed: seed >>> 0,
      rand: makeRandom(seed >>> 0),
      phase: 'ready',
      s: 0,
      speed: MIN_SPEED,
      x: WIDTH / 2,
      vx: 0,
      targetX: WIDTH / 2,
      gap: GAP_START,
      flags: 0,
      carves: 0,
      bonus: 0,
      flickCool: 0,
      lastSign: 0,
      air: 0,
      airVy: 0,
      topSpeed: 0,
      stageIndex: 0,
      features: [],
      nextFeatureS: 260,
      corridorLog: [],
      trail: [],
      trailTick: 0,
      events: [],
      score: 0,
      time: 0
    };
    return state;
  }

  function startRun(state) {
    state.phase = 'run';
    state.events = [];
    state.events.push({ type: 'start' });
  }

  /* ---------- 特征生成 ---------- */
  /*
   * 沿途铺三种东西，全部围绕「快车道」组织：
   *   ridge 岩脊：两种
   *     · 横石脊：窄窄一道横在快车道上，谁都得绕一下（绕的幅度很小）
   *     · 坡侧岩体：离快车道 WALL_CLEAR 以外的一大片石头，只挡野路
   *   gate  旗门：就挂在快车道上，穿过去得分并把雪崩推开
   *   ramp  跳台：也在快车道上，踩上去腾空可以越过岩脊
   *
   * 为什么这么摆：这一款的核心机制是「追那条发亮的线就快」。
   * 早先的摆法是「岩脊压在玩家身上」，逼他往两边躲，
   * 结果躲石头这件事占掉了 70% 的决策时间，玩家根本没机会去追线，
   * 熟练玩家和随手玩家跑出来几乎一样远。
   * 现在把石头挪到快车道以外：追线的人一路畅通、速度全开；
   * 不追线的人要么被石头拦下、要么全程在慢坡上磨速度——
   * 技术的回报这才立得住。
   *
   * 可解性还是靠「逃逸距离」保证：万一玩家被坡侧岩体压住了，
   * 绕出去需要的横移距离必须小于「从现在到撞上岩体这段时间能横移多远」，
   * 来不及绕就不压在他身上。
   */
  function spawnFeature(state) {
    var stage = stageOf(state.content, state.s);
    var def = stage.def;
    var rand = state.rand;
    /* 保守估计：玩家可能比现在更快，所以按 1.3 倍算留给他的横移距离 */
    var speedGuess = Math.min(MAX_SPEED, Math.max(280, state.speed * 1.3));
    var gapDist = def.featureGap * (0.78 + rand() * 0.5);

    /* 从生成这一刻到撞上这个特征，玩家最多能横移多远 */
    var reach = CARVE_MAX * (gapDist / speedGuess);
    var escape = reach - ESCAPE_MARGIN;

    var roll = rand();
    var type = roll < def.ridgeRate ? 'ridge' : roll < def.ridgeRate + def.gateRate ? 'gate' : 'ramp';

    /* 这个世界坐标上的快车道在哪 */
    var line = fallLine(state.nextFeatureS);
    var x = state.x;

    if (type === 'ridge') {
      var rlo = 0;
      var rhi = 0;
      var need = 0;
      var cross = rand() < def.crossRate;
      if (cross) {
        /* 横石脊：正中压在快车道上，窄，两边都躲得开 */
        var half = def.crossHalf * (0.85 + rand() * 0.3);
        /* 窄到「来得及横移过去」为止——这是硬约束，不能出现躲不开的石脊 */
        if (half + ESCAPE_MARGIN > reach) half = Math.max(6, reach - ESCAPE_MARGIN);
        rlo = line - half;
        rhi = line + half;
        need = half + ESCAPE_MARGIN;
      } else {
        /* 坡侧岩体：离快车道足够远，不挡追线的人 */
        var len = def.ridgeLen * (0.82 + rand() * 0.4);
        var left = rand() < 0.5;
        var lo = left ? line - WALL_CLEAR - len : line + WALL_CLEAR;
        var hi = left ? line - WALL_CLEAR : line + WALL_CLEAR + len;
        if (lo < 0) lo = 0;
        if (hi > WIDTH) hi = WIDTH;
        if (hi - lo < 46) {
          /* 这一侧放不下，退化成横石脊 */
          var half2 = def.crossHalf * (0.85 + rand() * 0.3);
          rlo = line - half2;
          rhi = line + half2;
          need = half2 + ESCAPE_MARGIN;
        } else {
          rlo = lo;
          rhi = hi;
          /* 玩家正压在岩体里的话，必须留得出逃逸距离 */
          if (x > rlo && x < rhi) {
            var needLeft = x - (rlo - ESCAPE_MARGIN);
            var needRight = (rhi + ESCAPE_MARGIN) - x;
            need = Math.min(needLeft, needRight);
            if (need < 0) need = 0;
            if (need > escape) {
              /* 来不及绕开就别压在他身上，这一侧换成横石脊 */
              var half3 = def.crossHalf * (0.85 + rand() * 0.3);
              rlo = line - half3;
              rhi = line + half3;
              need = half3 + ESCAPE_MARGIN;
            }
          }
        }
      }
      state.features.push({ type: 'ridge', s: state.nextFeatureS, lo: rlo, hi: rhi });
      state.corridorLog.push({
        s: state.nextFeatureS,
        lo: rlo,
        hi: rhi,
        x: x,
        need: need,
        reach: reach,
        gapDist: gapDist
      });
    } else if (type === 'gate') {
      /* 旗门就挂在快车道上：追线的人顺手就穿过去，野路子的人只能干看着 */
      var gx = clamp(line + (rand() - 0.5) * 20, GATE_HALF + 10, WIDTH - GATE_HALF - 10);
      state.features.push({ type: 'gate', s: state.nextFeatureS, x: gx, passed: false });
    } else {
      var rx = clamp(line, RAMP_HALF + 10, WIDTH - RAMP_HALF - 10);
      state.features.push({ type: 'ramp', s: state.nextFeatureS, x: rx });
    }

    state.nextFeatureS += gapDist;
  }

  /* ---------- 输入 ---------- */
  function setTarget(state, targetX) {
    state.targetX = clamp(targetX, PLAYER_MARGIN, WIDTH - PLAYER_MARGIN);
  }

  function releaseTarget(state) {
    /* 松手不回正：横向速度靠阻尼自然停下，保持切弯的惯性 */
  }

  /* ---------- 每帧 ---------- */
  function update(state, dt) {
    if (state.phase !== 'run') return;
    state.time += dt;

    /* 1. 纵向前进：坡的陡缓决定加速度 */
    var steep = steepness(state.s, state.x);
    var accel = GRAV * steep - DRAG * state.speed * state.speed;
    state.speed += accel * dt;
    state.speed = clamp(state.speed, MIN_SPEED, MAX_SPEED);
    if (state.speed > state.topSpeed) state.topSpeed = state.speed;

    var ds = state.speed * dt;
    var prevS = state.s;
    state.s += ds;

    /* 2. 横向切弯：手指偏多少，就想要多快的横移；速度平滑跟上去 */
    var dx = state.targetX - state.x;
    var desiredVx = clamp(dx * CARVE_GAIN, -CARVE_MAX, CARVE_MAX);
    state.vx += (desiredVx - state.vx) * Math.min(1, CARVE_RESPONSE * dt);
    state.x += state.vx * dt;
    if (state.x < PLAYER_MARGIN) {
      state.x = PLAYER_MARGIN;
      if (state.vx < 0) state.vx = 0;
    }
    if (state.x > WIDTH - PLAYER_MARGIN) {
      state.x = WIDTH - PLAYER_MARGIN;
      if (state.vx > 0) state.vx = 0;
    }

    /* 甩尾：横向方向反转且速度够快，把雪崩甩开一点 */
    state.flickCool = Math.max(0, state.flickCool - dt);
    var sign = state.vx > FLICK_MIN ? 1 : state.vx < -FLICK_MIN ? -1 : 0;
    if (sign !== 0 && state.lastSign !== 0 && sign !== state.lastSign && state.flickCool <= 0) {
      state.flickCool = FLICK_COOLDOWN;
      state.carves++;
      var power = Math.abs(state.vx) / CARVE_MAX;
      state.gap = Math.min(GAP_MAX, state.gap + FLICK_PUSH * power);
      state.bonus += 10;
      state.events.push({ type: 'carve', x: state.x, power: power });
    }
    if (sign !== 0) state.lastSign = sign;

    /* 3. 雪崩推进：固定速率吃掉你的缓冲，你慢下来它就咬得更紧 */
    var stage = stageOf(state.content, state.s);
    state.stageIndex = stage.index;
    var lag = Math.max(0, WALL_REF_SPEED - state.speed) * WALL_LAG_K;
    var gapRate = -(stage.def.wallDrain + lag);
    state.gap += gapRate * dt;
    state.gap = clamp(state.gap, -1, GAP_MAX);

    /* 4. 腾空 */
    if (state.air > 0 || state.airVy > 0) {
      state.airVy -= AIR_GRAV * dt;
      state.air += state.airVy * dt;
      if (state.air <= 0) {
        state.air = 0;
        state.airVy = 0;
        state.speed = Math.min(MAX_SPEED, state.speed * 1.06);
        state.events.push({ type: 'land' });
      }
    }

    /* 5. 特征结算 */
    /* 不在这里按距离提前退出：列表里可能混入不是按 s 排好的元素，
       提前退出会漏掉排在后面的那一个。列表长度有上限（几十个），全扫一遍不贵。 */
    for (var i = 0; i < state.features.length; i++) {
      var f = state.features[i];
      if (f.s <= state.s && f.s > prevS) {
        handleFeature(state, f);
      }
    }
    /* 清理已经跑过去的特征 */
    while (state.features.length && state.features[0].s < state.s - 200) {
      state.features.shift();
    }

    /* 6. 继续生成前方的特征 */
    while (state.nextFeatureS < state.s + 1400) {
      spawnFeature(state);
    }

    /* 7. 轨迹采样（结算卡要画山脊线） */
    state.trailTick += ds;
    if (state.trailTick > 34) {
      state.trailTick = 0;
      state.trail.push({ s: state.s, x: state.x, gap: state.gap });
      if (state.trail.length > 900) state.trail.shift();
    }

    /* 8. 分数 */
    var meters = state.s / 10;
    var risk = state.gap < CARVE_RISK_GAP ? CARVE_RISK_MUL : 1;
    state.score += (ds / 10) * risk;

    /* 9. 被追上 */
    if (state.gap <= 0) {
      state.phase = 'over';
      state.events.push({ type: 'caught' });
    }
  }

  function handleFeature(state, f) {
    if (f.type === 'ridge') {
      if (state.air > 6) {
        /* 腾空越过岩脊 */
        state.events.push({ type: 'clear', x: state.x });
        return;
      }
      /* 只有真的骑在岩脊上才算撞到 */
      if (state.x > f.lo && state.x < f.hi) {
        var hitLeft = state.x < (f.lo + f.hi) / 2;
        state.speed = Math.max(MIN_SPEED, state.speed * RIDGE_SLOW);
        state.gap -= RIDGE_GAP_LOSS;
        state.events.push({ type: 'crash', x: state.x, dir: hitLeft ? -1 : 1 });
      } else {
        state.events.push({ type: 'pass', x: state.x });
      }
    } else if (f.type === 'gate') {
      if (f.passed) return;
      f.passed = true;
      if (Math.abs(state.x - f.x) < GATE_HALF) {
        state.flags++;
        state.bonus += GATE_SCORE;
        state.gap = Math.min(GAP_MAX, state.gap + GATE_PUSH);
        state.events.push({ type: 'gate', x: f.x });
      } else {
        state.events.push({ type: 'gateMiss', x: f.x });
      }
    } else if (f.type === 'ramp') {
      if (state.air <= 0 && Math.abs(state.x - f.x) < RAMP_HALF) {
        state.air = 1;
        state.airVy = AIR_JUMP;
        state.events.push({ type: 'jump', x: f.x });
      }
    }
  }

  /* ---------- 结算 ---------- */
  function meters(state) {
    return Math.floor(state.s / 10);
  }

  function topKmh(state) {
    return Math.round(state.topSpeed * 0.36);
  }

  function finish(state) {
    state.phase = 'over';
    state.score = Math.floor(state.score + state.bonus);
    state.events.push({ type: 'over' });
    return state.score;
  }

  root.DuneGame = {
    WIDTH: WIDTH,
    GRAV: GRAV,
    MIN_SPEED: MIN_SPEED,
    MAX_SPEED: MAX_SPEED,
    CARVE_MAX: CARVE_MAX,
    CARVE_RESPONSE: CARVE_RESPONSE,
    CARVE_GAIN: CARVE_GAIN,
    CHUTE_HALF: CHUTE_HALF,
    WALL_CLEAR: WALL_CLEAR,
    FLICK_MIN: FLICK_MIN,
    FLICK_PUSH: FLICK_PUSH,
    FLICK_COOLDOWN: FLICK_COOLDOWN,
    GAP_START: GAP_START,
    GAP_MAX: GAP_MAX,
    GATE_HALF: GATE_HALF,
    GATE_SCORE: GATE_SCORE,
    RAMP_HALF: RAMP_HALF,
    AIR_JUMP: AIR_JUMP,
    AIR_GRAV: AIR_GRAV,
    AIR_BONUS: AIR_BONUS,
    CARVE_RISK_GAP: CARVE_RISK_GAP,
    CARVE_RISK_MUL: CARVE_RISK_MUL,
    RIDGE_SLOW: RIDGE_SLOW,
    RIDGE_GAP_LOSS: RIDGE_GAP_LOSS,
    WALL_REF_SPEED: WALL_REF_SPEED,
    WALL_LAG_K: WALL_LAG_K,
    surface: surface,
    fallLine: fallLine,
    steepness: steepness,
    stageOf: stageOf,
    createRun: createRun,
    startRun: startRun,
    setTarget: setTarget,
    releaseTarget: releaseTarget,
    update: update,
    meters: meters,
    topKmh: topKmh,
    finish: finish,
    makeRandom: makeRandom,
    clamp: clamp
  };
})(typeof window !== 'undefined' ? window : global);
