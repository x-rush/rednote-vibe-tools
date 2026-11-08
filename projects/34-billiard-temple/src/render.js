/*
 * 弹珠神殿 · 渲染层
 * Canvas 2D。虚拟殿堂 300×480，等比缩放到舞台中央。
 * 场景：夜色中的神殿内室，金线勾墙，石柱与滑动的石条，地上的玉球与悬浮的宝石。
 * Chrome 61 基线：不用 roundRect / clip-path 等新特性。
 */
(function (root) {
  'use strict';

  var ARENA_W = 300;
  var ARENA_H = 480;

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  function createRenderer(canvas) {
    var ctx = canvas.getContext('2d');
    var dpr = 1;
    var cssW = 0;
    var cssH = 0;
    var scale = 1;
    var offX = 0;
    var offY = 0;
    var reduced = false;
    var sparks = [];
    var lastTime = 0;

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
      scale = Math.min(cssW / ARENA_W, cssH / ARENA_H);
      offX = (cssW - ARENA_W * scale) / 2;
      offY = (cssH - ARENA_H * scale) / 2;
      return true;
    }

    /* 特效：宝石碎裂的光点 */
    function burst(x, y, color) {
      for (var i = 0; i < 14; i++) {
        var a = (Math.PI * 2 * i) / 14 + (i % 3) * 0.2;
        var sp = 40 + (i % 5) * 22;
        sparks.push({
          x: x,
          y: y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 30,
          life: 0,
          max: 0.55,
          color: color,
          size: 1.6 + (i % 3) * 0.7
        });
      }
      if (sparks.length > 160) sparks.splice(0, sparks.length - 160);
    }

    function clearEffects() {
      sparks.length = 0;
    }

    function updateEffects(dt) {
      for (var i = sparks.length - 1; i >= 0; i--) {
        var s = sparks[i];
        s.life += dt;
        if (s.life >= s.max) {
          sparks.splice(i, 1);
          continue;
        }
        s.vy += 240 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      }
    }

    /* ---------- 背景 ---------- */
    function drawRoom(theme) {
      var grad = ctx.createLinearGradient(0, 0, 0, ARENA_H);
      grad.addColorStop(0, theme.top);
      grad.addColorStop(0.62, theme.bottom);
      grad.addColorStop(1, theme.floor);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, ARENA_W, ARENA_H);

      /* 墙面砖缝 */
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (var y = 26; y < ARENA_H; y += 26) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(ARENA_W, y);
        ctx.stroke();
      }
      for (var row = 0; row < 20; row++) {
        var yy = 26 + row * 26;
        var off = row % 2 === 0 ? 0 : 25;
        for (var x = off; x < ARENA_W; x += 50) {
          ctx.beginPath();
          ctx.moveTo(x, yy);
          ctx.lineTo(x, yy - 26);
          ctx.stroke();
        }
      }

      /* 两侧立柱 */
      var pillar = ctx.createLinearGradient(0, 0, 22, 0);
      pillar.addColorStop(0, 'rgba(0,0,0,0.26)');
      pillar.addColorStop(0.45, 'rgba(255,255,255,0.08)');
      pillar.addColorStop(1, 'rgba(0,0,0,0.3)');
      ctx.fillStyle = pillar;
      ctx.fillRect(0, 0, 16, ARENA_H);
      ctx.fillRect(ARENA_W - 16, 0, 16, ARENA_H);

      /* 地面 */
      var floor = ctx.createLinearGradient(0, ARENA_H - 64, 0, ARENA_H);
      floor.addColorStop(0, 'rgba(0,0,0,0)');
      floor.addColorStop(1, 'rgba(0,0,0,0.42)');
      ctx.fillStyle = floor;
      ctx.fillRect(0, ARENA_H - 64, ARENA_W, 64);
    }

    /* 金线勾出的墙框 */
    function drawFrame(theme) {
      ctx.strokeStyle = theme.wall;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.85;
      ctx.strokeRect(1.5, 1.5, ARENA_W - 3, ARENA_H - 3);
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = 1;
      ctx.strokeRect(6.5, 6.5, ARENA_W - 13, ARENA_H - 13);
      ctx.globalAlpha = 1;

      /* 四角装饰 */
      var corner = 16;
      ctx.strokeStyle = theme.wall;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.9;
      for (var i = 0; i < 4; i++) {
        var cx = i % 2 === 0 ? 4 : ARENA_W - 4;
        var cy = i < 2 ? 4 : ARENA_H - 4;
        var sx = i % 2 === 0 ? 1 : -1;
        var sy = i < 2 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(cx, cy + corner * sy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + corner * sx, cy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    /* 石柱与会动的石条 */
    function drawBlock(rect, theme, moving) {
      var grad = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
      grad.addColorStop(0, moving ? '#5a5168' : '#4a4457');
      grad.addColorStop(1, moving ? '#332f40' : '#2a2634');
      ctx.fillStyle = grad;
      roundRect(ctx, rect.x, rect.y, rect.w, rect.h, Math.min(5, rect.h / 2));
      ctx.fill();
      ctx.strokeStyle = theme.wall;
      ctx.lineWidth = 1.4;
      ctx.globalAlpha = moving ? 0.55 : 0.8;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    /* ---------- 宝石 ---------- */
    function drawGem(x, y, color, glow, time, taken) {
      if (taken) return;
      var pulse = 0.5 + 0.5 * Math.sin(time * 2.4);
      var r = 9 + pulse * 1.2;
      var halo = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
      halo.addColorStop(0, glow);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, r * 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(time * 0.9);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.72, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.72, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.72, 0);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    /* ---------- 玉球 ---------- */
    function drawBall(x, y, color, core) {
      var shadow = ctx.createRadialGradient(x, y + 5, 0, x, y + 5, 12);
      shadow.addColorStop(0, 'rgba(0,0,0,0.38)');
      shadow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = shadow;
      ctx.beginPath();
      ctx.arc(x, y + 5, 12, 0, Math.PI * 2);
      ctx.fill();

      var body = ctx.createRadialGradient(x - 2.5, y - 3, 1, x, y, 8);
      body.addColorStop(0, core);
      body.addColorStop(0.45, color);
      body.addColorStop(1, 'rgba(28,72,64,0.95)');
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(x - 2.2, y - 2.6, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }

    /* ---------- 瞄准线 ---------- */
    function drawAim(ball, hits, power, theme) {
      if (!hits || !hits.length) return;
      var strength = Math.min(1, power / 880);

      /* 第一段：实线 */
      ctx.strokeStyle = theme.wall;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.9;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(ball.x, ball.y);
      ctx.lineTo(hits[0].x, hits[0].y);
      ctx.stroke();

      /* 第二段：虚线，提示下一次反弹 */
      if (hits.length > 1) {
        ctx.globalAlpha = 0.4;
        ctx.setLineDash([5, 6]);
        ctx.beginPath();
        ctx.moveTo(hits[0].x, hits[0].y);
        ctx.lineTo(hits[1].x, hits[1].y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.globalAlpha = 1;

      /* 落点标记 */
      ctx.strokeStyle = theme.wall;
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.arc(hits[0].x, hits[0].y, 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      /* 力度环 */
      ctx.strokeStyle = theme.wall;
      ctx.lineWidth = 2.6;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * strength);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    /* ---------- 轨迹 ---------- */
    function drawTrail(path, color) {
      if (!path || path.length < 2) return;
      for (var i = 1; i < path.length; i++) {
        var a = i / path.length;
        ctx.strokeStyle = color;
        ctx.globalAlpha = a * 0.55;
        ctx.lineWidth = 0.6 + a * 2.4;
        ctx.beginPath();
        ctx.moveTo(path[i - 1].x, path[i - 1].y);
        ctx.lineTo(path[i].x, path[i].y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    /* ---------- 主绘制 ---------- */
    function render(time, view) {
      if (!view) return;
      var theme = view.theme;
      var dt = time - lastTime;
      lastTime = time;
      if (dt < 0) dt = 0;
      if (dt > 0.1) dt = 0.1;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offX, dpr * offY);

      drawRoom(theme);
      drawFrame(theme);

      var blocks = view.blocks || [];
      for (var i = 0; i < blocks.length; i++) drawBlock(blocks[i], theme, false);

      var props = view.props || [];
      for (var j = 0; j < props.length; j++) drawBlock(props[j], theme, true);

      if (view.trail) drawTrail(view.trail, view.gemColor || '#ffe9b8');

      var gems = view.gems || [];
      for (var k = 0; k < gems.length; k++) {
        drawGem(gems[k].x, gems[k].y, gems[k].color, gems[k].glow, time, gems[k].taken);
      }

      if (view.aim) drawAim(view.ball, view.aim.hits, view.aim.power, theme);

      drawBall(view.ball.x, view.ball.y, view.ballColor, view.ballCore);

      /* 光点 */
      for (var s = 0; s < sparks.length; s++) {
        var sp = sparks[s];
        var life = 1 - sp.life / sp.max;
        ctx.globalAlpha = life;
        ctx.fillStyle = sp.color;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.size * life, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    return {
      resize: resize,
      ensureSize: resize,
      getScale: function () { return scale; },
      getOffset: function () { return { x: offX, y: offY }; },
      toArena: function (clientX, clientY) {
        var rect = canvas.getBoundingClientRect();
        return {
          x: (clientX - rect.left - offX) / scale,
          y: (clientY - rect.top - offY) / scale
        };
      },
      burst: burst,
      clearEffects: clearEffects,
      updateEffects: updateEffects,
      render: render,
      setReducedMotion: function (v) { reduced = !!v; },
      isReducedMotion: function () { return reduced; }
    };
  }

  root.BilliardRender = {
    createRenderer: createRenderer,
    ARENA_W: ARENA_W,
    ARENA_H: ARENA_H
  };
})(typeof window !== 'undefined' ? window : global);
