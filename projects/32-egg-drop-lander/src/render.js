/*
 * 蛋落地 · 渲染层
 * Canvas 2D。虚拟画布固定 420 高，宽度随屏幕变化，只做等比缩放。
 * 场景：清晨露台，蛋落在一片大叶子上；空气阻力让蛋飘得又慢又稳。
 * Chrome 61 基线：不用 clip-path、filter 等新特性。
 */
(function (root) {
  'use strict';

  var VIEW_HEIGHT = 420;
  var GROUND_Y = 372;

  function createRenderer(canvas) {
    var ctx = canvas.getContext('2d');
    var dpr = 1;
    var cssW = 0;
    var cssH = 0;
    var scale = 1;
    var fieldWidth = 400;
    var reduced = false;

    var particles = [];
    var ripples = [];
    var texts = [];
    var shake = 0;
    var flash = null;
    var lastTime = 0;
    var motes = [];

    function buildMotes() {
      var seed = 20261109;
      motes = [];
      for (var i = 0; i < 22; i++) {
        seed = (seed * 9301 + 49297) % 233280;
        var x = (seed / 233280);
        seed = (seed * 9301 + 49297) % 233280;
        var y = (seed / 233280);
        seed = (seed * 9301 + 49297) % 233280;
        motes.push({ x: x, y: y, r: 0.8 + (seed / 233280) * 1.8, phase: i * 0.9, speed: 0.12 + (i % 5) * 0.05 });
      }
    }
    buildMotes();

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

    function getLayout() {
      return { scale: scale, fieldWidth: fieldWidth, cssWidth: cssW, cssHeight: cssH, groundY: GROUND_Y };
    }

    /* ---------- 特效 ---------- */
    function burst(x, y, color, count, speed, gravity) {
      for (var i = 0; i < count; i++) {
        var a = Math.random() * Math.PI * 2;
        var v = speed * (0.3 + Math.random() * 0.95);
        particles.push({
          x: x,
          y: y,
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

    function jet(x, y, dirX, color) {
      /* 喷口：向下的火焰 + 一圈冲击环 */
      for (var i = 0; i < 14; i++) {
        var spread = (Math.random() - 0.5) * 0.7;
        var v = 55 + Math.random() * 95;
        particles.push({
          x: x + (Math.random() - 0.5) * 7,
          y: y + 4,
          vx: Math.sin(spread) * v + dirX * 26,
          vy: Math.cos(spread) * v,
          life: 0,
          max: 0.24 + Math.random() * 0.2,
          size: 1.6 + Math.random() * 2.2,
          color: color,
          gravity: 60
        });
      }
      ripples.push({ x: x, y: y + 4, r: 3, maxR: 26, life: 0, max: 0.3, color: color });
    }

    function ripple(x, y, color, maxR) {
      ripples.push({ x: x, y: y, r: 4, maxR: maxR || 36, life: 0, max: 0.45, color: color });
      if (ripples.length > 60) ripples.shift();
    }

    function popText(x, y, text, color, size) {
      texts.push({ x: x, y: y, text: text, life: 0, max: 0.95, color: color, size: size || 21 });
      if (texts.length > 24) texts.shift();
    }

    function addShake(amount) {
      shake = Math.min(12, shake + amount);
    }

    function addFlash(color, alpha) {
      flash = { color: color, alpha: alpha };
    }

    function clearEffects() {
      particles.length = 0;
      ripples.length = 0;
      texts.length = 0;
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
      }
      for (i = ripples.length - 1; i >= 0; i--) {
        var r = ripples[i];
        r.life += dt;
        if (r.life >= r.max) { ripples.splice(i, 1); continue; }
        var k = r.life / r.max;
        r.r = 4 + (r.maxR - 4) * (1 - Math.pow(1 - k, 2));
      }
      for (i = texts.length - 1; i >= 0; i--) {
        var t = texts[i];
        t.life += dt;
        if (t.life >= t.max) { texts.splice(i, 1); continue; }
        t.y -= dt * 40;
      }
      if (shake > 0) shake = Math.max(0, shake - dt * 24);
    }

    /* ---------- 背景 ---------- */
    function drawSky(meta, time) {
      var grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y + 30);
      grad.addColorStop(0, meta.sky[0]);
      grad.addColorStop(0.5, meta.sky[1]);
      grad.addColorStop(1, meta.sky[2]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, fieldWidth, VIEW_HEIGHT);

      var sunX = fieldWidth * 0.24;
      var sunY = 62;
      var halo = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 70);
      halo.addColorStop(0, meta.sun);
      halo.addColorStop(0.24, meta.sun);
      halo.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = meta.sun;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 24, 0, Math.PI * 2);
      ctx.fill();

      /* 空气里的浮尘 */
      ctx.fillStyle = '#ffffff';
      for (var i = 0; i < motes.length; i++) {
        var m = motes[i];
        var drift = (time * m.speed * 22) % (fieldWidth + 60);
        var x = fieldWidth + 30 - drift;
        var y = m.y * (GROUND_Y - 40) + Math.sin(time * 0.8 + m.phase) * 9;
        ctx.globalAlpha = 0.22 + 0.22 * Math.abs(Math.sin(time * 0.6 + m.phase));
        ctx.beginPath();
        ctx.arc(x, y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function drawHills(meta) {
      ctx.fillStyle = 'rgba(60,110,102,0.28)';
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      for (var x = 0; x <= fieldWidth; x += 12) {
        var y = GROUND_Y - 52 - Math.sin(x * 0.011) * 16 - Math.sin(x * 0.027 + 1.1) * 8;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(fieldWidth, GROUND_Y);
      ctx.closePath();
      ctx.fill();
    }

    function drawGround(meta) {
      var grad = ctx.createLinearGradient(0, GROUND_Y, 0, VIEW_HEIGHT);
      grad.addColorStop(0, meta.ground);
      grad.addColorStop(1, '#1b2c2a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, GROUND_Y, fieldWidth, VIEW_HEIGHT - GROUND_Y);
      ctx.fillStyle = meta.groundEdge;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(0, GROUND_Y, fieldWidth, 3);
      ctx.globalAlpha = 1;
    }

    /* ---------- 叶子垫 ---------- */
    function drawPad(meta, view) {
      var level = view.level;
      var x = view.padX;
      var y = level.padY;
      var w = level.padW;
      var h = Math.max(14, w * 0.2);

      /* 影子 */
      ctx.globalAlpha = 0.09;
      ctx.fillStyle = '#12301f';
      ctx.beginPath();
      ctx.ellipse(x, y + h * 0.85, w * 0.5, h * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      /* 叶面：左右对称的尖椭圆 */
      var leaf = ctx.createLinearGradient(0, y - h, 0, y + h);
      leaf.addColorStop(0, meta.leaf[0]);
      leaf.addColorStop(0.55, meta.leaf[1]);
      leaf.addColorStop(1, meta.leaf[2]);
      ctx.fillStyle = leaf;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y);
      ctx.quadraticCurveTo(x, y - h * 1.55, x + w / 2, y);
      ctx.quadraticCurveTo(x, y + h * 0.62, x - w / 2, y);
      ctx.closePath();
      ctx.fill();

      /* 叶脉 */
      ctx.strokeStyle = 'rgba(255,255,255,0.34)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y);
      ctx.quadraticCurveTo(x, y - h * 1.45, x + w / 2, y);
      ctx.stroke();
      /* 侧脉：起点必须落在叶面轮廓内（叶面上凸约 0.78h、下缘约 0.31h） */
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      for (var i = 1; i < 6; i++) {
        var t = i / 6;
        var bx = x - w / 2 + w * t;
        var by = y - Math.sin(t * Math.PI) * h * 0.55;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + (i % 2 ? 5 : -5), by + h * 0.26);
        ctx.stroke();
      }
    }

    /* ---------- 蛋 ---------- */
    function drawEgg(meta, view) {
      var egg = view.egg;
      var r = 11;
      var speed = view.speedRatio;

      /* 影子：投在蛋的正下方，越接近垫子越大，越快越红 */
      var level = view.level;
      var height = Math.max(0, level.padY - egg.y);
      var k = Math.min(1, height / 260);
      var alpha = 0.3 - k * 0.16;
      if (alpha > 0.02) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = speed > 0.75 ? '#c04a3a' : '#12301f';
        ctx.beginPath();
        ctx.ellipse(egg.x, level.padY - 2, 9 + k * 6, (9 + k * 6) * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      ctx.save();
      ctx.translate(egg.x, egg.y);
      ctx.rotate(egg.spin);

      var body = ctx.createRadialGradient(-3, -4, 1, 0, 0, r * 1.5);
      body.addColorStop(0, '#fffdf6');
      body.addColorStop(0.62, '#f6ead4');
      body.addColorStop(1, '#d9c3a1');
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.86, r * 1.1, 0, 0, Math.PI * 2);
      ctx.fill();

      /* 蛋壳斑点 */
      ctx.fillStyle = 'rgba(190,160,120,0.55)';
      var spots = [[-3, -4, 1.3], [3, -1, 1.1], [-1.5, 3.5, 1], [4, 4.5, 0.9], [-4.5, 2, 0.8]];
      for (var i = 0; i < spots.length; i++) {
        ctx.beginPath();
        ctx.arc(spots[i][0], spots[i][1], spots[i][2], 0, Math.PI * 2);
        ctx.fill();
      }

      /* 接近安全线时出现裂纹预警 */
      if (egg.crack > 0.02) {
        ctx.strokeStyle = 'rgba(190,90,60,' + (0.3 + egg.crack * 0.6).toFixed(2) + ')';
        ctx.lineWidth = 0.9 + egg.crack * 0.9;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-3, -7);
        ctx.lineTo(-1, -2);
        ctx.lineTo(-4, 3);
        ctx.moveTo(-1, -2);
        ctx.lineTo(3, -3);
        ctx.moveTo(-1, -2);
        ctx.lineTo(1, 1);
        ctx.stroke();
      }
      ctx.restore();

      /* 速度环：套在蛋外面，接近安全线时变红并收窄 */
      if (speed > 0.45) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.85, (speed - 0.45) * 1.7);
        ctx.strokeStyle = speed > 0.85 ? '#ff7a5c' : '#ffc46b';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(egg.x, egg.y, 15 + (1 - Math.min(1, speed)) * 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    /* ---------- 主绘制 ---------- */
    function render(time, view) {
      if (!view) return;
      var meta = view.meta;
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

      drawSky(meta, time);
      drawHills(meta);
      drawGround(meta);
      drawPad(meta, view);
      drawEgg(meta, view);

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

    return {
      resize: resize,
      ensureSize: resize,
      getLayout: getLayout,
      getFieldWidth: function () { return fieldWidth; },
      getScale: function () { return scale; },
      burst: burst,
      jet: jet,
      ripple: ripple,
      popText: popText,
      addShake: addShake,
      addFlash: addFlash,
      clearEffects: clearEffects,
      updateEffects: updateEffects,
      render: render,
      setReducedMotion: function (v) { reduced = !!v; },
      isReducedMotion: function () { return reduced; }
    };
  }

  root.EggRender = { createRenderer: createRenderer };
})(typeof window !== 'undefined' ? window : global);
