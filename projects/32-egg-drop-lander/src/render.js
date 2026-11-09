/*
 * 蛋落地 · 渲染层（三期玩法重建：相机跟随的纵向空投）
 *
 * Canvas 2D。虚拟画布固定 340 高，宽度随屏幕变化；世界坐标系
 * x ∈ [-260, 260]、y ∈ [0, level.height] 等比缩放到虚拟画布：
 *   - 横向：整个世界宽度铺满画布（左右各留 8 虚拟单位边距）；
 *   - 纵向：相机跟随蛋（蛋锚定在画面上部），地面与障碍带随下落进入视野，
 *     接近地面时相机停住，蛋在最后一段里向地面线滑去 —— 留出判速时间。
 *
 * 视觉体系（沿用二期）：
 *   1. 材质三件套：蛋有渐变体积 + 左上高光 + 底部反射光 + 接地阴影；
 *   2. 光源统一左上；暗角收视线；玻璃 HUD 全部在 DOM，画布零文字；
 *   3. 新增：障碍带（木色 + 琥珀缺口柱）、风丝粒子、高度参考线、
 *      远山 / 树影 / 栅栏按视差系数随相机上移。
 *
 * Chrome 61 基线：不用 clip-path、filter、roundRect 等新特性；画布上不写字。
 */
(function (root) {
  'use strict';

  var VIEW_HEIGHT = 340;
  var WORLD_HALF = 260;
  var MARGIN_X = 8;        /* 世界宽度铺满画布后的左右边距（虚拟单位） */
  var TOP_PAD = 40;        /* 蛋出生点（y=0）距画布顶的虚拟距离 */
  var ANCHOR_V = 118;      /* 相机跟随锁定时蛋所在的虚拟 y */
  var GROUND_FRAC = 0.8;   /* 相机到底时地面线停在画布高度的 80% 处 */

  function createRenderer(canvas, content) {
    var ctx = canvas.getContext('2d');
    var meta = (content && content.meta) || {};
    var plxCfg = meta.parallax || { far: 0.25, mid: 0.5, near: 0.85 };

    var gameRef = root.EggGame || null;
    var EGG_HALF_W = gameRef ? gameRef.EGG_HALF_W : 32;
    var EGG_HALF_H = gameRef ? gameRef.EGG_HALF_H : 33;
    var WORLD = gameRef ? gameRef.WORLD_HALF : WORLD_HALF;

    var dpr = 1;
    var cssW = 0;
    var cssH = 0;
    var scale = 1;
    var fieldWidth = 250;
    var S = 0.42;            /* 世界 → 虚拟单位 的等比缩放 */
    var reduced = false;

    /* 相机 */
    var camY = 0;

    /* 特效（虚拟画布坐标） */
    var particles = [];
    var ripples = [];
    var rings = [];
    var shards = [];
    var shake = 0;
    var flash = null;
    var pulse = 0;
    var lastTime = 0;

    var motes = [];
    var streaks = [];

    function buildMotes() {
      var seed = 20261108;
      motes = [];
      for (var i = 0; i < 26; i++) {
        seed = (seed * 9301 + 49297) % 233280;
        var x = seed / 233280;
        seed = (seed * 9301 + 49297) % 233280;
        var y = seed / 233280;
        seed = (seed * 9301 + 49297) % 233280;
        motes.push({ x: x, y: y, r: 0.9 + (seed / 233280) * 2, phase: i * 0.8, speed: 0.1 + (i % 5) * 0.04 });
      }
    }

    function buildStreaks() {
      streaks = [];
      for (var i = 0; i < 10; i++) {
        streaks.push({
          x: (i * 0.117 + 0.03) % 1,
          y: (i * 0.197 + 0.05) % 1,
          len: 16 + (i % 4) * 12,
          speed: 26 + (i % 5) * 18,
          phase: i * 1.7
        });
      }
    }

    buildMotes();
    buildStreaks();

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
      S = (fieldWidth / 2 - MARGIN_X) / WORLD;
      return true;
    }

    function ensureSize() {
      return resize();
    }

    function getLayout() {
      return { scale: scale, fieldWidth: fieldWidth, cssWidth: cssW, cssHeight: cssH, worldScale: S };
    }

    function eggCssBox() {
      return {
        width: EGG_HALF_W * 2 * scale,
        height: EGG_HALF_H * 2 * scale
      };
    }

    function eggCssSize() {
      var box = eggCssBox();
      return Math.min(box.width, box.height);
    }

    /* ---------- 世界 ↔ 虚拟画布 ---------- */
    function worldToX(wx) {
      return fieldWidth / 2 + wx * S;
    }

    function worldToY(wy) {
      return (wy - camY) * S + TOP_PAD;
    }

    /* 屏幕点击位置（画布内 CSS px）→ 世界 x */
    function toWorldX(cssX) {
      return (cssX / scale - fieldWidth / 2) / S;
    }

    /* 世界坐标 → 虚拟画布坐标（特效生成用） */
    function toScreen(wx, wy) {
      return { x: worldToX(wx), y: worldToY(wy) };
    }

    /* 相机目标：跟随蛋，快到地面时停在 GROUND_FRAC 处 */
    function cameraTarget(view) {
      var height = view.level.height;
      var anchorWorld = (ANCHOR_V - TOP_PAD) / S;
      var camMax = height - (GROUND_FRAC * VIEW_HEIGHT - TOP_PAD) / S;
      if (camMax < 0) camMax = 0;
      var target = view.egg.y - anchorWorld;
      if (target < 0) target = 0;
      if (target > camMax) target = camMax;
      return target;
    }

    function resetCamera(view) {
      camY = cameraTarget(view);
    }

    /* ---------- 特效 ---------- */
    function burst(x, y, color, count, speed, gravity) {
      for (var i = 0; i < count; i++) {
        var a = Math.random() * Math.PI * 2;
        var v = speed * (0.3 + Math.random() * 0.95);
        particles.push({
          x: x, y: y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          life: 0,
          max: 0.34 + Math.random() * 0.42,
          size: 1.4 + Math.random() * 2.4,
          color: color,
          gravity: gravity === undefined ? 220 : gravity
        });
      }
      if (particles.length > 420) particles.splice(0, particles.length - 420);
    }

    /* 草屑：落地前从草坡崩起 */
    function grass(x, y, count, color) {
      for (var i = 0; i < count; i++) {
        var a = -Math.PI * (0.2 + Math.random() * 0.6);
        var v = 40 + Math.random() * 110;
        particles.push({
          x: x + (Math.random() - 0.5) * 26,
          y: y,
          vx: Math.cos(a) * v * 1.2,
          vy: Math.sin(a) * v,
          life: 0,
          max: 0.5 + Math.random() * 0.4,
          size: 1.6 + Math.random() * 2.6,
          color: color || 'rgba(168,224,138,0.9)',
          gravity: 320,
          grow: 0.6
        });
      }
      if (particles.length > 420) particles.splice(0, particles.length - 420);
    }

    /* 反推喷口：向下的火焰 + 一圈冲击环 */
    function jet(x, y, dirX, color) {
      for (var i = 0; i < 16; i++) {
        var spread = (Math.random() - 0.5) * 0.7;
        var v = 58 + Math.random() * 100;
        particles.push({
          x: x + (Math.random() - 0.5) * 7,
          y: y + 4,
          vx: Math.sin(spread) * v + dirX * 26,
          vy: Math.cos(spread) * v,
          life: 0,
          max: 0.26 + Math.random() * 0.2,
          size: 1.8 + Math.random() * 2.4,
          color: color,
          gravity: 60
        });
      }
      ripples.push({ x: x, y: y + 4, r: 3, maxR: 28, life: 0, max: 0.3, color: color });
    }

    function ripple(x, y, color, maxR) {
      ripples.push({ x: x, y: y, r: 4, maxR: maxR || 36, life: 0, max: 0.45, color: color });
      if (ripples.length > 60) ripples.shift();
    }

    /* 蛋壳光环：完美着陆 / 反推命中的暖色光环 */
    function halo(x, y, color, maxR) {
      rings.push({ x: x, y: y, r: 6, maxR: maxR || 74, life: 0, max: 0.6, color: color, width: 4 });
      if (rings.length > 40) rings.shift();
    }

    /* 蛋壳碎片：一段圆弧填充，像真的壳片 */
    function shells(x, y, count) {
      for (var i = 0; i < count; i++) {
        var a = -Math.PI * (0.15 + Math.random() * 0.7);
        var v = 90 + Math.random() * 190;
        shards.push({
          x: x + (Math.random() - 0.5) * 16,
          y: y + (Math.random() - 0.5) * 16,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          rot: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 12,
          life: 0,
          max: 0.7 + Math.random() * 0.6,
          size: 3.2 + Math.random() * 3.4,
          color: i % 3 === 0 ? '#fffaf0' : (i % 3 === 1 ? '#f3e3c4' : '#e2c9a2')
        });
      }
      if (shards.length > 120) shards.splice(0, shards.length - 120);
    }

    function drawVignette() {
      var g = ctx.createRadialGradient(
        fieldWidth * 0.42, VIEW_HEIGHT * 0.4, VIEW_HEIGHT * 0.22,
        fieldWidth * 0.5, VIEW_HEIGHT * 0.5, Math.max(fieldWidth, VIEW_HEIGHT) * 0.78
      );
      g.addColorStop(0, 'rgba(12,32,26,0)');
      g.addColorStop(0.62, 'rgba(12,32,26,0.1)');
      g.addColorStop(1, 'rgba(8,24,20,0.5)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, fieldWidth, VIEW_HEIGHT);
    }

    function addShake(amount) {
      shake = Math.min(12, shake + amount);
    }

    function addFlash(color, alpha) {
      flash = { color: color, alpha: alpha };
    }

    function addPulse(amount) {
      pulse = Math.min(1.4, pulse + (amount || 1));
    }

    function clearEffects() {
      particles.length = 0;
      ripples.length = 0;
      rings.length = 0;
      shards.length = 0;
      shake = 0;
      flash = null;
      pulse = 0;
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
        r.r = 4 + (r.maxR - 4) * (1 - Math.pow(1 - k, 2));
      }
      for (i = rings.length - 1; i >= 0; i--) {
        var g = rings[i];
        g.life += dt;
        if (g.life >= g.max) { rings.splice(i, 1); continue; }
        var k2 = g.life / g.max;
        g.r = 6 + (g.maxR - 6) * (1 - Math.pow(1 - k2, 2));
      }
      for (i = shards.length - 1; i >= 0; i--) {
        var s = shards[i];
        s.life += dt;
        if (s.life >= s.max) { shards.splice(i, 1); continue; }
        s.vy += 620 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= 0.985;
        s.rot += s.vr * dt;
      }
      if (shake > 0) shake = Math.max(0, shake - dt * 24);
      if (pulse > 0) pulse = Math.max(0, pulse - dt * 3.4);
    }

    /* ---------- 天空：清晨色 + 日轮 + 云带 + 浮尘 ---------- */
    function drawSky(time, view) {
      var grad = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
      grad.addColorStop(0, meta.sky[0]);
      grad.addColorStop(0.52, meta.sky[1]);
      grad.addColorStop(1, meta.sky[2]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, fieldWidth, VIEW_HEIGHT);

      /* 日轮：左上光源 */
      var sunX = fieldWidth * 0.2;
      var sunY = 52;
      var haloGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 76);
      haloGrad.addColorStop(0, meta.sun);
      haloGrad.addColorStop(0.22, meta.sun);
      haloGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 76, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      var disc = ctx.createRadialGradient(sunX - 5, sunY - 6, 1, sunX, sunY, 22);
      disc.addColorStop(0, '#fffdf2');
      disc.addColorStop(0.6, meta.sun);
      disc.addColorStop(1, 'rgba(255,214,160,0.75)');
      ctx.fillStyle = disc;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 21, 0, Math.PI * 2);
      ctx.fill();

      /* 云带：随相机缓慢上移，给出「在下降」的深度反馈 */
      var cloudShift = (camY * S * 0.06) % 150;
      ctx.globalAlpha = 0.22;
      for (var c = 0; c < 4; c++) {
        var cy = 40 + c * 34 + cloudShift;
        if (cy > VIEW_HEIGHT + 40) cy -= 150;
        var cw = fieldWidth * (0.4 + c * 0.13);
        var cx = fieldWidth * (0.16 + c * 0.24) + Math.sin(time * 0.05 + c) * 10;
        var ch = 6 + c * 1.5;
        var cloud = ctx.createRadialGradient(cx, cy, 0, cx, cy, cw);
        cloud.addColorStop(0, 'rgba(255,250,236,0.6)');
        cloud.addColorStop(0.7, 'rgba(255,246,226,0.16)');
        cloud.addColorStop(1, 'rgba(255,246,226,0)');
        ctx.fillStyle = cloud;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1, ch / cw);
        ctx.beginPath();
        ctx.arc(0, 0, cw, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      /* 浮尘 */
      ctx.fillStyle = '#ffffff';
      var moteShift = (camY * S * 0.12) % (VIEW_HEIGHT + 60);
      for (var i = 0; i < motes.length; i++) {
        var m = motes[i];
        var drift = (time * m.speed * 22) % (fieldWidth + 60);
        var x = fieldWidth + 30 - drift;
        var y = m.y * (VIEW_HEIGHT - 60) - moteShift + Math.sin(time * 0.8 + m.phase) * 9;
        if (y < -20) y += VIEW_HEIGHT + 60;
        ctx.globalAlpha = 0.2 + 0.22 * Math.abs(Math.sin(time * 0.6 + m.phase));
        ctx.beginPath();
        ctx.arc(x, y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (view && view.level) drawWindStreaks(time, view.level.wind || 0);
    }

    /* 风丝：方向 = 风向，密度/速度随风强（纯线条，画布零文字） */
    function drawWindStreaks(time, wind) {
      if (!wind) return;
      var dir = wind > 0 ? 1 : -1;
      var strength = Math.min(1, Math.abs(wind) / 110);
      ctx.globalAlpha = 0.14 + strength * 0.16;
      ctx.strokeStyle = '#dff3f4';
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      for (var i = 0; i < streaks.length; i++) {
        var st = streaks[i];
        var travel = (time * st.speed * (0.5 + strength) + st.phase * 40) % (fieldWidth + 140);
        var x = dir > 0 ? travel - 70 : fieldWidth + 70 - travel;
        var y = st.y * VIEW_HEIGHT + Math.sin(time * 1.3 + st.phase) * 6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + dir * st.len * (0.6 + strength), y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    /* ---------- 高度参考线：每 300 世界单位一条淡线 ---------- */
    function drawAltitudeLines(view) {
      var level = view.level;
      var top = camY - 40 / S;
      var bottom = camY + VIEW_HEIGHT / S;
      var stepW = 300;
      var first = Math.ceil(Math.max(0, top) / stepW) * stepW;
      ctx.strokeStyle = 'rgba(255,255,255,0.09)';
      ctx.lineWidth = 1;
      for (var wy = first; wy < Math.min(level.height - 240, bottom); wy += stepW) {
        var y = worldToY(wy);
        if (y < -10 || y > VIEW_HEIGHT + 10) continue;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(fieldWidth, y);
        ctx.stroke();
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(14, y);
        ctx.moveTo(fieldWidth - 14, y);
        ctx.lineTo(fieldWidth, y);
        ctx.strokeStyle = 'rgba(255,255,255,0.28)';
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.09)';
      }
    }

    /* ---------- 侧墙：世界 ±260 的反弹边界 ---------- */
    function drawWalls() {
      var lx = worldToX(-WORLD);
      var rx = worldToX(WORLD);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(0, 0, Math.max(0, lx), VIEW_HEIGHT);
      ctx.fillRect(rx, 0, Math.max(0, fieldWidth - rx), VIEW_HEIGHT);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(lx - 1.5, 0, 1.5, VIEW_HEIGHT);
      ctx.fillRect(rx, 0, 1.5, VIEW_HEIGHT);
    }

    /* ---------- 视差远景：以地面线为锚，随蛋接近而升上画面 ---------- */
    function layerBaseY(view, p) {
      var groundY = worldToY(view.level.height);
      var gap = Math.max(0, view.level.height - view.egg.y);
      return groundY + gap * S * (1 - p);
    }

    function drawRidge(view) {
      var baseY = layerBaseY(view, plxCfg.far);
      if (baseY < -60 || baseY > VIEW_HEIGHT + 260) return;
      ctx.globalAlpha = 0.38;
      ctx.fillStyle = meta.farRidge;
      ctx.beginPath();
      ctx.moveTo(-20, baseY + 10);
      for (var x = -20; x <= fieldWidth + 20; x += 16) {
        var y = baseY - 96 - Math.sin(x * 0.0092) * 22 - Math.sin(x * 0.021 + 1.7) * 9;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(fieldWidth + 20, baseY + 10);
      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = 0.6;
      ctx.fillStyle = meta.midTree;
      ctx.beginPath();
      ctx.moveTo(-20, baseY + 10);
      for (var x2 = -20; x2 <= fieldWidth + 20; x2 += 12) {
        var y2 = baseY - 58 - Math.sin(x2 * 0.016 + 2.4) * 12 - Math.sin(x2 * 0.043) * 5;
        ctx.lineTo(x2, y2);
      }
      ctx.lineTo(fieldWidth + 20, baseY + 10);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    function drawTrees(view) {
      var baseY = layerBaseY(view, plxCfg.mid);
      if (baseY < -40 || baseY > VIEW_HEIGHT + 200) return;
      ctx.fillStyle = meta.midTree;
      ctx.globalAlpha = 0.85;
      var step = 52;
      for (var i = 0; i <= Math.ceil(fieldWidth / step) + 1; i++) {
        var tx = i * step + 16;
        var cr = 13 + ((i * 7) % 8);
        var ty = baseY - 44 - Math.sin(i * 1.7) * 6;
        ctx.fillRect(tx - 2, ty, 4, baseY - ty);
        ctx.beginPath();
        ctx.arc(tx, ty, cr, Math.PI, 0);
        ctx.arc(tx + cr * 0.78, ty + 4, cr * 0.72, Math.PI, 0);
        ctx.arc(tx - cr * 0.66, ty + 5, cr * 0.58, Math.PI, 0);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function drawFence(view) {
      var baseY = layerBaseY(view, plxCfg.near);
      if (baseY < -30 || baseY > VIEW_HEIGHT + 160) return;
      var railTop = baseY - 36;
      var railMid = baseY - 21;
      ctx.strokeStyle = meta.fence;
      ctx.lineWidth = 3.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-10, railTop);
      ctx.lineTo(fieldWidth + 10, railTop);
      ctx.moveTo(-10, railMid);
      ctx.lineTo(fieldWidth + 10, railMid);
      ctx.stroke();
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      var step = 52;
      for (var p = 0; p <= Math.ceil(fieldWidth / step) + 1; p++) {
        var px = p * step + 16;
        ctx.moveTo(px, railTop - 4);
        ctx.lineTo(px, baseY - 5);
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,246,214,0.26)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-10, railTop - 1.4);
      ctx.lineTo(fieldWidth + 10, railTop - 1.4);
      ctx.stroke();
    }

    /* ---------- 地面（y = height 的草坡） ---------- */
    function drawGround(view) {
      var groundY = worldToY(view.level.height);
      if (groundY - 20 > VIEW_HEIGHT) return;
      var grad = ctx.createLinearGradient(0, groundY, 0, VIEW_HEIGHT);
      grad.addColorStop(0, meta.ground);
      grad.addColorStop(1, '#14382c');
      ctx.fillStyle = grad;
      ctx.fillRect(-10, groundY, fieldWidth + 20, VIEW_HEIGHT - groundY + 20);

      ctx.fillStyle = meta.groundEdge;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(-10, groundY, fieldWidth + 20, 3);
      ctx.globalAlpha = 0.18;
      ctx.fillRect(-10, groundY + 14, fieldWidth + 20, 2);
      ctx.globalAlpha = 1;

      ctx.strokeStyle = meta.grassLight;
      ctx.lineWidth = 1.3;
      ctx.lineCap = 'round';
      for (var i = 0; i < 46; i++) {
        var gx = ((i * 89) % 1000) / 1000 * fieldWidth;
        var gh = 4 + ((i * 37) % 9);
        var lean = ((i % 5) - 2) * 1.6;
        ctx.globalAlpha = 0.28 + ((i * 13) % 7) / 24;
        ctx.beginPath();
        ctx.moveTo(gx, groundY + 4);
        ctx.quadraticCurveTo(gx + lean * 0.5, groundY - gh * 0.6, gx + lean, groundY - gh);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      for (var j = 0; j < 24; j++) {
        var px2 = ((j * 71) % 1000) / 1000 * fieldWidth;
        var py2 = groundY + 6 + ((j * 53) % 34);
        ctx.fillRect(px2, py2, 2, 1.4);
      }
    }

    /* ---------- 障碍带：木色横带 + 琥珀缺口柱 ---------- */
    function drawObstacle(view) {
      var ob = view.level.obstacle;
      if (!ob) return;
      var bandY = worldToY(ob.atY * view.level.height);
      var thick = Math.max(13, 30 * S);
      if (bandY + thick < -20 || bandY - thick > VIEW_HEIGHT + 20) return;
      var gameRef2 = root.EggGame;
      var gapCx = gameRef2 ? gameRef2.gapCenterX(view.level) : (ob.gapCenter - 0.5) * 2 * WORLD;
      /* 缺口画成判定同一把尺：通行半宽 = 2×gapHalf×260（原版判定式） */
      var gapHalfW = gameRef2 ? gameRef2.gapPassHalf(view.level) : 2 * ob.gapHalf * WORLD;
      var gapL = worldToX(gapCx - gapHalfW);
      var gapR = worldToX(gapCx + gapHalfW);
      var top = bandY - thick / 2;

      var wood = ctx.createLinearGradient(0, top, 0, top + thick);
      wood.addColorStop(0, '#7d5a35');
      wood.addColorStop(0.4, meta.band || '#6b4a2b');
      wood.addColorStop(1, '#4a3018');
      ctx.fillStyle = wood;
      if (gapL > 0) ctx.fillRect(0, top, Math.min(gapL, fieldWidth), thick);
      if (gapR < fieldWidth) ctx.fillRect(Math.max(0, gapR), top, fieldWidth - Math.max(0, gapR), thick);

      /* 带面上沿受光 + 板缝 */
      ctx.fillStyle = 'rgba(255,236,203,0.32)';
      if (gapL > 0) ctx.fillRect(0, top, Math.min(gapL, fieldWidth), 2);
      if (gapR < fieldWidth) ctx.fillRect(Math.max(0, gapR), top, fieldWidth - Math.max(0, gapR), 2);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      var tick = 16;
      var start = Math.floor(0 / tick) * tick;
      for (var x = start; x < fieldWidth; x += tick) {
        if (x > gapL - 3 && x < gapR + 3) continue;
        ctx.fillRect(x, top + 3, 1.2, thick - 6);
      }

      /* 缺口柱：琥珀色提示可穿行 */
      ctx.fillStyle = meta.bandEdge || '#ffb03a';
      ctx.fillRect(gapL - 2, top - thick * 0.5, 3.4, thick * 2);
      ctx.fillRect(gapR - 1.4, top - thick * 0.5, 3.4, thick * 2);
      ctx.globalAlpha = 0.35;
      ctx.fillRect(gapL - 2, top - thick * 0.5 - 10, 3.4, 10);
      ctx.fillRect(gapR - 1.4, top - thick * 0.5 - 10, 3.4, 10);
      ctx.globalAlpha = 1;
    }

    /* ---------- 落点阴影 ---------- */
    function drawLandingShadow(view) {
      var level = view.level;
      var egg = view.egg;
      var gap = level.height - egg.y;
      if (gap > 620) return;
      var k = Math.min(1, gap / 620);
      var alpha = 0.3 - k * 0.2;
      if (alpha <= 0.02) return;
      var sx = worldToX(egg.x);
      var sy = worldToY(level.height) - 2;
      ctx.globalAlpha = Math.max(0.04, alpha);
      ctx.fillStyle = view.speedRatio > 0.8 ? '#c04a3a' : '#0d2b1e';
      ctx.beginPath();
      ctx.ellipse(sx, sy, 12 + (1 - k) * 10, (12 + (1 - k) * 10) * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    /* ---------- 蛋 ---------- */
    function eggPath(w, h) {
      ctx.beginPath();
      ctx.moveTo(0, -h);
      ctx.bezierCurveTo(w * 0.52, -h * 0.9, w, -h * 0.34, w, h * 0.16);
      ctx.bezierCurveTo(w, h * 0.74, w * 0.56, h, 0, h);
      ctx.bezierCurveTo(-w * 0.56, h, -w, h * 0.74, -w, h * 0.16);
      ctx.bezierCurveTo(-w, -h * 0.34, -w * 0.52, -h * 0.9, 0, -h);
      ctx.closePath();
    }

    function drawEgg(view) {
      var egg = view.egg;
      var w = EGG_HALF_W;
      var h = EGG_HALF_H;
      var speed = view.speedRatio;
      var pos = toScreen(egg.x, egg.y);

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(egg.spin);

      /* 反推喷焰：jet 计时器还在烧的时候就画 */
      if (egg.jet > 0) {
        var flameLen = 10 + 14 * (egg.jet / 0.18);
        var flame = ctx.createLinearGradient(0, h * 0.7, 0, h * 0.7 + flameLen);
        flame.addColorStop(0, 'rgba(255,220,120,0.95)');
        flame.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = flame;
        ctx.beginPath();
        ctx.moveTo(-7, h * 0.7);
        ctx.lineTo(7, h * 0.7);
        ctx.lineTo(0, h * 0.7 + flameLen);
        ctx.closePath();
        ctx.fill();
      }

      /* 蛋壳外投影 */
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = '#4a2f18';
      eggPath(w + 1.5, h + 1.5);
      ctx.translate(3.4, 4.2);
      eggPath(w + 1.5, h + 1.5);
      ctx.fill();
      ctx.restore();

      /* 蛋体 */
      var body = ctx.createRadialGradient(-w * 0.34, -h * 0.42, w * 0.06, w * 0.06, h * 0.1, h * 1.45);
      body.addColorStop(0, meta.egg.shell[0]);
      body.addColorStop(0.55, meta.egg.shell[1]);
      body.addColorStop(1, meta.egg.shell[2]);
      ctx.fillStyle = body;
      eggPath(w, h);
      ctx.fill();

      /* 底部反射光 */
      ctx.save();
      eggPath(w, h);
      ctx.clip();
      var bounce = ctx.createLinearGradient(0, h * 0.05, 0, h);
      bounce.addColorStop(0, 'rgba(255,217,160,0)');
      bounce.addColorStop(1, 'rgba(255,217,160,0.55)');
      ctx.fillStyle = bounce;
      ctx.fillRect(-w, -h, w * 2, h * 2);

      var rim = ctx.createRadialGradient(w * 0.72, h * 0.6, w * 0.1, w * 0.72, h * 0.6, w * 1.1);
      rim.addColorStop(0, 'rgba(255,240,205,0.5)');
      rim.addColorStop(1, 'rgba(255,240,205,0)');
      ctx.fillStyle = rim;
      ctx.fillRect(-w, -h, w * 2, h * 2);
      ctx.restore();

      /* 左上高光 */
      ctx.fillStyle = meta.egg.highlight;
      ctx.beginPath();
      ctx.ellipse(-w * 0.34, -h * 0.42, w * 0.2, h * 0.28, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath();
      ctx.ellipse(-w * 0.42, -h * 0.52, w * 0.08, h * 0.12, -0.35, 0, Math.PI * 2);
      ctx.fill();

      /* 斑点 */
      ctx.fillStyle = meta.egg.spot;
      var spots = [
        [-0.34, -0.4, 0.11], [0.3, -0.12, 0.09], [-0.16, 0.34, 0.08],
        [0.4, 0.44, 0.07], [-0.46, 0.2, 0.06], [0.12, 0.62, 0.06]
      ];
      for (var i = 0; i < spots.length; i++) {
        ctx.beginPath();
        ctx.ellipse(spots[i][0] * w, spots[i][1] * h, spots[i][2] * w, spots[i][2] * w * 1.1, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      /* 超速裂纹预警（0.75 限速线之后出现） */
      if (egg.crack > 0.02) {
        ctx.strokeStyle = 'rgba(190,90,60,' + (0.3 + egg.crack * 0.6).toFixed(2) + ')';
        ctx.lineWidth = 1 + egg.crack * 1.1;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-w * 0.26, -h * 0.52);
        ctx.lineTo(-w * 0.1, -h * 0.18);
        ctx.lineTo(-w * 0.34, h * 0.24);
        ctx.moveTo(-w * 0.1, -h * 0.18);
        ctx.lineTo(w * 0.26, -h * 0.26);
        ctx.moveTo(-w * 0.1, -h * 0.18);
        ctx.lineTo(w * 0.1, h * 0.1);
        ctx.stroke();
      }
      ctx.restore();

      /* 速度环：接近限速时变红收窄 */
      if (speed > 0.45) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.85, (speed - 0.45) * 1.7);
        ctx.strokeStyle = speed > 0.85 ? '#ff7a5c' : '#ffc46b';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, h + (1 - Math.min(1, speed)) * 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    /* ---------- 主绘制 ---------- */
    function render(time, view) {
      if (!view) return;
      var dt = time - lastTime;
      lastTime = time;
      if (dt < 0) dt = 0;
      if (dt > 0.1) dt = 0.1;

      /* 相机平滑跟随 */
      var target = cameraTarget(view);
      camY += (target - camY) * Math.min(1, dt * 10);
      if (Math.abs(target - camY) < 0.5) camY = target;

      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      ctx.clearRect(0, 0, fieldWidth, VIEW_HEIGHT);

      ctx.save();
      if (shake > 0.05) {
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      }
      if (pulse > 0.02) {
        var s = 1 + pulse * 0.035;
        ctx.translate(fieldWidth / 2, VIEW_HEIGHT / 2);
        ctx.scale(s, s);
        ctx.translate(-fieldWidth / 2, -VIEW_HEIGHT / 2);
      }

      drawSky(time, view);
      drawAltitudeLines(view);
      drawRidge(view);
      drawTrees(view);
      drawFence(view);
      drawWalls();
      drawGround(view);
      drawObstacle(view);
      drawLandingShadow(view);
      drawEgg(view);

      var i;
      for (i = 0; i < ripples.length; i++) {
        var r = ripples[i];
        var alpha = 1 - r.life / r.max;
        ctx.globalAlpha = alpha * 0.85;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 2 + alpha * 2.2;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      for (i = 0; i < rings.length; i++) {
        var g = rings[i];
        var ga = 1 - g.life / g.max;
        ctx.globalAlpha = ga * 0.8;
        ctx.strokeStyle = g.color;
        ctx.lineWidth = g.width * ga;
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      for (i = 0; i < particles.length; i++) {
        var p = particles[i];
        var pa = 1 - p.life / p.max;
        ctx.globalAlpha = pa;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + pa * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (i = 0; i < shards.length; i++) {
        var sh = shards[i];
        var sha = 1 - sh.life / sh.max;
        ctx.save();
        ctx.globalAlpha = sha;
        ctx.translate(sh.x, sh.y);
        ctx.rotate(sh.rot);
        ctx.fillStyle = sh.color;
        ctx.beginPath();
        ctx.arc(0, 0, sh.size, Math.PI * 0.15, Math.PI * 1.05);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      ctx.restore();
      drawVignette();

      if (flash) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalAlpha = flash.alpha;
        ctx.fillStyle = flash.color;
        ctx.fillRect(0, 0, cssW, cssH);
        ctx.globalAlpha = 1;
      }
    }

    return {
      resize: resize,
      ensureSize: ensureSize,
      getLayout: getLayout,
      getFieldWidth: function () { return fieldWidth; },
      getScale: function () { return scale; },
      getWorldScale: function () { return S; },
      getEggCssSize: eggCssSize,
      toWorldX: toWorldX,
      toScreen: toScreen,
      resetCamera: resetCamera,
      burst: burst,
      grass: grass,
      jet: jet,
      ripple: ripple,
      halo: halo,
      shells: shells,
      addShake: addShake,
      addFlash: addFlash,
      addPulse: addPulse,
      clearEffects: clearEffects,
      updateEffects: updateEffects,
      render: render,
      setReducedMotion: function (v) { reduced = !!v; },
      isReducedMotion: function () { return reduced; }
    };
  }

  root.EggRender = { createRenderer: createRenderer, VIEW_HEIGHT: VIEW_HEIGHT };
})(typeof window !== 'undefined' ? window : global);
