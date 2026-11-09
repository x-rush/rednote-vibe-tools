/*
 * 毽子连击 · 渲染层（三期：玩法识别元素严格复刻原版，视觉底座保留二期升级）
 *
 * Canvas 2D。内部使用固定的 400x380 虚拟坐标系，按画布高度等比缩放；
 * 玩法相关几何（甜区带、毽子、命中辉光环）由 view.metric 提供——
 * 它是引擎（CSS 像素空间，与原版一致）按 380/cssH 换算到虚拟空间的布局，
 * 因此带的宽度/位置与原版判定严格一致，物理差异不进入渲染层。
 *
 * 玩法识别元素照抄原版：
 *  - 甜区带 = drawSweetSpotBand：只画已解锁中倍率最高那一条，
 *    呼吸频率 sin(4*time)，带外亮度 0.4*e，命中时原色 #d0663a / 常态 #c79857，
 *    填充 alpha 0.16+0.12r、虚线描边 alpha 0.5+0.3r，带左右各留 16px（按 k 换算）。
 *  - 命中辉光环：radius 34+6*e2、alpha 0.4+0.4*e2、e2 = (sin(8*time)+1)/2、线宽 3、#d0663a。
 *  - 庭院障碍物：lantern（accentTint 椭圆 12x16 + 立杆）、ledge（0.28 透明度双横台）、
 *    line（斜拉线），几何取自原版 drawCourtyardBackground。
 *
 * 视觉升级保留（不属于玩法判定）：三段式天空/云/飞鸟、透视围栏+双层树线、
 * 材质毽子、接地阴影、玻璃感构图、暗角、风纹、屏幕脉冲。
 *
 * 画布上不出现任何文字，规则信息全部放在 HUD 卡片与教学首屏。
 * Chrome 61 基线：不用 clip-path、filter、roundRect、可选链等新特性。
 */
(function (root) {
  'use strict';

  var VIEW_HEIGHT = 380;
  var GROUND_Y = 330;
  /* 地平线：远山 / 中景分界，也是围栏横杆的灭点高度 */
  var HORIZON_Y = 268;
  /* 毽子可见外接尺寸 / 半径 */
  var BIRD_SPAN = 1.75;

  /* ---------- 颜色工具（只做 hex 混色，不引入任何依赖） ---------- */
  function parseHex(hex) {
    var h = String(hex || '#ffffff').replace('#', '');
    if (h.length === 3) {
      h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    }
    var n = parseInt(h, 16);
    if (isNaN(n)) return [255, 255, 255];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /* k < 1 变暗，k > 1 变亮 */
  function shadeRgb(rgb, k) {
    var out = [];
    for (var i = 0; i < 3; i++) {
      var v = k <= 1 ? rgb[i] * k : rgb[i] + (255 - rgb[i]) * (k - 1);
      out.push(v < 0 ? 0 : v > 255 ? 255 : v);
    }
    return out;
  }

  function mixRgb(a, b, t) {
    var out = [];
    for (var i = 0; i < 3; i++) out.push(a[i] + (b[i] - a[i]) * t);
    return out;
  }

  function rgba(rgb, a) {
    return 'rgba(' + Math.round(rgb[0]) + ',' + Math.round(rgb[1]) + ',' + Math.round(rgb[2]) + ',' + a + ')';
  }

  function shadeHex(hex, k) {
    return rgba(shadeRgb(parseHex(hex), k), 1);
  }

  function mixHex(hex, hex2, t) {
    return rgba(mixRgb(parseHex(hex), parseHex(hex2), t), 1);
  }

  /* =====================================================================
   * 毽子本体：底部圆盘软垫 + 铃铛 + 倒锥形羽毛束
   * 渲染层与纪录卡共用同一份实现，保证两处造型完全一致。
   *
   * 羽毛束按真实毽子建模：一束羽毛插在底座上，向上张开成倒锥，
   * 每根羽毛单独成形（尖端收尖、有羽轴、有弯曲），
   * 绕垂直轴旋转时靠 3D 投影换算出前后层次，朝向光源的一侧亮、背侧暗。
   *
   * size = 可见外接尺寸（画布单位），内部按 BIRD_SPAN 换算半径。
   * ===================================================================== */
  function paintShuttlecock(ctx, x, y, size, tier, spin, glow, angle) {
    var R = size / BIRD_SPAN;
    var feathers = tier.feathers || ['#f2e6d0', '#c3a17c', '#fffaf0'];
    var main = parseHex(feathers[0]);
    var deep = parseHex(feathers[1]);
    var bright = parseHex(feathers[2]);

    /* 光源：左上前方 */
    var lx = -0.52;
    var ly = -0.68;
    var lz = 0.52;

    var clampY = -0.55 * R;
    var count = 9;

    ctx.save();
    ctx.translate(x, y);
    /* 踢起瞬间翻面（羽毛朝下），下落时转回羽毛朝上；游戏画布传 angle，纪录卡不转 */
    if (angle) ctx.rotate(angle);

    /* ---------- 羽毛束 ---------- */
    var items = [];
    for (var i = 0; i < count; i++) {
      /* 绕垂直轴旋转：方位角随 spin 变化 → 羽毛左右扫动，层次持续变化 */
      var phi = (i / count) * Math.PI * 2 + spin;
      /* 内层羽更直立，外层羽张开：整体是倒锥，顶部因内层羽更高而圆润收尖 */
      var inner = i % 3 === 0;
      var theta = inner ? 0.24 : 0.66;
      var len = (inner ? 1.2 : 1.1) * R * (0.93 + 0.07 * (((i * 7) % 5) / 4));
      /* 摆动：每根羽毛带一点相位差，飞行时有明显的羽面颤动 */
      var sway = Math.sin(spin * 1.9 + i * 0.62) * 0.05 * (inner ? 0.6 : 1);
      theta += sway;

      var st = Math.sin(theta);
      var ct = Math.cos(theta);
      var nx = st * Math.sin(phi);
      var ny = -ct;
      var nz = st * Math.cos(phi);

      var tx = nx * len;
      var ty = clampY + ny * len;
      var tz = nz * len;

      /* 明暗：法线与光线的点积决定亮度，朝光面亮、背光面暗 */
      var diff = nx * lx + ny * ly + nz * lz;
      if (diff < 0) diff = 0;

      items.push({
        x: tx,
        y: ty,
        z: tz,
        diff: diff,
        len: len,
        tx: tx,
        ty: ty
      });
    }

    /* 深度排序：远离镜头的先画，近的压在上面 */
    items.sort(function (a, b) { return a.z - b.z; });

    for (var f = 0; f < items.length; f++) {
      var it = items[f];
      var rx = it.x;
      var ry = it.y - clampY;
      var rl = Math.sqrt(rx * rx + ry * ry) || 1;
      var px = -ry / rl;
      var py = rx / rl;
      var w = R * (0.085 + 0.035 * Math.abs(it.z) / (it.len || 1));

      var rootX = 0;
      var rootY = clampY;
      var midX = rx * 0.52;
      var midY = clampY + ry * 0.52;

      /* 背面的羽毛再压暗一档，前后分层一眼可辨 */
      var depth = it.z < 0 ? 0.66 : 1;
      var rootK = (0.42 + 0.36 * it.diff) * depth;
      var tipK = (1.0 + 0.42 * it.diff) * depth;

      var rootCol = mixRgb(shadeRgb(main, rootK), shadeRgb(deep, 0.9), 0.35);
      var tipCol = mixRgb(shadeRgb(main, tipK), bright, 0.42);

      ctx.beginPath();
      ctx.moveTo(rootX, rootY);
      ctx.quadraticCurveTo(midX + px * w, midY + py * w, it.tx, it.ty);
      ctx.quadraticCurveTo(midX - px * w, midY - py * w, rootX, rootY);
      ctx.closePath();

      var grad = ctx.createLinearGradient(rootX, rootY, it.tx, it.ty);
      grad.addColorStop(0, rgba(rootCol, 1));
      grad.addColorStop(0.55, rgba(mixRgb(rootCol, tipCol, 0.55), 1));
      grad.addColorStop(1, rgba(tipCol, 1));
      ctx.fillStyle = grad;
      ctx.fill();

      /* 羽轴：从根部到尖端的细线 */
      ctx.strokeStyle = rgba(shadeRgb(rootCol, 0.72), 0.55);
      ctx.lineWidth = Math.max(0.6, R * 0.018);
      ctx.beginPath();
      ctx.moveTo(rootX, rootY);
      ctx.lineTo(rootX + (it.tx - rootX) * 0.72, rootY + (it.ty - rootY) * 0.72);
      ctx.stroke();

      /* 边缘描线：相邻羽毛之间不糊在一起 */
      ctx.strokeStyle = 'rgba(58,30,52,0.22)';
      ctx.lineWidth = Math.max(0.6, R * 0.014);
      ctx.stroke();
    }

    /* 羽尖高光：统一在左上 */
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = rgba(bright, 1);
    ctx.beginPath();
    ctx.ellipse(-R * 0.2, clampY - R * 0.92, R * 0.2, R * 0.1, -0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    /* ---------- 束口皮套 ---------- */
    var collarW = R * 0.17;
    var collarH = R * 0.15;
    var collar = ctx.createLinearGradient(-collarW, 0, collarW, 0);
    collar.addColorStop(0, shadeHex('#8c5a34', 1.1));
    collar.addColorStop(0.45, '#6d4526');
    collar.addColorStop(1, '#3b2415');
    ctx.fillStyle = collar;
    ctx.beginPath();
    ctx.moveTo(-collarW * 0.78, clampY + R * 0.02);
    ctx.lineTo(collarW * 0.78, clampY + R * 0.02);
    ctx.lineTo(collarW, clampY + R * 0.02 + collarH);
    ctx.lineTo(-collarW, clampY + R * 0.02 + collarH);
    ctx.closePath();
    ctx.fill();

    /* ---------- 铃铛 ---------- */
    var bellR = R * 0.185;
    var bellY = -R * 0.4;
    var bell = ctx.createRadialGradient(-bellR * 0.42, bellY - bellR * 0.5, bellR * 0.06, 0, bellY, bellR);
    bell.addColorStop(0, '#fff6cf');
    bell.addColorStop(0.4, '#e8b54a');
    bell.addColorStop(0.82, '#a8720f');
    bell.addColorStop(1, '#6d4708');
    ctx.fillStyle = bell;
    ctx.beginPath();
    ctx.arc(0, bellY, bellR, 0, Math.PI * 2);
    ctx.fill();
    /* 铃身赤道线 */
    ctx.strokeStyle = 'rgba(120,80,10,0.45)';
    ctx.lineWidth = Math.max(0.7, R * 0.02);
    ctx.beginPath();
    ctx.moveTo(-bellR * 0.92, bellY + bellR * 0.24);
    ctx.lineTo(bellR * 0.92, bellY + bellR * 0.24);
    ctx.stroke();
    /* 铃面高光 */
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#fffbe8';
    ctx.beginPath();
    ctx.ellipse(-bellR * 0.34, bellY - bellR * 0.4, bellR * 0.26, bellR * 0.2, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    /* ---------- 底部圆盘软垫 ---------- */
    var padRx = R * 0.46;
    var padRy = R * 0.15;
    var padCy = -R * 0.1;

    /* 盘侧（厚度） */
    var side = ctx.createLinearGradient(0, padCy - padRy * 0.4, 0, padCy + padRy * 1.5);
    side.addColorStop(0, '#8a5c3a');
    side.addColorStop(0.55, '#5a3823');
    side.addColorStop(1, '#2c1a12');
    ctx.fillStyle = side;
    ctx.beginPath();
    ctx.ellipse(0, padCy + padRy * 0.52, padRx, padRy * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();

    /* 盘顶 */
    var top = ctx.createRadialGradient(-padRx * 0.45, padCy - padRy * 0.55, padRy * 0.1, 0, padCy, padRx);
    top.addColorStop(0, '#e8c79c');
    top.addColorStop(0.45, '#b98d63');
    top.addColorStop(1, '#6b452c');
    ctx.fillStyle = top;
    ctx.beginPath();
    ctx.ellipse(0, padCy, padRx, padRy, 0, 0, Math.PI * 2);
    ctx.fill();

    /* 盘沿受光 */
    ctx.strokeStyle = 'rgba(255,226,186,0.4)';
    ctx.lineWidth = Math.max(0.7, R * 0.022);
    ctx.beginPath();
    ctx.ellipse(0, padCy, padRx - ctx.lineWidth * 0.5, padRy - ctx.lineWidth * 0.5, 0, Math.PI * 1.05, Math.PI * 1.85);
    ctx.stroke();

    /* 底缘暗线：和地面压出层次 */
    ctx.strokeStyle = 'rgba(24,12,10,0.6)';
    ctx.lineWidth = Math.max(0.8, R * 0.026);
    ctx.beginPath();
    ctx.ellipse(0, padCy + padRy * 0.52, padRx * 0.99, padRy * 0.78, 0, 0.15, Math.PI - 0.15);
    ctx.stroke();

    /* 接住窗口的辉光 */
    if (glow > 0) {
      ctx.globalAlpha = Math.min(0.7, glow);
      ctx.strokeStyle = tier.accent || '#ffd9a8';
      ctx.lineWidth = Math.max(1.4, R * 0.06);
      ctx.beginPath();
      ctx.arc(0, clampY - R * 0.35, R * 0.86, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  function createRenderer(canvas, content) {
    var ctx = canvas.getContext('2d');
    var meta = (content && content.meta) || {};
    var birdCfg = meta.bird || {};
    var plxCfg = meta.parallax || { far: 1, mid: 3.2, near: 6.6 };
    var baseRadius = birdCfg.baseRadius || 30;
    var minCssSize = birdCfg.minCssSize || 84;
    var bandCfg = meta.bandRender || {};
    /*
     * 玩法几何（虚拟空间）：由 view.metric 每帧提供。
     * metric.k = 380 / cssH，playTop/playHeight/groundY 均为引擎 CSS 像素布局 × k。
     */
    var metric = { k: 1, playTop: 34, playHeight: 296, groundY: GROUND_Y };

    var dpr = 1;
    var cssW = 0;
    var cssH = 0;
    var scale = 1;
    var fieldWidth = 400;
    var groundY = GROUND_Y;
    var reduced = false;
    var noisePattern = null;

    var particles = [];
    var ripples = [];
    var rings = [];
    var trail = [];
    var stars = [];
    var seeds = [];
    var birds = [];
    var streaks = [];
    var shake = 0;
    var flash = null;
    var pulse = 0;
    var pFar = 0;
    var pMid = 0;
    var pNear = 0;
    var lastTime = 0;
    var windLevel = 0;
    /* 最近一帧的视图：风纹更新使用 */
    var view0 = null;

    /* 云带：三层，柔边、水平延展 */
    var CLOUD_LAYERS = [
      { y: 26, h: 11, alpha: 0.2, rgb: '236,224,244', speed: 4.5, spread: 0.5, n: 3 },
      { y: 74, h: 15, alpha: 0.24, rgb: '255,214,186', speed: 6.5, spread: 0.66, n: 3 },
      { y: 146, h: 19, alpha: 0.3, rgb: '255,178,132', speed: 8.5, spread: 0.84, n: 3 }
    ];

    function buildBackdrop() {
      var seed = 20261108;
      stars = [];
      seeds = [];
      birds = [];
      for (var i = 0; i < 46; i++) {
        seed = (seed * 9301 + 49297) % 233280;
        var sx = (seed / 233280) * 1000;
        seed = (seed * 9301 + 49297) % 233280;
        var sy = (seed / 233280) * 1000;
        stars.push({ x: sx / 1000, y: sy / 1000, r: 0.6 + (i % 3) * 0.5, phase: i * 0.7 });
      }
      for (var j = 0; j < 16; j++) {
        seed = (seed * 9301 + 49297) % 233280;
        var px = (seed / 233280) * 1000;
        seed = (seed * 9301 + 49297) % 233280;
        var py = 26 + (seed / 233280) * 250;
        seed = (seed * 9301 + 49297) % 233280;
        seeds.push({ x: px / 1000, y: py / 1000, r: 1.2 + (seed / 233280) * 2, phase: j * 1.3, speed: 0.1 + (j % 4) * 0.05 });
      }
      /* 远处飞鸟剪影：3 只，很小 */
      birds.push({ x: 0.22, y: 0.19, s: 1, v: 0.011, phase: 0.4 });
      birds.push({ x: 0.35, y: 0.13, s: 0.74, v: 0.014, phase: 1.9 });
      birds.push({ x: 0.52, y: 0.225, s: 0.56, v: 0.008, phase: 3.3 });
    }
    buildBackdrop();

    /* 极细颗粒噪点：把大面积渐变的色带打散 */
    function buildNoise() {
      if (noisePattern || !root.document) return;
      var size = 48;
      var c = root.document.createElement('canvas');
      c.width = size;
      c.height = size;
      var g = c.getContext('2d');
      var img = g.createImageData(size, size);
      var d = img.data;
      for (var i = 0; i < d.length; i += 4) {
        var n = Math.random();
        d[i] = 255;
        d[i + 1] = 255;
        d[i + 2] = 255;
        d[i + 3] = n > 0.8 ? 26 : 0;
      }
      g.putImageData(img, 0, 0);
      noisePattern = ctx.createPattern(c, 'repeat');
    }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      var w = Math.max(1, Math.round(rect.width));
      var h = Math.max(1, Math.round(rect.height));
      var nextDpr = Math.min(3, root.devicePixelRatio || 1);
      if (w === cssW && h === cssH && nextDpr === dpr) return false;
      cssW = w;
      cssH = h;
      dpr = nextDpr;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      scale = cssH / VIEW_HEIGHT;
      fieldWidth = cssW / scale;
      buildNoise();
      return true;
    }

    function ensureSize() {
      return resize();
    }

    function getLayout() {
      return { scale: scale, fieldWidth: fieldWidth, cssWidth: cssW, cssHeight: cssH, groundY: groundY };
    }

    /*
     * 毽子半径：按「实际可见外接尺寸」保证在任何机型上都不小于 minCssSize。
     * 新造型为竖长的毽子剪影（羽束高 ≈ 1.75R），取可见外接尺寸的最大边为准。
     */
    function birdRadius() {
      var need = minCssSize / (BIRD_SPAN * Math.max(0.2, scale));
      return Math.max(baseRadius, need);
    }

    function birdCssSize() {
      return birdRadius() * BIRD_SPAN * scale;
    }

    /* ---------- 特效 ---------- */
    function burst(x, y, color, count, speed) {
      for (var i = 0; i < count; i++) {
        var a = Math.random() * Math.PI * 2;
        var v = speed * (0.35 + Math.random() * 0.9);
        particles.push({
          x: x,
          y: y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v - speed * 0.25,
          life: 0,
          max: 0.42 + Math.random() * 0.4,
          size: 1.6 + Math.random() * 2.6,
          color: color,
          gravity: 260,
          grow: 0
        });
      }
      if (particles.length > 420) particles.splice(0, particles.length - 420);
    }

    /* 落地扬尘：慢、重力小、边飞边变大 */
    function dust(x, y, count, color) {
      for (var i = 0; i < count; i++) {
        var a = Math.PI * (0.15 + Math.random() * 0.7) + Math.PI;
        var v = 42 + Math.random() * 95;
        particles.push({
          x: x + (Math.random() - 0.5) * 26,
          y: y - 2,
          vx: Math.cos(a) * v * 1.5,
          vy: Math.sin(a) * v * 0.4,
          life: 0,
          max: 0.6 + Math.random() * 0.4,
          size: 2.4 + Math.random() * 3.6,
          color: color || 'rgba(226,205,178,0.85)',
          gravity: 60,
          grow: 2.2
        });
      }
      if (particles.length > 420) particles.splice(0, particles.length - 420);
    }

    /* 涟漪：地面上的椭圆环 */
    function ripple(x, y, color, maxR) {
      ripples.push({ x: x, y: y, r: 8, maxR: maxR || 46, life: 0, max: 0.5, color: color });
      if (ripples.length > 60) ripples.shift();
    }

    /* 冲击环：正圆扩散 */
    function ring(x, y, color, maxR, width) {
      rings.push({ x: x, y: y, r: 6, maxR: maxR || 60, life: 0, max: 0.42, color: color, width: width || 3 });
      if (rings.length > 40) rings.shift();
    }

    function addShake(amount) {
      shake = Math.min(14, shake + amount);
    }

    function addFlash(color, alpha) {
      flash = { color: color, alpha: alpha };
    }

    /* 屏幕微缩放脉冲 */
    function addPulse(amount) {
      pulse = Math.min(1.4, pulse + (amount || 1));
    }

    /* 三层视差：一次踢击给三层不同幅度的位移 */
    function addParallax(power) {
      var p = power === undefined ? 1 : power;
      pFar += plxCfg.far * p;
      pMid += plxCfg.mid * p;
      pNear += plxCfg.near * p;
    }

    function clearEffects() {
      particles.length = 0;
      ripples.length = 0;
      rings.length = 0;
      trail.length = 0;
      shake = 0;
      flash = null;
      pulse = 0;
      pFar = 0;
      pMid = 0;
      pNear = 0;
    }

    function updateEffects(dt) {
      var i;
      for (i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.life += dt;
        if (p.life >= p.max) { particles.splice(i, 1); continue; }
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.985;
      }
      for (i = ripples.length - 1; i >= 0; i--) {
        var r = ripples[i];
        r.life += dt;
        if (r.life >= r.max) { ripples.splice(i, 1); continue; }
        var k = r.life / r.max;
        r.r = 8 + (r.maxR - 8) * (1 - Math.pow(1 - k, 2));
      }
      for (i = rings.length - 1; i >= 0; i--) {
        var g = rings[i];
        g.life += dt;
        if (g.life >= g.max) { rings.splice(i, 1); continue; }
        var k2 = g.life / g.max;
        g.r = 6 + (g.maxR - 6) * (1 - Math.pow(1 - k2, 2));
      }
      if (shake > 0) shake = Math.max(0, shake - dt * 26);
      if (pulse > 0) pulse = Math.max(0, pulse - dt * 3.4);
      pFar *= Math.exp(-dt * 3.2);
      pMid *= Math.exp(-dt * 4.6);
      pNear *= Math.exp(-dt * 6.2);
      updateStreaks(dt);
    }

    /* ---------- 远景：三段式天空 ---------- */
    function drawSky(tier, time) {
      var sky = tier.sky || ['#2a1c4e', '#ff7f4d', '#ffd287'];
      var top = sky[0];
      var mid = sky[1];
      var low = sky[2];

      ctx.save();
      ctx.translate(0, pFar);

      var y0 = -46;
      var y1 = HORIZON_Y + 8;
      var grad = ctx.createLinearGradient(0, y0, 0, y1);
      grad.addColorStop(0, top);
      grad.addColorStop(0.34, top);
      grad.addColorStop(0.46, mid);
      grad.addColorStop(0.64, mid);
      grad.addColorStop(0.78, low);
      grad.addColorStop(1, low);
      ctx.fillStyle = grad;
      ctx.fillRect(-20, y0, fieldWidth + 40, y1 - y0 + 20);

      /* 星空：只落在最暗的上段 */
      if (tier.stars) {
        for (var i = 0; i < stars.length; i++) {
          var st = stars[i];
          var tw = 0.45 + 0.55 * Math.abs(Math.sin(time * 1.3 + st.phase));
          ctx.globalAlpha = 0.3 + tw * 0.55;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(st.x * fieldWidth, st.y * 128, st.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      /* 日轮 / 月轮：压在接近地平线的位置 */
      var sunX = fieldWidth * 0.76;
      var sunY = 176;
      var halo = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 86);
      halo.addColorStop(0, tier.sun);
      halo.addColorStop(0.24, tier.sun);
      halo.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = 0.34;
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 86, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      var disc = ctx.createRadialGradient(sunX - 5, sunY - 6, 1, sunX, sunY, 20);
      disc.addColorStop(0, '#fffdf2');
      disc.addColorStop(0.6, tier.sun);
      disc.addColorStop(1, 'rgba(255,214,160,0.72)');
      ctx.fillStyle = disc;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 19, 0, Math.PI * 2);
      ctx.fill();

      /* 云带：三层柔边、水平延展，缓慢漂移 */
      for (var c = 0; c < CLOUD_LAYERS.length; c++) {
        var layer = CLOUD_LAYERS[c];
        var span = fieldWidth + 420;
        for (var k = 0; k < layer.n; k++) {
          var offset = k * (span / layer.n) + Math.sin(k * 3.1 + c) * 40;
          var drift = (offset + time * layer.speed) % span;
          var cx = drift - 210;
          var cy = layer.y + Math.sin(k * 1.7 + c * 2.3) * layer.h * 0.55;
          var rx = fieldWidth * (0.24 + layer.spread * 0.3) * (0.8 + 0.2 * ((k * 3) % 4) / 3);
          var ry = layer.h * (1 + 0.25 * ((k * 5) % 3) / 2);
          drawCloudBlob(cx, cy, rx, ry, layer.rgb, layer.alpha);
          drawCloudBlob(cx + rx * 0.42, cy + ry * 0.5, rx * 0.6, ry * 0.78, layer.rgb, layer.alpha * 0.72);
          drawCloudBlob(cx - rx * 0.46, cy + ry * 0.36, rx * 0.52, ry * 0.7, layer.rgb, layer.alpha * 0.62);
        }
      }

      /* 远处飞鸟剪影 */
      for (var b = 0; b < birds.length; b++) {
        var bd = birds[b];
        var bx = ((bd.x + time * bd.v) % 1.35 - 0.16) * fieldWidth;
        var by = bd.y * VIEW_HEIGHT + Math.sin(time * 0.6 + bd.phase) * 5;
        var flap = Math.sin(time * 5.2 + bd.phase) * 0.5 + 0.6;
        var span2 = 6.5 * bd.s;
        ctx.strokeStyle = 'rgba(44,28,52,0.5)';
        ctx.lineWidth = 1.1 * bd.s + 0.3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx - span2, by);
        ctx.quadraticCurveTo(bx - span2 * 0.45, by - span2 * 0.62 * flap, bx, by - span2 * 0.1);
        ctx.quadraticCurveTo(bx + span2 * 0.45, by - span2 * 0.62 * flap, bx + span2, by);
        ctx.stroke();
      }

      /* 地平线雾霭：把三段天空的底缘和远山咬合起来 */
      var haze = ctx.createLinearGradient(0, HORIZON_Y - 96, 0, HORIZON_Y + 6);
      haze.addColorStop(0, 'rgba(255,222,190,0)');
      haze.addColorStop(0.72, 'rgba(255,216,178,0.14)');
      haze.addColorStop(1, 'rgba(255,226,196,0.3)');
      ctx.fillStyle = haze;
      ctx.fillRect(-20, HORIZON_Y - 96, fieldWidth + 40, 102);

      /* 极细颗粒噪点：打散天空色带 */
      if (noisePattern) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = noisePattern;
        ctx.fillRect(-20, y0, fieldWidth + 40, HORIZON_Y - y0 + 20);
        ctx.restore();
      }
      ctx.restore();
    }

    function drawCloudBlob(cx, cy, rx, ry, rgb, alpha) {
      if (rx <= 0 || ry <= 0) return;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, ry / rx);
      var g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, 'rgba(' + rgb + ',' + alpha + ')');
      g.addColorStop(0.5, 'rgba(' + rgb + ',' + alpha * 0.5 + ')');
      g.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /* ---------- 远景：远山剪影 ---------- */
    function drawRidge(tier) {
      ctx.save();
      ctx.translate(0, pFar);

      /* 更远的一层：偏亮、被雾化 */
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = mixHex(tier.ridge, '#e4d6e8', 0.34);
      ctx.beginPath();
      ctx.moveTo(-20, HORIZON_Y + 12);
      for (var x = -20; x <= fieldWidth + 20; x += 16) {
        var y = HORIZON_Y - 44 - Math.sin(x * 0.0082) * 22 - Math.sin(x * 0.019 + 1.7) * 9;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(fieldWidth + 20, HORIZON_Y + 12);
      ctx.closePath();
      ctx.fill();

      /* 更近的一层：更深、更矮 */
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = tier.ridge;
      ctx.beginPath();
      ctx.moveTo(-20, HORIZON_Y + 12);
      for (var x2 = -20; x2 <= fieldWidth + 20; x2 += 12) {
        var y2 = HORIZON_Y - 22 - Math.sin(x2 * 0.015 + 2.4) * 12 - Math.sin(x2 * 0.041) * 5;
        ctx.lineTo(x2, y2);
      }
      ctx.lineTo(fieldWidth + 20, HORIZON_Y + 12);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    /* ---------- 中景：田垄地面 + 树线 + 透视围栏 ---------- */
    function drawMid(tier) {
      ctx.save();
      ctx.translate(0, pMid);

      var fieldColor = tier.field || tier.fence;
      var vpX = fieldWidth * 0.99;

      /* 田垄地面：从地平线铺到前景跑道 */
      var g = ctx.createLinearGradient(0, HORIZON_Y, 0, groundY + 12);
      g.addColorStop(0, mixHex(fieldColor, '#f0dcc6', 0.46));
      g.addColorStop(0.32, mixHex(fieldColor, '#e8d3c0', 0.18));
      g.addColorStop(1, shadeHex(fieldColor, 0.7));
      ctx.fillStyle = g;
      ctx.fillRect(-20, HORIZON_Y, fieldWidth + 40, groundY - HORIZON_Y + 20);

      /* 田垄：与围栏共用同一个灭点，强化纵深 */
      ctx.save();
      ctx.beginPath();
      ctx.rect(-20, HORIZON_Y, fieldWidth + 40, groundY - HORIZON_Y + 20);
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,238,216,0.08)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (var f = 0; f < 10; f++) {
        var bx = -70 + f * 58;
        ctx.moveTo(bx, groundY + 12);
        ctx.lineTo(vpX + (bx - vpX) * 0.05, HORIZON_Y + 1);
      }
      ctx.stroke();
      ctx.restore();

      /* 远层树线：偏冷、偏亮、被雾化 */
      drawTreeLine(HORIZON_Y + 8, 24, 40, 46, mixHex(tier.treeFar || tier.ridge, '#b9c8e0', 0.3), 0.72, 7);
      /* 远层雾：把远树推远 */
      var farHaze = ctx.createLinearGradient(0, HORIZON_Y - 30, 0, HORIZON_Y + 26);
      farHaze.addColorStop(0, 'rgba(238,224,236,0.05)');
      farHaze.addColorStop(1, 'rgba(238,224,236,0.34)');
      ctx.fillStyle = farHaze;
      ctx.fillRect(-20, HORIZON_Y - 30, fieldWidth + 40, 56);

      /* 近层树线：更深、更饱和 */
      drawTreeLine(HORIZON_Y + 30, 18, 30, 38, tier.treeNear || tier.fence, 0.95, 23);

      /* 围栏：柱距随深度收窄，横杆带透视斜度 */
      drawFence(tier);

      ctx.restore();
    }

    function drawTreeLine(baseY, minH, maxH, step, color, alpha, seed) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      var n = Math.ceil(fieldWidth / step) + 3;
      for (var i = 0; i < n; i++) {
        var tx = -step + i * step + ((seed * 13 + i * 29) % 17) - 8;
        var cr = minH + ((seed * 7 + i * 11) % (maxH - minH + 1));
        var ty = baseY - cr * 0.34;
        /* 树干 */
        ctx.fillRect(tx - cr * 0.07, ty, Math.max(1, cr * 0.14), baseY - ty);
        /* 树冠：三团半圆叠出蓬松轮廓 */
        ctx.beginPath();
        ctx.arc(tx, ty, cr * 0.62, Math.PI, 0);
        ctx.arc(tx + cr * 0.5, ty + cr * 0.22, cr * 0.46, Math.PI, 0);
        ctx.arc(tx - cr * 0.44, ty + cr * 0.26, cr * 0.38, Math.PI, 0);
        ctx.fill();
      }
      ctx.restore();
    }

    function drawFence(tier) {
      var vpX = fieldWidth * 0.99;
      var vpY = HORIZON_Y;
      var p0x = -120;
      var p0y = groundY + 40;
      var count = 10;
      var h0 = 64;

      var xs = [];
      var bases = [];
      var tops = [];
      var mids = [];
      for (var k = 0; k < count; k++) {
        var z = 1 + 0.42 * k;
        var x = vpX + (p0x - vpX) / z;
        var by = vpY + (p0y - vpY) / z;
        var h = h0 / z;
        xs.push(x);
        bases.push(by);
        tops.push(by - h);
        mids.push(by - h * 0.45);
      }

      var postColor = tier.fence || '#4a3352';

      /* 立柱：越远越细 */
      ctx.strokeStyle = postColor;
      ctx.lineCap = 'butt';
      for (var i = 0; i < count; i++) {
        var z2 = 1 + 0.42 * i;
        ctx.lineWidth = 5.4 / z2;
        ctx.beginPath();
        ctx.moveTo(xs[i], tops[i]);
        ctx.lineTo(xs[i], bases[i]);
        ctx.stroke();
      }

      /* 上横杆：顺着灭点收敛，带透视斜度 */
      ctx.lineWidth = 4.4;
      ctx.beginPath();
      ctx.moveTo(xs[0], tops[0]);
      for (var j = 1; j < count; j++) ctx.lineTo(xs[j], tops[j]);
      ctx.stroke();

      /* 下横杆 */
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(xs[0], mids[0]);
      for (var j2 = 1; j2 < count; j2++) ctx.lineTo(xs[j2], mids[j2]);
      ctx.stroke();

      /* 栏杆上沿受光：统一左上光源 */
      ctx.strokeStyle = 'rgba(255,238,208,0.3)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(xs[0], tops[0] - 1.8);
      for (var j3 = 1; j3 < count; j3++) ctx.lineTo(xs[j3], tops[j3] - 1.8);
      ctx.stroke();

      /* 远端雾化：围栏尽头化进空气里 */
      var far = ctx.createLinearGradient(fieldWidth * 0.45, 0, fieldWidth + 10, 0);
      far.addColorStop(0, 'rgba(240,226,236,0)');
      far.addColorStop(1, 'rgba(240,226,236,0.34)');
      ctx.fillStyle = far;
      ctx.fillRect(fieldWidth * 0.45, HORIZON_Y - 40, fieldWidth * 0.6 + 20, groundY - HORIZON_Y + 46);
    }

    /* ---------- 近景：地面 ---------- */
    function drawGround(tier) {
      var grad = ctx.createLinearGradient(0, groundY, 0, VIEW_HEIGHT);
      grad.addColorStop(0, tier.ground);
      grad.addColorStop(1, '#0d0a14');
      ctx.fillStyle = grad;
      ctx.fillRect(-10, groundY, fieldWidth + 20, VIEW_HEIGHT - groundY + 20);

      /* 操场跑道的边线 */
      ctx.fillStyle = tier.groundEdge;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(-10, groundY, fieldWidth + 20, 3);
      ctx.globalAlpha = 0.16;
      ctx.fillRect(-10, groundY + 16, fieldWidth + 20, 2);
      ctx.globalAlpha = 1;

      /* 庭院沙色渗入：groundTint/accentTint 用原版值（玩法识别相关的视觉参数） */
      if (tier.groundTint) {
        var wash = ctx.createLinearGradient(0, groundY, 0, groundY + 64);
        wash.addColorStop(0, tier.groundTint);
        wash.addColorStop(1, tier.ground);
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = wash;
        ctx.fillRect(-10, groundY, fieldWidth + 20, 64);
        ctx.globalAlpha = 1;
      }
      if (tier.accentTint) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = tier.accentTint;
        ctx.fillRect(-10, groundY, fieldWidth + 20, 2);
        ctx.globalAlpha = 1;
      }

      /* 跳房子格纹 */
      ctx.strokeStyle = 'rgba(255,255,255,0.09)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (var i = 0; i < 9; i++) {
        var x = 24 + i * ((fieldWidth - 48) / 8);
        ctx.moveTo(x, groundY + 8);
        ctx.lineTo(x, VIEW_HEIGHT + 10);
      }
      ctx.stroke();

      /* 地面颗粒，避免大片平涂 */
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (var j = 0; j < 26; j++) {
        var gx = ((j * 97) % 1000) / 1000 * fieldWidth;
        var gy = groundY + 6 + ((j * 53) % 40);
        ctx.fillRect(gx, gy, 2, 1.4);
      }
    }

    function drawSeeds(tier, time) {
      ctx.save();
      ctx.translate(0, pFar);
      ctx.fillStyle = tier.accent;
      for (var i = 0; i < seeds.length; i++) {
        var s = seeds[i];
        /* 风越大，飞絮漂得越快（风的视觉反馈之一） */
        var drift = (time * s.speed * 26 * (1 + windLevel * 2.4)) % (fieldWidth + 80);
        var x = fieldWidth + 40 - drift;
        var y = s.y * VIEW_HEIGHT + Math.sin(time * 0.9 + s.phase) * 12;
        ctx.globalAlpha = 0.3 + 0.25 * Math.abs(Math.sin(time * 0.7 + s.phase));
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    /* ---------- 甜区带（原版 drawSweetSpotBand 逐项复刻） ---------- */
    /*
     * 画布内零文字：踢法身份只用颜色与呼吸亮度和 HUD/DOM 沟通。
     * 只画已解锁踢法中 multiplier 最高的那一条带（原版行为）：
     *   top    = playTop + (bandCenter - bandHalfWidth) * playHeight
     *   height = 2 * bandHalfWidth * playHeight
     *   x      = 16 .. W-16*2（原版 16px 边距，按 k 换算）
     *   填充   alpha = 0.16 + 0.12*r；虚线描边 alpha = 0.5 + 0.3*r、宽 2、dash [6,6]
     *   r      = 命中时 e = (sin(4*time)+1)/2，未命中 0.4*e
     *   颜色   命中 #d0663a / 常态 #c79857
     */
    function drawSweetSpotBand(view) {
      var kick = view.bandKick;
      if (!kick || view.landed) return;
      var k = metric.k;
      var breath = view.breath;
      if (typeof breath !== 'number') breath = 0.5;
      var active = !!view.bandActive;
      var r = active ? breath : 0.4 * breath;
      /* 四期：带宽随 state.bandJitter 随机变化（判定与渲染同源，公平） */
      var jit = typeof view.bandJitter === 'number' && view.bandJitter > 0 ? view.bandJitter : 1;
      var halfW = kick.bandHalfWidth * jit;
      var top = metric.playTop + (kick.bandCenter - halfW) * metric.playHeight;
      var height = 2 * halfW * metric.playHeight;
      var x0 = (bandCfg.edgePad !== undefined ? bandCfg.edgePad : 16) * k;
      var w = fieldWidth - x0 * 2;
      var fillBase = bandCfg.fillBase !== undefined ? bandCfg.fillBase : 0.16;
      var fillGain = bandCfg.fillGain !== undefined ? bandCfg.fillGain : 0.12;
      var strokeBase = bandCfg.strokeBase !== undefined ? bandCfg.strokeBase : 0.5;
      var strokeGain = bandCfg.strokeGain !== undefined ? bandCfg.strokeGain : 0.3;
      var dashUnit = bandCfg.dashUnit !== undefined ? bandCfg.dashUnit : 6;
      var lineWidth = bandCfg.strokeWidth !== undefined ? bandCfg.strokeWidth : 2;
      var color = active
        ? (bandCfg.hitColor || '#d0663a')
        : (bandCfg.restColor || '#c79857');

      ctx.save();
      ctx.globalAlpha = fillBase + fillGain * r;
      ctx.fillStyle = color;
      ctx.fillRect(x0, top, w, height);
      ctx.globalAlpha = strokeBase + strokeGain * r;
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth * k;
      ctx.setLineDash([dashUnit * k, dashUnit * k]);
      ctx.strokeRect(x0, top, w, height);
      ctx.setLineDash([]);
      ctx.restore();
    }

    /*
     * 命中辉光环（原版：毽子进带后围绕毽子的呼吸圆环）：
     * radius = 34 + 6*e2，alpha = 0.4 + 0.4*e2，e2 = (sin(8*time)+1)/2，宽 3，#d0663a。
     */
    function drawHitGlow(view) {
      if (!view.bandActive || view.landed || !view.shuttle) return;
      var k = metric.k;
      var e2 = view.glowBreath;
      if (typeof e2 !== 'number') e2 = 0.5;
      ctx.save();
      ctx.globalAlpha = (bandCfg.glowAlphaBase !== undefined ? bandCfg.glowAlphaBase : 0.4) +
        (bandCfg.glowAlphaGain !== undefined ? bandCfg.glowAlphaGain : 0.4) * e2;
      ctx.strokeStyle = bandCfg.hitColor || '#d0663a';
      ctx.lineWidth = (bandCfg.glowWidth !== undefined ? bandCfg.glowWidth : 3) * k;
      ctx.beginPath();
      ctx.arc(
        view.shuttle.x,
        view.shuttle.y,
        ((bandCfg.glowRadius !== undefined ? bandCfg.glowRadius : 34) +
          (bandCfg.glowRadiusGain !== undefined ? bandCfg.glowRadiusGain : 6) * e2) * k,
        0,
        Math.PI * 2
      );
      ctx.stroke();
      ctx.restore();
    }

    /* ---------- 风：视觉反馈 ---------- */
    /* 风纹：短横线随风速漂移，浓度随庭院风级（windLevel 在 render 里向视图收敛） */
    function updateStreaks(dt) {
      if (windLevel < 0.04) {
        streaks.length = 0;
        return;
      }
      var want = Math.round(3 + windLevel * 9);
      while (streaks.length < want) {
        streaks.push({
          x: Math.random() * fieldWidth,
          y: 40 + Math.random() * (HORIZON_Y - 20),
          len: 26 + Math.random() * 46,
          v: 90 + Math.random() * 130,
          a: 0.06 + Math.random() * 0.1
        });
      }
      if (streaks.length > want) streaks.splice(want, streaks.length - want);
      for (var i = 0; i < streaks.length; i++) {
        var s = streaks[i];
        s.x += s.v * (0.3 + windLevel) * dt;
        if (s.x > fieldWidth + 60) {
          s.x = -s.len - Math.random() * 80;
          s.y = 40 + Math.random() * (HORIZON_Y - 20);
        }
      }
    }

    function drawStreaks() {
      if (!streaks.length) return;
      ctx.save();
      ctx.lineCap = 'round';
      for (var i = 0; i < streaks.length; i++) {
        var s = streaks[i];
        ctx.globalAlpha = s.a * (0.4 + windLevel * 0.8);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(s.x - s.len * 0.5, s.y);
        ctx.quadraticCurveTo(s.x, s.y - 2.2, s.x + s.len * 0.5, s.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    /* ---------- 庭院障碍物（原版 drawCourtyardBackground 几何逐项复刻） ---------- */
    /*
     * lantern：立杆 rgba(76,58,34,0.4) 从 0.1*groundY 到 0.26*groundY-16，
     *           accentTint 椭圆 12x16 于 (0.86W, 0.26*groundY)；
     * ledge：  rgba(122,87,54,0.28) 双横台 0.34*groundY、高 10，左右各占 0.32W；
     * line：   rgba(76,58,34,0.35) 线宽 2，(0, 0.22*groundY) 到 (W, 0.3*groundY)。
     * 尺寸按 metric.k 从 CSS 像素换算到虚拟空间。
     */
    function drawObstacle(palette) {
      var kind = palette.obstacle;
      if (!kind || kind === 'none') return;
      var k = metric.k;
      var g = groundY;
      if (kind === 'lantern') {
        var lx = fieldWidth * 0.86;
        var ly = g * 0.26;
        ctx.strokeStyle = 'rgba(76,58,34,0.4)';
        ctx.lineWidth = 1 * k;
        ctx.beginPath();
        ctx.moveTo(lx, g * 0.1);
        ctx.lineTo(lx, ly - 16 * k);
        ctx.stroke();
        ctx.fillStyle = palette.accentTint || '#c79857';
        ctx.beginPath();
        ctx.ellipse(lx, ly, 12 * k, 16 * k, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(76,58,34,0.4)';
        ctx.lineWidth = 1 * k;
        ctx.beginPath();
        ctx.ellipse(lx, ly, 12 * k, 16 * k, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (kind === 'ledge') {
        ctx.fillStyle = 'rgba(122,87,54,0.28)';
        ctx.fillRect(0, g * 0.34, fieldWidth * 0.32, 10 * k);
        ctx.fillRect(fieldWidth * 0.68, g * 0.34, fieldWidth * 0.32, 10 * k);
      } else if (kind === 'line') {
        ctx.strokeStyle = 'rgba(76,58,34,0.35)';
        ctx.lineWidth = 2 * k;
        ctx.beginPath();
        ctx.moveTo(0, g * 0.22);
        ctx.lineTo(fieldWidth, g * 0.3);
        ctx.stroke();
      }
    }

    /* ---------- 毽子 ---------- */
    function drawTrail(tier) {
      for (var i = 0; i < trail.length; i++) {
        var t = trail[i];
        var k = (i + 1) / trail.length;
        ctx.globalAlpha = k * 0.18;
        ctx.fillStyle = tier.feathers[0];
        ctx.beginPath();
        ctx.ellipse(t.x, t.y - 10, 2.4 + k * 5.4, 2.0 + k * 4.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    /*
     * 接地阴影：小而实。
     * 半径远小于判定环、有明确的方向偏移（光源在左上，影子偏右下），随高度淡出。
     */
    function drawShadow(bird) {
      var height = Math.max(0, groundY - bird.y);
      var k = Math.min(1, height / 300);
      var rx = 13 - k * 5;
      var ry = rx * 0.34;
      var alpha = 0.46 - k * 0.34;
      if (alpha <= 0.02) return;

      ctx.save();
      ctx.translate(bird.x + 7, groundY - 1);
      ctx.scale(1, ry / rx);
      var g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, 'rgba(16,9,16,' + alpha + ')');
      g.addColorStop(0.6, 'rgba(16,9,16,' + alpha * 0.66 + ')');
      g.addColorStop(1, 'rgba(16,9,16,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawBird(bird, tier, glow, angle) {
      var R = birdRadius();
      paintShuttlecock(ctx, bird.x, bird.y, R * BIRD_SPAN, tier, bird.spin, glow || 0, angle || 0);
    }

    /* ---------- 暗角 ---------- */
    function drawVignette() {
      var grad = ctx.createRadialGradient(fieldWidth / 2, VIEW_HEIGHT * 0.46, VIEW_HEIGHT * 0.3, fieldWidth / 2, VIEW_HEIGHT * 0.5, VIEW_HEIGHT * 0.98);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.52)');
      ctx.fillStyle = grad;
      ctx.fillRect(-10, -10, fieldWidth + 20, VIEW_HEIGHT + 20);
    }

    /* ---------- 主绘制 ----------
     * view = {
     *   palette    场景配色（当前庭院，含原版 groundTint/accentTint/obstacle）
     *   tier       羽色档位（feathers / accent）
     *   shuttle    毽子状态 { x, y, spin, angle }（已换算到虚拟空间）
     *   bandKick   已解锁中倍率最高的踢法（原版唯一上带的带），null = 不画
     *   bandActive 毽子当前处于带内（resolveKick 命中）
     *   breath     带呼吸亮度 (sin(4*time)+1)/2
     *   glowBreath 命中环呼吸 (sin(8*time)+1)/2
     *   glow       带内强度 0..1（毽子自身辉光，纯视觉）
     *   metric     玩法几何（虚拟空间）：k / playTop / playHeight / groundY
     *   wind       风强度归一化 0..1
     *   landed     是否已落地
     * }
     */
    function render(time, view) {
      if (!view) return;
      var palette = view.palette || view.tier || {};
      var tier = view.tier || palette;
      var bird = view.shuttle || { x: fieldWidth / 2, y: groundY, spin: 0 };
      var dt = time - lastTime;
      lastTime = time;
      view0 = view;
      if (view.metric) {
        metric = view.metric;
        groundY = metric.groundY;
      }
      if (dt < 0) dt = 0;
      if (dt > 0.1) dt = 0.1;
      windLevel += ((view.wind || 0) - windLevel) * Math.min(1, dt * 2.4);

      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      ctx.clearRect(0, 0, fieldWidth, VIEW_HEIGHT);

      ctx.save();
      /* 屏幕微缩放脉冲 */
      if (pulse > 0.002) {
        var k = 1 + pulse * 0.022;
        ctx.translate(fieldWidth / 2, VIEW_HEIGHT / 2);
        ctx.scale(k, k);
        ctx.translate(-fieldWidth / 2, -VIEW_HEIGHT / 2);
      }
      if (shake > 0.05) {
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      }

      /* 远景 */
      drawSky(palette, time);
      drawStreaks();
      drawSeeds(palette, time);
      drawRidge(palette);
      /* 中景 */
      drawMid(palette);
      drawObstacle(palette);

      /* 近景：地面、甜区带、接地阴影、命中辉光环、毽子 */
      ctx.save();
      ctx.translate(0, pNear);
      drawGround(palette);
      drawSweetSpotBand(view);
      drawShadow(bird);
      drawHitGlow(view);
      drawTrail(tier);
      drawBird(bird, tier, view.glow || 0, view.landed ? 0 : bird.angle);

      var i;
      /* 涟漪：地面上的柔光椭圆环 */
      for (i = 0; i < ripples.length; i++) {
        var r = ripples[i];
        var alpha = 1 - r.life / r.max;
        ctx.globalAlpha = alpha * 0.32;
        ctx.fillStyle = r.color;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, r.r, r.r * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha * 0.7;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 1.2 + alpha * 2.2;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, r.r * 0.94, r.r * 0.28, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      /* 冲击环 */
      for (i = 0; i < rings.length; i++) {
        var g = rings[i];
        var ga = 1 - g.life / g.max;
        ctx.globalAlpha = ga * 0.75;
        ctx.strokeStyle = g.color;
        ctx.lineWidth = g.width * ga + 0.6;
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      /* 粒子与扬尘 */
      for (i = 0; i < particles.length; i++) {
        var p = particles[i];
        var pa = 1 - p.life / p.max;
        ctx.globalAlpha = pa;
        ctx.fillStyle = p.color;
        var size = p.size * (1 + p.grow * p.life);
        ctx.beginPath();
        ctx.arc(p.x, p.y, size * (0.4 + pa * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      drawVignette();
      ctx.restore();

      if (flash) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalAlpha = flash.alpha;
        ctx.fillStyle = flash.color;
        ctx.fillRect(0, 0, cssW, cssH);
        ctx.globalAlpha = 1;
      }
    }

    /* 记录轨迹点 */
    function pushTrail(bird) {
      trail.push({ x: bird.x, y: bird.y });
      if (trail.length > 14) trail.shift();
    }

    return {
      resize: resize,
      ensureSize: ensureSize,
      getLayout: getLayout,
      getFieldWidth: function () { return fieldWidth; },
      getScale: function () { return scale; },
      getBirdCssSize: birdCssSize,
      burst: burst,
      dust: dust,
      ripple: ripple,
      ring: ring,
      addShake: addShake,
      addFlash: addFlash,
      addPulse: addPulse,
      addParallax: addParallax,
      clearEffects: clearEffects,
      updateEffects: updateEffects,
      pushTrail: pushTrail,
      render: render,
      setReducedMotion: function (v) { reduced = !!v; },
      isReducedMotion: function () { return reduced; }
    };
  }

  root.JianziRender = {
    createRenderer: createRenderer,
    paintShuttlecock: paintShuttlecock,
    BIRD_SPAN: BIRD_SPAN,
    HORIZON_Y: HORIZON_Y
  };
})(typeof window !== 'undefined' ? window : global);
