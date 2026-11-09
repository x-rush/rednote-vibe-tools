/*
 * 弹珠神殿（玉球金殿）· 玩法逻辑 —— 三期严格 1:1 复刻 eazo 原版
 *
 * 依据（按优先级）：
 *   1. projects/31-shuttlecock-kick/PLAN.md 第 8 章（严格 1:1，含原版 bug）
 *   2. projects/34-billiard-temple/reference/eazo-spec.txt（原版源码逐段提取）
 *   3. 原版 chunk %TEMP%\eazo-original\34\206-z57hflno4.js（切片核对）
 *
 * 原版机制（逐条照抄，含缺陷）：
 *   · 弹弓：按住玉球向后拖 → 松手发射；速度 = min(0.62, 0.0042 * 拖拽距离)（px/ms）；
 *     球在滚动中也允许再补一杆（直接替换当前速度），每杆扣 1 发；
 *   · 宝石：殿内随机撒，数量 = 5 + min(5, 殿号)，位置 = 区域内缩 34px 随机，
 *     每颗带随机相位 ph = 6.28 * rand()；
 *   · 连锁：撞到的宝石变身新球继续在场滚动；
 *     速度继承 = max(0.18, 0.9 * 撞击速度)，扇出偏转 = 撞击角 ± (0.6 + 0.5 * rand) 弧度，
 *     并发上限 12 颗，寿命 7000ms，速度 ≤ 0.03 或寿命耗尽即消散；
 *   · 连锁球不与主球互撞，连锁球之间也不互撞（原版就没有球间碰撞，重叠穿过）；
 *   · 摩擦是「每帧乘一次」，不是按时间归一：主球 ×0.9975 / 帧（仅玩法中），
 *     连锁球 ×0.997 / 帧 —— 高刷设备停得更快，这是原版缺陷，照抄；
 *   · 有剩余杆数时主球速度被托底到 0.08（永远不停，可以一直补杆）；
 *     杆数用完后球滑行到 0.035 以下才算停；
 *   · 一殿结束只有两条路：宝石收齐（立即），或杆尽后主球滑停。原版没有「杆尽重打本殿」，
 *     结束后直接进下一殿（宝石按新一殿重新随机撒）；第 8 殿结束进结算；
 *   · 统计字段与原版一致：{room, shots, gems, bestRun, runGems}，
 *     bestRun 是「单殿最多宝石」，不是单杆连锁数；
 *   · 非玩法状态（封面/结算）是演示模式：区域变小（0.07/0.44），玉球自动匀速滚
 *     （vx=.26, vy=-.2），无摩擦、静默收宝石，收齐自动重撒。
 *
 * 唯一与原版不同的地方（用户明确要求保留的输入 bug 修复，不是玩法改动）：
 *   · 画布 touch-action:none、pointercancel 中止瞄准绝不发射、pointerId 归属、
 *     最短按住 80ms、最小拖拽 14px（原版阈值 18px、无按住时长要求）。
 *
 * 坐标系：直接用画布 CSS 像素（与原版一致）。殿内区域 =
 *   { x:26, y:H*(玩法?0.16:0.07), w:W-52, h:H*(玩法?0.56:0.44) }。
 * 连锁扇出用 Math.random()（原版如此，非确定性）；
 * 测试可通过 game.setRng(fn) 注入种子随机，不影响运行时路径。
 */
(function (root) {
  'use strict';

  /* ---------- 原版常量（eazo-spec.txt 对照，勿改） ---------- */
  var ROOM_COUNT = 8;          /* 殿数 8 */
  var SHOTS_PER_ROOM = 4;      /* 每殿 4 杆 */
  var AREA_X = 26;             /* 区域左 */
  var AREA_TOP_PLAY = 0.16;    /* 玩法：区域上沿 = H * 0.16 */
  var AREA_H_PLAY = 0.56;      /* 玩法：区域高 = H * 0.56 */
  var AREA_TOP_MENU = 0.07;    /* 非玩法（演示）：区域上沿 */
  var AREA_H_MENU = 0.44;      /* 非玩法（演示）：区域高 */
  var GEM_INSET = 34;          /* 撒宝石内缩 */
  var BALL_R = 13;             /* 主球半径（撞墙内缩同值） */
  var CHAIN_R = 9;             /* 连锁球半径 */
  var FRICTION_MAIN = 0.9975;  /* 主球每帧摩擦（原版：仅玩法中生效） */
  var FRICTION_CHAIN = 0.997;  /* 连锁球每帧摩擦 */
  var SPEED_FLOOR = 0.08;      /* 有杆数时的主球速度托底 */
  var REST_SPEED = 0.035;      /* 杆尽后的静止判定 */
  var LAUNCH_K = 0.0042;       /* 拖拽距离 → 速度 系数 */
  var LAUNCH_MAX = 0.62;       /* 发射速度上限 */
  var CHAIN_KEEP = 0.9;        /* 连锁球继承撞击速度比例 */
  var CHAIN_MIN = 0.18;        /* 连锁球最低速度 */
  var CHAIN_FAN = 0.6;         /* 扇出偏转基数（弧度） */
  var CHAIN_FAN_RAND = 0.5;    /* 扇出偏转随机幅度 */
  var CHAIN_LIFE = 7000;       /* 连锁球寿命 ms */
  var CHAIN_CAP = 12;          /* 连锁球并发上限 */
  var PICKUP_MAIN = 24;        /* 主球收宝石判定距离 */
  var PICKUP_CHAIN = 20;       /* 连锁球收宝石判定距离 */
  var DEMO_VX = 0.26;          /* 演示模式自动滚动速度 */
  var DEMO_VY = -0.2;
  var TRAIL_DECAY = 0.0022;    /* 球迹每 ms 衰减 */
  var TRAIL_KEEP = 0.02;       /* 低于即删 */
  var TRAIL_CAP = 120;
  var PARTICLE_COUNT = 14;     /* 每颗宝石收集时的粒子数 */
  var PARTICLE_DECAY = 0.0013;
  var PARTICLE_KEEP = 0.03;
  var PARTICLE_CAP = 200;
  var PATH_MAX = 260;          /* 单殿路径记录上限 */
  var DT_CAP = 48;             /* 单帧步长上限 ms */

  /* ---------- 输入 bug 修复（保留项，非原版机制） ---------- */
  var AIM_MIN_DRAG = 14;       /* 原版 18；真机误触回归后取 14 */
  var AIM_MIN_HOLD_MS = 80;    /* 原版无；防「还没松手就发射」 */

  /* 随机源：默认 Math.random（原版如此），测试可注入种子随机 */
  var rng = Math.random;

  function clamp(v, lo, hi) {
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
  }

  /* 原版经济：第 n 殿宝石数 = 5 + min(5, n)（n 从 1 起） */
  function gemsForRoom(room) {
    return 5 + Math.min(5, room);
  }

  /* 原版区域公式 K(w, h, demo) */
  function areaFor(w, h, demo) {
    return {
      x: AREA_X,
      y: h * (demo ? AREA_TOP_MENU : AREA_TOP_PLAY),
      w: w - 52,
      h: h * (demo ? AREA_H_MENU : AREA_H_PLAY)
    };
  }

  /* 殿内随机撒宝石（原版 G）：内缩 34，随机相位 */
  function scatterGems(room, area) {
    var list = [];
    var count = gemsForRoom(room);
    for (var i = 0; i < count; i++) {
      list.push({
        x: area.x + GEM_INSET + rng() * (area.w - GEM_INSET * 2),
        y: area.y + GEM_INSET + rng() * (area.h - GEM_INSET * 2),
        got: false,
        ph: 6.28 * rng()
      });
    }
    return list;
  }

  /* ---------- 弹弓输入状态机（保留的输入修复，逐字未动） ----------
   * 输入事件（pointerdown / move / up / cancel）先进这台状态机，
   * 它裁定「什么时候才算一杆」：
   *   · 按住拖动期间绝不发射，松手那一刻才结算；
   *   · pointercancel（浏览器接管手势 / 来电打断）= 中止，绝不发射；
   *   · 只认「按下的那根手指」，第二根手指的按下 / 移动 / 抬起全部忽略；
   *   · 快速点按（< minHoldMs）或拖拽距离不足（< minDrag）不发射。
   * 弹弓方向：发射方向 = 球心 - 指尖，向后拖、朝反方向飞（原版同款）。
   */
  function createAimInput(opts) {
    var minDrag = (opts && opts.minDrag) || AIM_MIN_DRAG;
    var minHoldMs = (opts && opts.minHoldMs) || AIM_MIN_HOLD_MS;
    var active = false;
    var pointerId = null;
    var startMs = 0;
    var angle = 0;
    var dist = 0;
    var power = 0;

    function track(fx, fy, ballX, ballY) {
      var dx = ballX - fx;
      var dy = ballY - fy;
      var len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) return;
      dist = len;
      angle = Math.atan2(dy, dx);
      power = dragSpeed(len);
    }

    function down(id, fx, fy, ballX, ballY, nowMs) {
      if (active) return false; /* 已经在瞄准：第二根手指不接管 */
      active = true;
      pointerId = id;
      startMs = nowMs;
      dist = 0;
      power = 0;
      angle = 0;
      track(fx, fy, ballX, ballY);
      return true;
    }

    function move(id, fx, fy, ballX, ballY) {
      if (!active || id !== pointerId) return false;
      track(fx, fy, ballX, ballY);
      return true;
    }

    function up(id, nowMs) {
      if (!active || id !== pointerId) return { fired: false };
      active = false;
      pointerId = null;
      if (nowMs - startMs < minHoldMs) return { fired: false };
      if (dist < minDrag) return { fired: false };
      return { fired: true, angle: angle, dist: dist, power: power };
    }

    function cancel(id) {
      if (!active || id !== pointerId) return false;
      active = false;
      pointerId = null;
      return true; /* 中止瞄准：绝不发射 */
    }

    function reset() {
      active = false;
      pointerId = null;
      dist = 0;
      power = 0;
      angle = 0;
    }

    return {
      down: down,
      move: move,
      up: up,
      cancel: cancel,
      reset: reset,
      isActive: function () { return active; },
      getAim: function () { return { active: active, angle: angle, dist: dist, power: power }; }
    };
  }

  /* 拖拽长度 → 发射速度（原版 D：min(0.62, 0.0042 * dist)，px/ms） */
  function dragSpeed(dragLength) {
    return Math.min(LAUNCH_MAX, LAUNCH_K * dragLength);
  }

  /* ---------- 一局 ---------- */
  function createRun(content, viewportW, viewportH) {
    var w = viewportW || 390;
    var h = viewportH || 600;
    var state = {
      content: content,
      mode: 'demo',            /* 'demo'（封面/结算演示） | 'play' */
      w: w,
      h: h,
      /* 原版统计字段 N = {room, shots, gems, bestRun, runGems} */
      room: 1,
      shots: SHOTS_PER_ROOM,
      gems: 0,
      bestRun: 0,
      runGems: 0,
      area: areaFor(w, h, true),
      ball: { x: 0, y: 0, vx: 0, vy: 0, moving: false },
      chains: [],              /* 连锁球 {x,y,vx,vy,life} */
      gemList: [],
      trail: [],               /* E：球迹光点 {x,y,life} */
      particles: [],           /* j：收集粒子 {x,y,vx,vy,life,r,hue} */
      pathRecord: [],          /* F：本殿路径（归一化坐标） */
      bestPath: [],            /* k：最佳单殿路径 */
      finished: false,
      events: []
    };
    setupRoom(state, 1, true);
    return state;
  }

  /* 原版 G：撒宝石 + 摆主球 + 清球迹/路径/连锁球 */
  function setupRoom(state, room, demo) {
    state.area = areaFor(state.w, state.h, demo);
    state.gemList = scatterGems(room, state.area);
    state.ball.x = state.area.x + state.area.w / 2;
    state.ball.y = state.area.y + state.area.h - 40;
    state.ball.vx = 0;
    state.ball.vy = 0;
    state.ball.moving = false;
    state.trail = [];
    state.pathRecord = [];
    state.chains = [];
  }

  /* 原版 L：整局重开（回第 1 殿，清最佳路径与粒子） */
  function restart(state) {
    state.room = 1;
    state.shots = SHOTS_PER_ROOM;
    state.gems = 0;
    state.bestRun = 0;
    state.runGems = 0;
    state.bestPath = [];
    state.particles = [];
    state.finished = false;
    setupRoom(state, 1, state.mode !== 'play');
    return state;
  }

  function setViewport(state, w, h) {
    if (w === state.w && h === state.h) return;
    state.w = w;
    state.h = h;
    state.area = areaFor(w, h, state.mode !== 'play');
  }

  function setMode(state, mode) {
    if (state.mode === mode) return;
    state.mode = mode;
    state.area = areaFor(state.w, state.h, mode !== 'play');
  }

  function pushEvent(state, ev) {
    state.events.push(ev);
    if (state.events.length > 240) state.events.splice(0, state.events.length - 240);
  }

  function takeEvents(state) {
    var list = state.events;
    state.events = [];
    return list;
  }

  /* 原版 p：宝石被任何球撞到 → 收集（+变身连锁球）。演示模式下静默。 */
  function collectGem(state, gem, hitVx, hitVy, byChain) {
    gem.got = true;
    var demo = state.mode !== 'play';
    if (!demo) {
      state.gems += 1;
      state.runGems += 1;
      if (state.chains.length < CHAIN_CAP) {
        /* 原版连锁：速度继承 + 随机扇出（Math.random，非确定性） */
        var impact = Math.sqrt(hitVx * hitVx + hitVy * hitVy);
        var speed = Math.max(CHAIN_MIN, CHAIN_KEEP * impact);
        var sign = rng() < 0.5 ? -1 : 1;
        var angle = Math.atan2(hitVy, hitVx) + sign * (CHAIN_FAN + CHAIN_FAN_RAND * rng());
        state.chains.push({
          x: gem.x,
          y: gem.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: CHAIN_LIFE
        });
        pushEvent(state, { t: 'convert', x: gem.x, y: gem.y });
      }
      pushEvent(state, { t: 'gem', x: gem.x, y: gem.y, byChain: byChain ? 1 : 0 });
    }
    for (var i = 0; i < PARTICLE_COUNT; i++) {
      state.particles.push({
        x: gem.x,
        y: gem.y,
        vx: (rng() - 0.5) * 0.6,
        vy: (rng() - 0.5) * 0.6,
        life: 1,
        r: 2 + 4 * rng(),
        hue: 44
      });
    }
    if (state.particles.length > PARTICLE_CAP) {
      state.particles.splice(0, state.particles.length - PARTICLE_CAP);
    }
  }

  /* 原版 f：一殿结束。原版没有重打：直接推进下一殿，第 8 殿结束进结算。 */
  function endRoom(state) {
    state.ball.moving = false;
    state.ball.vx = 0;
    state.ball.vy = 0;
    state.chains = [];
    if (state.runGems > state.bestRun) {
      state.bestRun = state.runGems;
      state.bestPath = state.pathRecord.slice();
    }
    state.runGems = 0;
    state.pathRecord = [];
    if (state.room >= ROOM_COUNT) {
      state.finished = true;
      pushEvent(state, { t: 'finish', gems: state.gems });
      /* 结算后面是演示模式：把球摆好让演示继续 */
      setMode(state, 'demo');
      setupRoom(state, 1, true);
      return;
    }
    var finishedRoom = state.room;
    state.room += 1;
    state.shots = SHOTS_PER_ROOM;
    setupRoom(state, state.room, false);
    pushEvent(state, { t: 'room', room: state.room, cleared: finishedRoom - 1 });
  }

  /* 原版 D（发射）：替换当前速度（允许球在滚动中补杆），扣 1 杆 */
  function launchFromAim(state, aimResult) {
    if (state.mode !== 'play') return null;
    if (state.shots <= 0) return null;
    if (!aimResult || !aimResult.fired) return null;
    state.ball.vx = Math.cos(aimResult.angle) * aimResult.power;
    state.ball.vy = Math.sin(aimResult.angle) * aimResult.power;
    state.ball.moving = true;
    state.shots -= 1;
    pushEvent(state, { t: 'fire', power: aimResult.power, x: state.ball.x, y: state.ball.y });
    return { power: aimResult.power };
  }

  /* 单球撞墙（原版：原速反弹，无恢复系数损耗）；返回是否撞墙 */
  function bounceWalls(ball, area, radius) {
    var hit = null;
    if (ball.x < area.x + radius) {
      ball.x = area.x + radius;
      ball.vx = Math.abs(ball.vx);
      hit = { x: area.x, y: ball.y };
    } else if (ball.x > area.x + area.w - radius) {
      ball.x = area.x + area.w - radius;
      ball.vx = -Math.abs(ball.vx);
      hit = { x: area.x + area.w, y: ball.y };
    }
    if (ball.y < area.y + radius) {
      ball.y = area.y + radius;
      ball.vy = Math.abs(ball.vy);
      hit = hit || { x: ball.x, y: area.y };
    } else if (ball.y > area.y + area.h - radius) {
      ball.y = area.y + area.h - radius;
      ball.vy = -Math.abs(ball.vy);
      hit = hit || { x: ball.x, y: area.y + area.h };
    }
    return hit;
  }

  /* ---------- 原版主循环（每帧一次；摩擦逐帧相乘，原版缺陷照抄） ---------- */
  function frame(state, dtMs) {
    var dt = clamp(dtMs, 0, DT_CAP);
    var demo = state.mode !== 'play';
    var area = state.area;
    var ball = state.ball;
    var i;

    /* 演示模式：玉球自动匀速滚动，永不摩擦 */
    if (demo && !ball.moving) {
      ball.vx = DEMO_VX;
      ball.vy = DEMO_VY;
      ball.moving = true;
    }

    if (ball.moving) {
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      var hit = bounceWalls(ball, area, BALL_R);
      if (hit && !demo) pushEvent(state, { t: 'bounce', x: hit.x, y: hit.y, big: 1 });
      if (!demo) ball.vx *= FRICTION_MAIN, ball.vy *= FRICTION_MAIN;
      state.trail.push({ x: ball.x, y: ball.y, life: 1 });
      if (!demo) {
        state.pathRecord.push({ x: (ball.x - area.x) / area.w, y: (ball.y - area.y) / area.h });
        if (state.pathRecord.length > PATH_MAX) state.pathRecord.shift();
      }
      for (i = 0; i < state.gemList.length; i++) {
        var gem = state.gemList[i];
        if (!gem.got && Math.abs(gem.x - ball.x) < PICKUP_MAIN) {
          if (Math.sqrt((gem.x - ball.x) * (gem.x - ball.x) + (gem.y - ball.y) * (gem.y - ball.y)) < PICKUP_MAIN) {
            collectGem(state, gem, ball.vx, ball.vy, false);
          }
        }
      }
      if (!demo) {
        var speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        var left = 0;
        for (i = 0; i < state.gemList.length; i++) {
          if (!state.gemList[i].got) left++;
        }
        if (left === 0) {
          endRoom(state);
        } else if (state.shots > 0 && speed > 0 && speed < SPEED_FLOOR) {
          /* 有杆数：托底到 0.08，主球永不停（原版如此） */
          ball.vx = (ball.vx / speed) * SPEED_FLOOR;
          ball.vy = (ball.vy / speed) * SPEED_FLOOR;
        } else if (state.shots <= 0 && speed < REST_SPEED) {
          /* 杆尽：滑停即结束本殿（原版直接进下一殿） */
          endRoom(state);
        }
      } else {
        var demoLeft = 0;
        for (i = 0; i < state.gemList.length; i++) {
          if (!state.gemList[i].got) demoLeft++;
        }
        if (demoLeft === 0) setupRoom(state, 1, true);
      }
    }

    /* 连锁球：只在玩法中存在；不与主球互撞、相互之间也不撞（原版如此） */
    if (!demo && state.chains.length) {
      var alive = [];
      for (i = 0; i < state.chains.length; i++) {
        var c = state.chains[i];
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        bounceWalls(c, area, CHAIN_R);
        c.vx *= FRICTION_CHAIN;
        c.vy *= FRICTION_CHAIN;
        c.life -= dt;
        for (var k = 0; k < state.gemList.length; k++) {
          var g2 = state.gemList[k];
          if (!g2.got && Math.abs(g2.x - c.x) < PICKUP_CHAIN) {
            var ddx = g2.x - c.x;
            var ddy = g2.y - c.y;
            if (ddx * ddx + ddy * ddy < PICKUP_CHAIN * PICKUP_CHAIN) {
              collectGem(state, g2, c.vx, c.vy, true);
            }
          }
        }
        var cspeed = Math.sqrt(c.vx * c.vx + c.vy * c.vy);
        /* 原版存活条件：寿命未尽且速度 > 0.03 */
        if (c.life > 0 && cspeed > 0.03) alive.push(c);
      }
      state.chains = alive;
      if (!state.ball.moving) {
        var allGot = true;
        for (i = 0; i < state.gemList.length; i++) {
          if (!state.gemList[i].got) { allGot = false; break; }
        }
        if (allGot) endRoom(state);
      }
    }

    /* 球迹与粒子（原版 dt 缩放衰减） */
    var keep = [];
    for (i = 0; i < state.trail.length; i++) {
      var e = state.trail[i];
      e.life -= TRAIL_DECAY * dt;
      if (e.life > TRAIL_KEEP) keep.push(e);
    }
    state.trail = keep.length > TRAIL_CAP ? keep.slice(keep.length - TRAIL_CAP) : keep;
    keep = [];
    for (i = 0; i < state.particles.length; i++) {
      var p2 = state.particles[i];
      p2.x += p2.vx * dt;
      p2.y += p2.vy * dt;
      p2.life -= PARTICLE_DECAY * dt;
      if (p2.life > PARTICLE_KEEP) keep.push(p2);
    }
    state.particles = keep.length > PARTICLE_CAP ? keep.slice(keep.length - PARTICLE_CAP) : keep;
  }

  /* 供测试/自检快速推进（与 rAF 无关；dt 分片以贴近 60fps 语义） */
  function fastForward(state, ms) {
    var left = ms;
    while (left > 0) {
      var step = left > 16.7 ? 16.7 : left;
      frame(state, step);
      left -= step;
      if (state.finished) break;
    }
  }

  root.BilliardGame = {
    /* 常量（原版值，供测试对照） */
    ROOM_COUNT: ROOM_COUNT,
    SHOTS_PER_ROOM: SHOTS_PER_ROOM,
    AREA_X: AREA_X,
    AREA_TOP_PLAY: AREA_TOP_PLAY,
    AREA_H_PLAY: AREA_H_PLAY,
    AREA_TOP_MENU: AREA_TOP_MENU,
    AREA_H_MENU: AREA_H_MENU,
    GEM_INSET: GEM_INSET,
    BALL_R: BALL_R,
    CHAIN_R: CHAIN_R,
    FRICTION_MAIN: FRICTION_MAIN,
    FRICTION_CHAIN: FRICTION_CHAIN,
    SPEED_FLOOR: SPEED_FLOOR,
    REST_SPEED: REST_SPEED,
    LAUNCH_K: LAUNCH_K,
    LAUNCH_MAX: LAUNCH_MAX,
    CHAIN_KEEP: CHAIN_KEEP,
    CHAIN_MIN: CHAIN_MIN,
    CHAIN_FAN: CHAIN_FAN,
    CHAIN_FAN_RAND: CHAIN_FAN_RAND,
    CHAIN_LIFE: CHAIN_LIFE,
    CHAIN_CAP: CHAIN_CAP,
    PICKUP_MAIN: PICKUP_MAIN,
    PICKUP_CHAIN: PICKUP_CHAIN,
    DEMO_VX: DEMO_VX,
    DEMO_VY: DEMO_VY,
    TRAIL_CAP: TRAIL_CAP,
    PARTICLE_COUNT: PARTICLE_COUNT,
    PARTICLE_CAP: PARTICLE_CAP,
    PATH_MAX: PATH_MAX,
    DT_CAP: DT_CAP,
    AIM_MIN_DRAG: AIM_MIN_DRAG,
    AIM_MIN_HOLD_MS: AIM_MIN_HOLD_MS,
    /* API */
    gemsForRoom: gemsForRoom,
    areaFor: areaFor,
    scatterGems: scatterGems,
    setRng: function (fn) { rng = fn || Math.random; },
    createAimInput: createAimInput,
    dragSpeed: dragSpeed,
    createRun: createRun,
    restart: restart,
    setViewport: setViewport,
    setMode: setMode,
    launchFromAim: launchFromAim,
    frame: frame,
    fastForward: fastForward,
    takeEvents: takeEvents,
    bounceWalls: bounceWalls,
    collectGem: collectGem,
    endRoom: endRoom
  };
})(typeof window !== 'undefined' ? window : global);
