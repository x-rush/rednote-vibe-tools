/*
 * 毽子连击 · 玩法逻辑（三期：严格 1:1 复刻 eazo 原版 Shuttlecock Kick）
 *
 * 本文件是原版 GameEngine / KICK_TYPES / resolveKick / tryKick / update 的逐条复刻，
 * 参数全部来自 reference/eazo-spec.txt 提取的原版源码切片：
 *  1. 踢法表 = 4 家族（inside/outside/knee/back）× 3 阶 = 12 条，
 *     带中心 knee .4 / outside .55 / inside .64 / back .8，
 *     阶参数 halfWidth .17/.115/.075、multiplier 1/1.4/1.9、power 1/1.12/1.26，
 *     unlockRally = s[tier] + familyIndex * r[tier]，s = {1:0,2:14,3:36}，r = {1:3,2:6,3:10}。
 *  2. 庭院表 = 12 座，unlockRally = t===0 ? 0 : 8*t+4（t 为下标），
 *     windStrength = min(.22, .018*t)，windGust = min(.34, .026*t)，
 *     obstacle = t<2 ? none : cycle[t%5]，groundTint/accentTint 按原版取模配色。
 *  3. 判定 resolveKick：遍历已解锁踢法，|ny - bandCenter| <= bandHalfWidth 即命中，
 *     强度 = 1 - dist/halfWidth，多条命中取 multiplier 最高者（同倍率取先出现者）。
 *     原版不限制毽子必须正在下落 —— 上升段带内点按同样算一脚，本实现照抄。
 *  4. tryKick：whiff（带外点按）不碰毽子、只清零 combo；命中则
 *     vy = -560 * power * (0.62 + 0.38 * strength)，
 *     vx = 0.6 * ((W/2 - x) * 0.9) + 家族横速 * (strength + 0.3)（outside +90 / back -60），
 *     angVel = (rng-0.5)*6 - 3，angle = PI（踢起翻面）。
 *  5. update 物理（四期体验修正，经用户拍板偏离原版：原版阻力公式符号缺陷导致
 *     踢起一帧内被吞、每脚仅 4~18px，用户实测「根本踢不高只能狂点」。修正为
 *     分段物理——上升段纯重力抛物线（力度真实决定踢起高度），下落段二次阻力
 *     维持慢落终速（软钳制兜底）。判定/解锁/庭院/风全部保持原版不动）：
 *     阵风 gust = sin(.9*p)*windGust + sin(2.3*p+1.1)*windGust*0.4，
 *     风 = (windStrength + gust) * 60，
 *     上升段 vy<0：vy += 760*dt（无阻力，抛物线），
 *     下落段 vy>=0：阻力 s = 1.15 * vy * vy * 0.0016，vy += 760*dt - s*dt*60，
 *     vy 超过 210 时软钳制 vy = 210 + (vy-210)*0.4，
 *     vx *= 1 - min(1, 1.2*dt)，姿态回正速率 r = vy>0 ? 6.72 : 2.1，
 *     spin += (0.6 + 0.004*|vx|)*dt，墙距 26、反弹 0.5。
 *  6. 坐标系 = 画布 CSS 像素（与原版一致）：playTop = topSafe(56)+8，
 *     groundY = H - bottomSafe(88) - 6。物理常量是绝对像素值，
 *     高屏设备下落时间更长，这正是原版的设备差异表现。
 *  7. 落地 = 局终（phase = landed）；每局 rng 用固定种子 0 的 mulberry32，
 *     与原版字符串种子落入 0 值分支的实际行为一致。
 */
(function (root) {
  'use strict';

  var DEFAULT_FIELD_WIDTH = 400;
  var DEFAULT_FIELD_HEIGHT = 780;

  function physicsOf(content) {
    return (content && content.meta && content.meta.physics) || {};
  }

  function num(physics, key, fallback) {
    var v = physics ? physics[key] : undefined;
    return typeof v === 'number' ? v : fallback;
  }

  function kickTable(content) {
    return (content && content.meta && content.meta.kicks) || [];
  }

  function courtyardTable(content) {
    return (content && content.meta && content.meta.courtyards) || [];
  }

  /* 原版 unlockedKickTypes：按表顺序返回全部已解锁踢法 */
  function unlockedKicks(content, rally) {
    var kicks = kickTable(content);
    var out = [];
    for (var i = 0; i < kicks.length; i++) {
      if (kicks[i].unlockRally <= rally) out.push(kicks[i]);
    }
    return out;
  }

  /* 原版 nextKickToUnlock：解锁门槛在 rally 之上的最近一条，没有则 null */
  function nextKickToUnlock(content, rally) {
    var kicks = kickTable(content);
    var best = null;
    for (var i = 0; i < kicks.length; i++) {
      if (kicks[i].unlockRally > rally) {
        if (!best || kicks[i].unlockRally < best.unlockRally) best = kicks[i];
      }
    }
    return best;
  }

  /*
   * 原版 resolveKick(ny, rally)：纯带判定。
   * 强度 = 1 - dist/halfWidth；多条命中取 multiplier 更高者；
   * multiplier 相同（原版一阶四条全是 1）时按表序先命中者胜。
   */
  function resolveBand(content, ny, rally, bandJitter) {
    var kicks = unlockedKicks(content, rally);
    var jit = typeof bandJitter === 'number' && bandJitter > 0 ? bandJitter : 1;
    var best = null;
    for (var i = 0; i < kicks.length; i++) {
      var kick = kicks[i];
      var halfWidth = kick.bandHalfWidth * jit;
      var dist = Math.abs(ny - kick.bandCenter);
      if (dist <= halfWidth) {
        if (!best || kick.multiplier > best.kick.multiplier) {
          best = { kick: kick, strength: 1 - dist / halfWidth };
        }
      }
    }
    return best;
  }

  /* 状态版包装：只做 phase 门禁（渲染层与 qa 钩子使用）。
   * 原版在上升段同样可踢，所以这里不做 vy 方向检查。
   * 四期：带宽乘 state.bandJitter（每次踢起后随机变化，判定与渲染同源）。 */
  function resolveKick(state) {
    if (!state || state.phase !== 'playing') return null;
    return resolveBand(state.content, normalizedY(state), state.rally, state.bandJitter);
  }

  /* 当前庭院：rally 达标的最后一座（原版同款循环） */
  function courtyardIndexFor(content, rally) {
    var yards = courtyardTable(content);
    var index = 0;
    for (var i = 0; i < yards.length; i++) {
      if (yards[i].unlockRally <= rally) index = i;
    }
    return index;
  }

  /* 布局（原版类字段）：CSS 像素空间 */
  function groundY(state) {
    var physics = physicsOf(state.content);
    return state.fieldHeight - num(physics, 'bottomSafe', 88) - num(physics, 'groundPad', 6);
  }

  function playTop(state) {
    var physics = physicsOf(state.content);
    return num(physics, 'topSafe', 56) + 8;
  }

  function playHeight(state) {
    return groundY(state) - playTop(state);
  }

  function normalizedY(state) {
    var top = playTop(state);
    var height = Math.max(1, playHeight(state));
    return (state.shuttle.y - top) / height;
  }

  /* 渲染换算系数：虚拟视口 380 高（渲染层视觉空间），k = 380 / cssH */
  function viewScale(state) {
    return 380 / Math.max(1, state.fieldHeight);
  }

  /* 羽色档位（纯视觉）：按本局已解锁踢法数映射 */
  function featherTiers(content) {
    return (content && content.meta && content.meta.featherTiers) || [];
  }

  function tierOf(content, unlockedCount) {
    var tiers = featherTiers(content);
    var result = tiers[0];
    for (var i = 0; i < tiers.length; i++) {
      if (unlockedCount >= tiers[i].kickCount) result = tiers[i];
    }
    return result;
  }

  /* 原版 mulberry32；原版把 locale 字符串直接当种子，落入 0 值分支，
   * 这里同样以种子 0 构造，逐位一致。 */
  function makeRng(seed) {
    var t = (seed === undefined ? 0 : seed) >>> 0;
    return function () {
      t |= 0;
      t = (t + 0x6d2b79f5) | 0;
      var e = Math.imul(t ^ (t >>> 15), 1 | t);
      e = (e + Math.imul(e ^ (e >>> 7), 61 | e)) ^ e;
      return ((e ^ (e >>> 14)) >>> 0) / 4294967296;
    };
  }

  function serve(state) {
    var physics = physicsOf(state.content);
    var height = playHeight(state);
    state.shuttle = {
      x: 0.5 * state.fieldWidth,
      y: playTop(state) + 0.18 * height,
      vx: 0,
      vy: num(physics, 'serveVy', 40),
      angle: 0,
      angVel: num(physics, 'serveAngVel', 0.6),
      spin: 0
    };
    state.combo = 0;
    state.time = 0;
  }

  function createRun(content, fieldWidth, fieldHeight) {
    var state = {
      content: content,
      fieldWidth: fieldWidth || DEFAULT_FIELD_WIDTH,
      fieldHeight: fieldHeight || DEFAULT_FIELD_HEIGHT,
      time: 0,
      windPhase: 0,
      phase: 'playing',       /* playing | landed */
      shuttle: null,
      rally: 0,
      combo: 0,
      bestCombo: 0,
      score: 0,
      kickIdsUsed: [],
      unlockedCount: 1,
      courtyardIndex: 0,
      whiffs: 0,
      highestKickPx: 0,
      lastKick: null,
      particles: [],
      flashes: [],
      bandJitter: 1,          /* 四期：甜区带宽度随机系数，踢起后重新抽取（0.72~1.28） */
      fallJitter: 0.85 + Math.random() * 0.3   /* 四期：每局下落阻力随机 ±15%，落地时间随机化 */
    };
    state.rng = makeRng(0);
    serve(state);
    return state;
  }

  /* 原版 resize：非首帧把毽子 x 钳回 [40, W-40] */
  function setFieldSize(state, width, height) {
    if (!width || width <= 0) return;
    var physics = physicsOf(state.content);
    var clamp = num(physics, 'resizeClamp', 40);
    state.fieldWidth = width;
    if (height && height > 0) state.fieldHeight = height;
    if (state.shuttle) {
      state.shuttle.x = Math.min(Math.max(state.shuttle.x, clamp), width - clamp);
    }
  }

  /* 风的横向加速度（含阵风），数值与原版一致；(windStrength+gust)*60 */
  function windAccel(state) {
    var yard = courtyardTable(state.content)[state.courtyardIndex] || {};
    var physics = physicsOf(state.content);
    var gustFreq = num(physics, 'windGustFreq', 0.9);
    var gustFreq2 = num(physics, 'windGustFreq2', 2.3);
    var unit = num(physics, 'windUnit', 60);
    var gust = Math.sin(gustFreq * state.windPhase) * (yard.windGust || 0) +
      Math.sin(gustFreq2 * state.windPhase + 1.1) * (yard.windGust || 0) * 0.4;
    return ((yard.windStrength || 0) + gust) * unit;
  }

  /* 风的归一化强度（0..1），给渲染层调视觉浓度 */
  function windNorm(state) {
    var yard = courtyardTable(state.content)[state.courtyardIndex] || {};
    var peak = 0.22 + 0.34;
    var v = ((yard.windStrength || 0) + (yard.windGust || 0)) / peak;
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  /* 原版 spawnKickBurst：粒子簿记保留在引擎内（渲染层另有一套视觉特效） */
  function spawnKickBurst(state, x, y, strong) {
    var physics = physicsOf(state.content);
    var count = strong
      ? num(physics, 'burstStrongCount', 22)
      : num(physics, 'burstWeakCount', 14);
    var speedMax = strong
      ? num(physics, 'burstStrongSpeed', 260)
      : num(physics, 'burstWeakSpeed', 150);
    var cap = num(physics, 'burstCap', 220);
    var rng = state.rng;
    for (var i = 0; i < count; i++) {
      var a = rng() * Math.PI * 2;
      var s = 60 + rng() * speedMax;
      var kind = i % 3 === 0 ? 'feather' : i % 3 === 1 ? 'spark' : 'dust';
      state.particles.push({
        x: x,
        y: y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - (strong ? 60 : 20),
        life: 0,
        maxLife: 0.5 + 0.7 * rng(),
        size: 2 + rng() * (kind === 'feather' ? 8 : 4),
        hue: kind === 'spark' ? '#f5d47c' : kind === 'feather' ? '#fff8ec' : '#c79857',
        kind: kind,
        rot: rng() * Math.PI,
        vr: (rng() - 0.5) * 8
      });
    }
    if (state.particles.length > cap) {
      state.particles.splice(0, state.particles.length - cap);
    }
  }

  /* 原版 spawnLandDust */
  function spawnLandDust(state, x) {
    var physics = physicsOf(state.content);
    var count = num(physics, 'landDustCount', 18);
    var rng = state.rng;
    for (var i = 0; i < count; i++) {
      var a = -Math.PI + rng() * Math.PI;
      var s = 40 + 130 * rng();
      state.particles.push({
        x: x,
        y: groundY(state),
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s * 0.5,
        life: 0,
        maxLife: 0.6 + 0.6 * rng(),
        size: 3 + 6 * rng(),
        hue: '#d8c088',
        kind: 'dust',
        rot: 0,
        vr: 0
      });
    }
  }

  /*
   * 玩家点按（原版 tryKick 语义）。返回事件对象；phase 非 playing 返回 null。
   * whiff：不碰毽子、只清零 combo（另记 whiffs 计数供统计）。
   * kick 事件字段：kick、strength、gain、combo、rally、
   *   unlockedKick（新解锁踢法）、unlockedYard（新庭院下标）、unlockedCount。
   */
  function kick(state) {
    if (!state || state.phase !== 'playing') return null;

    var resolved = resolveBand(state.content, normalizedY(state), state.rally);
    var shuttle = state.shuttle;
    if (!resolved) {
      spawnKickBurst(state, shuttle.x, shuttle.y, false);
      state.combo = 0;
      state.whiffs += 1;
      return { type: 'whiff', combo: 0, rally: state.rally };
    }

    var kickDef = resolved.kick;
    var strength = resolved.strength;
    var physics = physicsOf(state.content);
    var kickV = num(physics, 'kickV', 560);
    var pMin = num(physics, 'kickPowerMin', 0.62);
    var pSpan = num(physics, 'kickPowerSpan', 0.38);
    var pull = num(physics, 'vxCenterPull', 0.9);
    var familyX = (physics && physics.familyX) || {};

    /* 原版公式逐项照抄（含「力度失效」的阻力缺陷在前方 update 中等待它） */
    shuttle.vy = -kickV * kickDef.power * (pMin + pSpan * strength);
    /* 四期：踢起高度 ±9% 随机 + 随机横速（落点与落地时间随机化，用户反馈节奏太规律） */
    shuttle.vy *= 1 + (state.rng() - 0.5) * 0.18;
    var toward = (state.fieldWidth / 2 - shuttle.x) * pull;
    var flavor = kickDef.family === 'outside' ? 90 : kickDef.family === 'back' ? -60 : 0;
    if (typeof familyX.outside === 'number' && typeof familyX.back === 'number') {
      flavor = kickDef.family === 'outside' ? familyX.outside : kickDef.family === 'back' ? familyX.back : 0;
    }
    shuttle.vx = 0.6 * toward + flavor * (strength + 0.3) + (state.rng() - 0.5) * 70;
    shuttle.angVel = (state.rng() - 0.5) * 6 - 3;
    shuttle.angle = Math.PI;
    /* 四期：甜区带宽度随机变化（0.72~1.28 倍，判定与渲染同源），每次踢起后重新抽取 */
    state.bandJitter = 0.72 + state.rng() * 0.56;

    state.rally += 1;
    state.combo += 1;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;
    state.score += Math.round(kickDef.multiplier * (1 + strength) * 10);
    if (state.kickIdsUsed.indexOf(kickDef.id) < 0) state.kickIdsUsed.push(kickDef.id);
    state.lastKick = kickDef;

    spawnKickBurst(state, shuttle.x, shuttle.y, strength > 0.55);

    var gain = Math.round(kickDef.multiplier * (1 + strength) * 10);
    state.flashes.push({
      text: '+' + gain,
      color: strength > 0.6 ? '#d0663a' : '#7a5736',
      life: 0,
      x: shuttle.x,
      y: shuttle.y - 24
    });
    if (state.flashes.length > 6) state.flashes.shift();

    var event = {
      type: 'kick',
      kick: kickDef,
      strength: strength,
      combo: state.combo,
      rally: state.rally,
      gain: gain,
      unlockedKick: null,
      unlockedYard: -1,
      unlockedCount: state.unlockedCount
    };

    /* 原版解锁检查：nextKickToUnlock(rally-1) 恰好卡在本脚 rally 上 */
    var pending = nextKickToUnlock(state.content, state.rally - 1);
    if (pending && pending.unlockRally === state.rally) {
      event.unlockedKick = pending;
      state.unlockedCount = unlockedKicks(state.content, state.rally).length;
      event.unlockedCount = state.unlockedCount;
    }

    /* 庭院：rally 达标即换景 */
    var yardIndex = courtyardIndexFor(state.content, state.rally);
    if (yardIndex !== state.courtyardIndex) {
      state.courtyardIndex = yardIndex;
      event.unlockedYard = yardIndex;
    }

    return event;
  }

  /*
   * 推进一帧物理（原版 update 逐行复刻）。
   * 落地时返回 { type: 'land', ... }。
   */
  function step(state, dt) {
    if (!state || state.phase !== 'playing') return null;
    var physics = physicsOf(state.content);
    var shuttle = state.shuttle;
    var ground = groundY(state);
    var margin = num(physics, 'wallMargin', 26);
    var bounce = num(physics, 'wallBounce', 0.5);
    var damp = num(physics, 'vxDamping', 1.2);
    var dampRise = num(physics, 'angleDampRise', 2.1);
    var dampFall = num(physics, 'angleDampFall', 6.72);
    var gravity = num(physics, 'gravity', 760);
    var dragK = num(physics, 'dragK', 1.15);
    var dragUnit = num(physics, 'dragUnit', 0.0016);
    var dragTime = num(physics, 'dragTime', 60);
    var softCap = num(physics, 'vySoftCap', 210);
    var softKeep = num(physics, 'vySoftKeep', 0.4);
    var spinRate = num(physics, 'spinRate', 0.6);
    var spinVx = num(physics, 'spinVx', 0.004);

    state.time += dt;
    state.windPhase += dt;

    /* 风（横轴） */
    shuttle.vx += windAccel(state) * dt;

    /* 四期体验修正（用户拍板偏离原版）：原版阻力公式符号缺陷导致踢起一帧内被吞
     * （每脚仅 4~18px，用户实测「根本踢不高、只能狂点」）。修正为分段物理：
     * 上升段无阻力（纯重力抛物线，力度真实决定踢起高度：560 冲量 ≈ 206px，
     * power 1.26 ≈ 327px）；下落段二次阻力维持慢落终速（软钳制兜底），
     * 保留「带穿越有反应窗口」的解压节奏。判定/解锁/庭院/风全部不变。
     * 四期挑战增强（用户反馈修正后「无聊无挑战」）：
     * ① 一阶带 halfWidth 0.17 → 0.12（content.json，时机要求提升）；
     * ② 连击加速：每 10 连击重力 +18%（封顶 +100%），连击越高毽子落得越快
     *   （终速 83→最高 ~166px/s），后期逼玩家追高倍带（窄带高位，技术回报真实化）。 */
    var rallyNow = state.rally || 0;
    var gravityNow = gravity * (1 + Math.min(1, Math.floor(rallyNow / 10) * 0.18));
    if (shuttle.vy < 0) {
      shuttle.vy += gravityNow * dt;
    } else {
      /* 四期：dragUnit 0.0016→0.0005（下落终速 83→约150px/s，用户反馈「落得太慢」）；
       * fallJitter 每局 ±15% 随机（落地时间随机化） */
      var dragFall = dragK * (state.fallJitter || 1) * shuttle.vy * shuttle.vy * dragUnit * 0.3125;
      shuttle.vy += gravityNow * dt - dragFall * dt * dragTime;
    }
    if (shuttle.vy > softCap) {
      shuttle.vy = softCap + (shuttle.vy - softCap) * softKeep;
    }
    shuttle.vx *= 1 - Math.min(1, damp * dt);
    shuttle.x += shuttle.vx * dt;
    shuttle.y += shuttle.vy * dt;

    /* 姿态：踢起翻面，下落段更快回正（r = vy>0 ? 6.72 : 2.1） */
    var r = shuttle.vy > 0 ? dampFall : dampRise;
    shuttle.angle += shuttle.angVel * dt;
    shuttle.angVel *= 1 - Math.min(1, r * dt);
    shuttle.angle += (0 - shuttle.angle) * Math.min(1, r * dt);
    shuttle.spin += (spinRate + spinVx * Math.abs(shuttle.vx)) * dt;

    /* 左右墙：26px 钳制 + 0.5 反弹 */
    if (shuttle.x < margin) {
      shuttle.x = margin;
      shuttle.vx = bounce * Math.abs(shuttle.vx);
    } else if (shuttle.x > state.fieldWidth - margin) {
      shuttle.x = state.fieldWidth - margin;
      shuttle.vx = -bounce * Math.abs(shuttle.vx);
    }

    /* 最高踢击高度统计（结算卡「Highest kick」字段） */
    var aboveGround = ground - shuttle.y;
    if (aboveGround > state.highestKickPx) state.highestKickPx = aboveGround;

    if (shuttle.y >= ground) {
      shuttle.y = ground;
      shuttle.vy = 0;
      state.phase = 'landed';
      spawnLandDust(state, shuttle.x);
      return {
        type: 'land',
        rally: state.rally,
        combo: state.combo,
        highestKickPx: state.highestKickPx,
        courtyardIndex: state.courtyardIndex
      };
    }
    return null;
  }

  /* 原版引擎粒子/浮字簿记（渲染层不绘制，保持引擎行为完整） */
  function stepEffects(state, dt) {
    var i;
    for (i = 0; i < state.particles.length; i++) {
      var p = state.particles[i];
      p.life += dt;
      p.vy += (p.kind === 'feather' ? 90 : 260) * dt;
      p.vx *= 1 - Math.min(1, 1.4 * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    var keep = [];
    for (i = 0; i < state.particles.length; i++) {
      if (state.particles[i].life < state.particles[i].maxLife) keep.push(state.particles[i]);
    }
    state.particles = keep;
    for (i = 0; i < state.flashes.length; i++) {
      var f = state.flashes[i];
      f.life += dt;
      f.y -= 40 * dt;
    }
    keep = [];
    for (i = 0; i < state.flashes.length; i++) {
      if (state.flashes[i].life < 0.9) keep.push(state.flashes[i]);
    }
    state.flashes = keep;
  }

  /* 每帧总入口：物理 + 引擎特效簿记（渲染层另有自己的特效系统） */
  function advance(state, dt) {
    var event = step(state, dt);
    stepEffects(state, dt);
    return event;
  }

  root.JianziGame = {
    VIEW_SCALE: viewScale,
    GROUND_Y: groundY,
    PLAY_TOP: playTop,
    PLAY_HEIGHT: playHeight,
    normalizedY: function (state) { return normalizedY(state); },
    kickTable: kickTable,
    courtyardTable: courtyardTable,
    unlockedKicks: unlockedKicks,
    nextKickToUnlock: nextKickToUnlock,
    resolveBand: resolveBand,
    resolveKick: resolveKick,
    courtyardIndexFor: courtyardIndexFor,
    tierOf: tierOf,
    featherTiers: featherTiers,
    windNorm: windNorm,
    windAccel: windAccel,
    createRun: createRun,
    setFieldSize: setFieldSize,
    setFieldWidth: function (state, width, height) { setFieldSize(state, width, height); },
    kick: kick,
    step: advance
  };
})(typeof window !== 'undefined' ? window : global);
