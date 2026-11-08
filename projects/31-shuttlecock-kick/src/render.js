/*
 * 毽子连击 · 渲染层
 *
 * Canvas 2D。内部使用固定的 400x640 虚拟坐标系，按画布高度等比缩放，
 * 保证不同机型的抛物线高度与操作窗口完全一致。
 * Chrome 61 基线：不用 clip-path、filter、roundRect 等新特性。
 */
(function (root) {
  'use strict';

  var VIEW_HEIGHT = 380;
  var GROUND_Y = 330;

  function createRenderer(canvas) {
    var ctx = canvas.getContext('2d');
    var dpr = 1;
    var cssW = 0;
    var cssH = 0;
    var scale = 1;
    var fieldWidth = 400;
    var groundY = GROUND_Y;
    var reduced = false;

    var particles = [];
    var ripples = [];
    var texts = [];
    var shake = 0;
    var flash = null;
    var trail = [];
    var stars = [];
    var seeds = [];
    var lastTime = 0;

    function buildBackdrop() {
      var seed = 20261108;
      stars = [];
      seeds = [];
      for (var i = 0; i < 70; i++) {
        seed = (seed * 9301 + 49297) % 233280;
        var sx = (seed / 233280) * 1000;
        seed = (seed * 9301 + 49297) % 233280;
        var sy = (seed / 233280) * 460;
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
    }
    buildBackdrop();

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
      return true;
    }

    function ensureSize() {
      return resize();
    }

    function getLayout() {
      return { scale: scale, fieldWidth: fieldWidth, cssWidth: cssW, cssHeight: cssH, groundY: groundY };
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
          gravity: 260
        });
      }
      if (particles.length > 420) particles.splice(0, particles.length - 420);
    }

    function ripple(x, y, color, maxR) {
      ripples.push({ x: x, y: y, r: 6, maxR: maxR || 40, life: 0, max: 0.42, color: color });
      if (ripples.length > 60) ripples.shift();
    }

    function popText(x, y, text, color, size) {
      texts.push({ x: x, y: y, text: text, life: 0, max: 0.9, color: color, size: size || 22 });
      if (texts.length > 24) texts.shift();
    }

    function addShake(amount) {
      shake = Math.min(14, shake + amount);
    }

    function addFlash(color, alpha) {
      flash = { color: color, alpha: alpha };
    }

    function clearEffects() {
      particles.length = 0;
      ripples.length = 0;
      texts.length = 0;
      trail.length = 0;
      shake = 0;
      flash = null;
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
        r.r = 6 + (r.maxR - 6) * (1 - Math.pow(1 - k, 2));
      }
      for (i = texts.length - 1; i >= 0; i--) {
        var t = texts[i];
        t.life += dt;
        if (t.life >= t.max) { texts.splice(i, 1); continue; }
        t.y -= dt * 42;
      }
      if (shake > 0) shake = Math.max(0, shake - dt * 26);
    }

    /* ---------- 背景 ---------- */
    function drawSky(tier, time) {
      var grad = ctx.createLinearGradient(0, 0, 0, groundY + 40);
      grad.addColorStop(0, tier.sky[0]);
      grad.addColorStop(0.52, tier.sky[1]);
      grad.addColorStop(1, tier.sky[2]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, fieldWidth, VIEW_HEIGHT);

      if (tier.stars) {
        for (var i = 0; i < stars.length; i++) {
          var st = stars[i];
          var tw = 0.45 + 0.55 * Math.abs(Math.sin(time * 1.3 + st.phase));
          ctx.globalAlpha = 0.28 + tw * 0.55;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(st.x * fieldWidth, st.y * VIEW_HEIGHT * 0.72, st.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      /* 日月：压在画面很上方，避开接球线所在的 27% 高度 */
      var sunX = fieldWidth * 0.78;
      var sunY = 46;
      var halo = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 70);
      halo.addColorStop(0, tier.sun);
      halo.addColorStop(0.22, tier.sun);
      halo.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = tier.sun;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 19, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawHills(tier) {
      /* 远处两层起伏的操场树影 */
      ctx.fillStyle = 'rgba(24,16,34,0.30)';
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      for (var x = 0; x <= fieldWidth; x += 12) {
        var y = groundY - 40 - Math.sin(x * 0.013) * 13 - Math.sin(x * 0.031 + 1.2) * 7;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(fieldWidth, groundY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(18,12,28,0.46)';
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      for (var x2 = 0; x2 <= fieldWidth; x2 += 10) {
        var y2 = groundY - 16 - Math.sin(x2 * 0.02 + 2.4) * 8;
        ctx.lineTo(x2, y2);
      }
      ctx.lineTo(fieldWidth, groundY);
      ctx.closePath();
      ctx.fill();
    }

    function drawGround(tier) {
      var grad = ctx.createLinearGradient(0, groundY, 0, VIEW_HEIGHT);
      grad.addColorStop(0, tier.ground);
      grad.addColorStop(1, '#0d0a14');
      ctx.fillStyle = grad;
      ctx.fillRect(0, groundY, fieldWidth, VIEW_HEIGHT - groundY);

      /* 操场跑道的边线 */
      ctx.fillStyle = tier.groundEdge;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(0, groundY, fieldWidth, 3);
      ctx.globalAlpha = 0.16;
      ctx.fillRect(0, groundY + 16, fieldWidth, 2);
      ctx.globalAlpha = 1;

      /* 跳房子格纹 */
      ctx.strokeStyle = 'rgba(255,255,255,0.09)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (var i = 0; i < 9; i++) {
        var x = 24 + i * ((fieldWidth - 48) / 8);
        ctx.moveTo(x, groundY + 8);
        ctx.lineTo(x, VIEW_HEIGHT);
      }
      ctx.stroke();
    }

    function drawSeeds(tier, time) {
      ctx.fillStyle = tier.accent;
      for (var i = 0; i < seeds.length; i++) {
        var s = seeds[i];
        var drift = (time * s.speed * 26) % (fieldWidth + 80);
        var x = fieldWidth + 40 - drift;
        var y = s.y * VIEW_HEIGHT + Math.sin(time * 0.9 + s.phase) * 12;
        ctx.globalAlpha = 0.3 + 0.25 * Math.abs(Math.sin(time * 0.7 + s.phase));
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    /* ---------- 接球线 ---------- */
    function drawCatchLine(catchY, inWindow, perfectY, bird) {
      /*
       * 柔光带：中间最实、两端淡出。
       * 先压一条深色底衬再叠亮芯，保证在亮天空和暗夜色两种底色下都看得清。
       */
      var under = ctx.createLinearGradient(0, 0, fieldWidth, 0);
      under.addColorStop(0, 'rgba(58,28,18,0)');
      under.addColorStop(0.5, 'rgba(58,28,18,0.34)');
      under.addColorStop(1, 'rgba(58,28,18,0)');

      var core = ctx.createLinearGradient(0, 0, fieldWidth, 0);
      if (inWindow) {
        core.addColorStop(0, 'rgba(150,255,214,0)');
        core.addColorStop(0.5, 'rgba(170,255,222,0.98)');
        core.addColorStop(1, 'rgba(150,255,214,0)');
      } else {
        core.addColorStop(0, 'rgba(255,248,236,0)');
        core.addColorStop(0.5, 'rgba(255,248,236,0.92)');
        core.addColorStop(1, 'rgba(255,248,236,0)');
      }

      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = under;
      ctx.lineWidth = inWindow ? 5 : 4;
      ctx.beginPath();
      ctx.moveTo(0, catchY);
      ctx.lineTo(fieldWidth, catchY);
      ctx.stroke();

      ctx.strokeStyle = core;
      ctx.lineWidth = inWindow ? 2.6 : 1.7;
      ctx.beginPath();
      ctx.moveTo(0, catchY);
      ctx.lineTo(fieldWidth, catchY);
      ctx.stroke();
      ctx.restore();

      /* 地面接球区：脚下这一块地方才是真正能踢的窗口 */
      var halfW = 40;
      var x = bird ? bird.x : fieldWidth / 2;
      var zone = ctx.createLinearGradient(x - halfW, 0, x + halfW, 0);
      if (inWindow) {
        zone.addColorStop(0, 'rgba(124,240,200,0)');
        zone.addColorStop(0.5, 'rgba(170,255,222,0.95)');
        zone.addColorStop(1, 'rgba(124,240,200,0)');
      } else {
        zone.addColorStop(0, 'rgba(255,248,236,0)');
        zone.addColorStop(0.5, 'rgba(255,248,236,0.6)');
        zone.addColorStop(1, 'rgba(255,248,236,0)');
      }
      ctx.save();
      ctx.strokeStyle = zone;
      ctx.lineWidth = inWindow ? 4.5 : 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - halfW, groundY - 3);
      ctx.lineTo(x + halfW, groundY - 3);
      ctx.stroke();
      ctx.restore();

      if (perfectY > catchY + 6) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,214,140,0.55)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([5, 8]);
        ctx.beginPath();
        ctx.moveTo(x - halfW * 0.7, perfectY);
        ctx.lineTo(x + halfW * 0.7, perfectY);
        ctx.stroke();
        ctx.restore();
      }
    }

    /* ---------- 毽子 ---------- */
    function drawTrail(tier) {
      for (var i = 0; i < trail.length; i++) {
        var t = trail[i];
        var k = (i + 1) / trail.length;
        ctx.globalAlpha = k * 0.16;
        ctx.fillStyle = tier.feathers[1];
        ctx.beginPath();
        ctx.arc(t.x, t.y - 14, 2.2 + k * 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function drawShadow(bird) {
      var height = Math.max(0, groundY - bird.y);
      var k = Math.min(1, height / 320);
      var rx = 15 - k * 6;
      var alpha = 0.36 - k * 0.24;
      if (alpha <= 0.02) return;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(bird.x, groundY - 3, rx, rx * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    function drawBird(bird, tier, glow) {
      ctx.save();
      ctx.translate(bird.x, bird.y);

      var n = 7;
      var spread = 0.30;
      var R = 31;
      var grad = ctx.createLinearGradient(0, -R - 14, 0, 2);
      grad.addColorStop(0, tier.feathers[0]);
      grad.addColorStop(0.55, tier.feathers[1]);
      grad.addColorStop(1, tier.feathers[2]);
      ctx.fillStyle = grad;
      ctx.beginPath();
      for (var i = 0; i < n; i++) {
        var ang = -Math.PI / 2 + bird.spin + (i - (n - 1) / 2) * spread;
        ctx.moveTo(0, -9);
        ctx.arc(0, -9, R, ang - 0.2, ang + 0.2);
      }
      ctx.closePath();
      ctx.fill();

      /* 羽毛分界线 */
      ctx.strokeStyle = 'rgba(90,60,45,0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var j = 0; j < n; j++) {
        var a2 = -Math.PI / 2 + bird.spin + (j - (n - 1) / 2) * spread;
        ctx.moveTo(0, -9);
        ctx.lineTo(Math.cos(a2) * (R - 3), -9 + Math.sin(a2) * (R - 3));
      }
      ctx.stroke();

      /* 羽毛高光 */
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-6, -R - 4, 9, 5, -0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      /* 铃铛 */
      var bell = ctx.createRadialGradient(-1.4, -12.6, 0.5, 0, -10, 5.4);
      bell.addColorStop(0, '#fff3bf');
      bell.addColorStop(0.5, '#e8b54a');
      bell.addColorStop(1, '#a97518');
      ctx.fillStyle = bell;
      ctx.beginPath();
      ctx.arc(0, -10, 5.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(120,80,10,0.55)';
      ctx.fillRect(-2.4, -9.4, 4.8, 1.3);

      /* 皮托 */
      var cork = ctx.createRadialGradient(-4, -4, 1, 0, 0, 15);
      cork.addColorStop(0, '#f3e3c6');
      cork.addColorStop(0.6, '#d9bf95');
      cork.addColorStop(1, '#8d6a45');
      ctx.fillStyle = cork;
      ctx.beginPath();
      ctx.ellipse(0, -1.5, 13, 7.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(70,44,28,0.85)';
      ctx.beginPath();
      ctx.ellipse(0, 3.4, 13, 4.4, 0, 0, Math.PI * 2);
      ctx.fill();

      if (glow > 0) {
        ctx.globalAlpha = Math.min(0.7, glow);
        ctx.strokeStyle = '#9dffd8';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(0, -14, R * 0.86 + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.restore();
    }

    /* ---------- 主绘制 ---------- */
    function render(time, view) {
      if (!view) return;
      var tier = view.tier;
      var bird = view.bird;
      var dt = time - lastTime;
      lastTime = time;
      if (dt < 0) dt = 0;
      if (dt > 0.1) dt = 0.1;

      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      ctx.clearRect(0, 0, fieldWidth, VIEW_HEIGHT);

      ctx.save();
      if (shake > 0.05) {
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      }

      drawSky(tier, time);
      drawSeeds(tier, time);
      drawHills(tier);
      drawGround(tier);
      drawCatchLine(view.catchY, view.inWindow, view.perfectY, bird);
      drawShadow(bird);
      drawTrail(tier);
      drawBird(bird, tier, view.glow || 0);

      var i;
      for (i = 0; i < ripples.length; i++) {
        var r = ripples[i];
        var alpha = 1 - r.life / r.max;
        ctx.globalAlpha = alpha * 0.8;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 2 + alpha * 2.4;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
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

      for (i = 0; i < texts.length; i++) {
        var t = texts[i];
        var ta = t.life / t.max;
        ctx.globalAlpha = ta < 0.2 ? ta / 0.2 : 1 - Math.max(0, (ta - 0.55) / 0.45);
        ctx.fillStyle = t.color;
        ctx.font = '800 ' + t.size + 'px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(t.text, t.x, t.y);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';

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
      burst: burst,
      ripple: ripple,
      popText: popText,
      addShake: addShake,
      addFlash: addFlash,
      clearEffects: clearEffects,
      updateEffects: updateEffects,
      pushTrail: pushTrail,
      render: render,
      setReducedMotion: function (v) { reduced = !!v; },
      isReducedMotion: function () { return reduced; }
    };
  }

  root.JianziRender = { createRenderer: createRenderer };
})(typeof window !== 'undefined' ? window : global);
