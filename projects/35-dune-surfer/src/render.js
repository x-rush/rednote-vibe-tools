/*
 * 沙丘速降 · 渲染层
 *
 * Canvas 2D。竖屏俯视坡面：用透视投影把「世界距离」投到屏幕上——
 * 近处刷得很快（速度感），远处被压缩（看得远，能提前反应）。
 *
 * Chrome 61 基线：不用 roundRect / clip-path 等新特性。
 */
(function (root) {
  'use strict';

  var WORLD_W = 300;

  function createRenderer(canvas) {
    var ctx = canvas.getContext('2d');
    var dpr = 1;
    var cssW = 0;
    var cssH = 0;
    var scale = 1;
    var offX = 0;
    var horizonY = 0;
    var playerY = 0;
    var depthK = 300;      /* 透视压缩系数 */
    var dust = [];
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

      /* 横向：世界 300 宽铺满屏幕，但横屏时收窄成居中的一条坡 */
      var fieldW = Math.min(cssW, 520);
      scale = fieldW / WORLD_W;
      offX = (cssW - fieldW) / 2;
      horizonY = Math.round(cssH * 0.2);
      playerY = Math.round(cssH * 0.7);
      return true;
    }

    /* 世界横向 → 屏幕横向 */
    function sx(x) {
      return offX + x * scale;
    }

    /* 玩家前方 ds 个世界单位 → 屏幕纵深（透视压缩） */
    function projectY(ds) {
      var d = playerY - horizonY;
      var h = ds / (ds + depthK);
      return playerY - d * h;
    }

    /* 世界距离 s（相对玩家的前向距离）→ 屏幕 y */
    function worldY(ds) {
      return projectY(ds);
    }

    /* 坡面的起伏（屏幕像素，向下为正） */
    function surfaceOffset(x, s) {
      return root.DuneGame.surface(x, s);
    }

    /* 坡面在某个世界点的屏幕高度 */
    function groundY(x, ds, s) {
      var h = ds / (ds + depthK);
      return projectY(ds) + surfaceOffset(x, s) * (1 - h * 0.62);
    }

    /* ---------- 粒子 ---------- */
    function spray(x, y, vx, vy, color, size) {
      for (var i = 0; i < 3; i++) {
        dust.push({
          x: x,
          y: y,
          vx: vx + (Math.random() - 0.5) * 60,
          vy: vy + (Math.random() - 0.5) * 40,
          life: 0,
          max: 0.45 + Math.random() * 0.35,
          color: color,
          size: size * (0.6 + Math.random() * 0.8)
        });
      }
      if (dust.length > 220) dust.splice(0, dust.length - 220);
    }

    function burst(x, y, color, count) {
      for (var i = 0; i < (count || 10); i++) {
        var a = Math.random() * Math.PI * 2;
        var sp = 60 + Math.random() * 160;
        dust.push({
          x: x,
          y: y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 40,
          life: 0,
          max: 0.5 + Math.random() * 0.4,
          color: color,
          size: 1.4 + Math.random() * 1.8
        });
      }
      if (dust.length > 220) dust.splice(0, dust.length - 220);
    }

    function clearEffects() {
      dust.length = 0;
    }

    function updateEffects(dt) {
      for (var i = dust.length - 1; i >= 0; i--) {
        var p = dust[i];
        p.life += dt;
        if (p.life >= p.max) {
          dust.splice(i, 1);
          continue;
        }
        p.vy += 260 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }

    /* ---------- 背景 ---------- */
    function drawSky(band, time, fallX) {
      var grad = ctx.createLinearGradient(0, 0, 0, horizonY + 40);
      grad.addColorStop(0, band.skyTop);
      grad.addColorStop(0.72, band.skyBottom);
      grad.addColorStop(1, band.sandDark);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cssW, horizonY + 40);

      /* 太阳/月亮，跟着落水线左右挪 */
      var sunX = sx(fallX);
      var sunY = horizonY - 18;
      var halo = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 120);
      halo.addColorStop(0, band.sun);
      halo.addColorStop(0.35, band.sun);
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 120, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = band.sun;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    /* 远处的沙丘剪影 */
    function drawFarDunes(band, s) {
      ctx.fillStyle = band.sandDark;
      ctx.globalAlpha = 0.55;
      for (var layer = 0; layer < 3; layer++) {
        var off = (s * (0.06 + layer * 0.03)) % 900;
        var baseY = horizonY - 6 + layer * 5;
        ctx.beginPath();
        ctx.moveTo(0, horizonY + 40);
        for (var x = 0; x <= cssW; x += 24) {
          var u = (x + off) / 260 + layer * 2.1;
          var y = baseY - 26 * Math.sin(u) - 12 * Math.sin(u * 2.3 + 1.1);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(cssW, horizonY + 40);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    /* 沙面 */
    function drawSand(band) {
      var grad = ctx.createLinearGradient(0, horizonY, 0, cssH);
      grad.addColorStop(0, band.sandDark);
      grad.addColorStop(0.35, band.sand);
      grad.addColorStop(1, band.sandDark);
      ctx.fillStyle = grad;
      ctx.fillRect(0, horizonY, cssW, cssH - horizonY);
    }

    /* 沙丘等高线：一条条横贯画面的曲线，是速度感的主要来源 */
    function drawContours(band, s, time) {
      var spacing = 118;
      var first = Math.floor(s / spacing) - 1;
      for (var k = 0; k < 16; k++) {
        var ws = (first + k) * spacing;
        var ds = ws - s;
        if (ds < -40) continue;
        var y0 = projectY(ds);
        if (y0 < horizonY - 6) continue;
        if (y0 > cssH + 30) break;
        var hh = ds / (ds + depthK);
        var alpha = 0.42 * (1 - hh * 0.62);
        if (alpha <= 0.03) continue;
        ctx.strokeStyle = band.sandDark;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 1.2 + 2.4 * (1 - hh);
        ctx.beginPath();
        for (var x = 0; x <= WORLD_W; x += 10) {
          var y = groundY(x, ds, ws);
          if (x === 0) ctx.moveTo(sx(x), y);
          else ctx.lineTo(sx(x), y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    /*
     * 「落水线」：坡上最快的那条线，会左右游走。
     * 玩家必须追着它跑才快——这条线必须画出来，否则机制等于不存在。
     *
     * 现在这条线是全作的地基（快车道），所以不只画一根亮线，
     * 还把整条走廊涂出来：暖色的一带 = 坡最陡的地方 = 跑得最快的地方。
     */
    function drawFastLine(band, s) {
      var half = root.DuneGame.CHUTE_HALF;
      var left = [];
      var right = [];
      var mid = [];
      for (var i = 0; i <= 14; i++) {
        /* 近端故意画到屏幕下方去，不然走廊会在画面底部被切成一块平台 */
        var ds = -260 + i * 190;
        var wx = root.DuneGame.fallLine(s + ds);
        var y = projectY(ds);
        left.push({ x: sx(wx - half), y: y });
        right.push({ x: sx(wx + half), y: y });
        mid.push({ x: sx(wx), y: y });
      }
      if (mid.length < 2) return;

      /* 走廊：越远越淡，像一条收束的沙沟 */
      ctx.beginPath();
      ctx.moveTo(left[0].x, left[0].y);
      for (var a = 1; a < left.length; a++) ctx.lineTo(left[a].x, left[a].y);
      for (var b = right.length - 1; b >= 0; b--) ctx.lineTo(right[b].x, right[b].y);
      ctx.closePath();
      ctx.fillStyle = band.lane || band.sun;
      ctx.globalAlpha = 0.3;
      ctx.fill();
      ctx.globalAlpha = 1;

      /* 走廊边缘的柔光 */
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = band.lane || band.sun;
      for (var j = 1; j < mid.length; j++) {
        var t = j / mid.length;
        ctx.globalAlpha = 0.34 * (1 - t * 0.8);
        ctx.lineWidth = (4 - 2.6 * t) * scale;
        ctx.beginPath();
        ctx.moveTo(left[j - 1].x, left[j - 1].y);
        ctx.lineTo(left[j].x, left[j].y);
        ctx.moveTo(right[j - 1].x, right[j - 1].y);
        ctx.lineTo(right[j].x, right[j].y);
        ctx.stroke();
      }
      /* 核心亮线 */
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mid[0].x, mid[0].y);
      for (var k = 1; k < mid.length; k++) ctx.lineTo(mid[k].x, mid[k].y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    /* ---------- 场景物件 ---------- */
    /* 岩脊：一排不规则的岩丘，远看是剪影，近看有受光面 */
    function drawRidge(band, ds, lo, hi) {
      var y = projectY(ds);
      if (y < horizonY - 40 || y > cssH + 60) return;
      var x0 = sx(lo);
      var x1 = sx(hi);
      var w = x1 - x0;
      if (w <= 2) return;
      var depth = ds / (ds + depthK);
      var h = Math.max(12, 34 * (1 - depth * 0.72));
      var humps = Math.max(2, Math.round(w / (34 * scale)));
      var step = w / humps;

      function humpPath(dy) {
        ctx.beginPath();
        ctx.moveTo(x0, y + 10 + dy);
        for (var i = 0; i < humps; i++) {
          var bx = x0 + step * i;
          var bump = h * (0.55 + 0.45 * Math.abs(Math.sin(i * 2.1 + ds * 0.01)));
          ctx.quadraticCurveTo(bx + step * 0.5, y - bump * 1.5 + dy, bx + step, y - bump * 0.35 + dy);
        }
        ctx.lineTo(x1, y + 10 + dy);
        ctx.closePath();
      }

      /* 受光的顶：先画一层浅色往上挪，再压上深色，留出一道亮边 */
      var fade = Math.max(0.25, 1 - depth * 0.8);
      ctx.fillStyle = band.sand;
      ctx.globalAlpha = 0.45 * fade;
      humpPath(-3);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = band.ridge;
      ctx.globalAlpha = 0.55 + 0.45 * fade;
      humpPath(0);
      ctx.fill();
      ctx.globalAlpha = 1;

      /* 接地阴影 */
      ctx.globalAlpha = 0.25 * fade;
      ctx.fillStyle = band.sandDark;
      ctx.fillRect(x0, y + 2, w, 6);
      ctx.globalAlpha = 1;
    }

    function drawRamp(band, ds, x) {
      var y = projectY(ds);
      if (y < horizonY - 40 || y > cssH + 60) return;
      var cx = sx(x);
      var w = 34 * scale;
      var h = 16 * scale;
      var grad = ctx.createLinearGradient(0, y - h, 0, y + 4);
      grad.addColorStop(0, band.sand);
      grad.addColorStop(1, band.sandDark);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(cx - w / 2, y + 4);
      ctx.quadraticCurveTo(cx - w / 2, y - h, cx, y - h);
      ctx.quadraticCurveTo(cx + w / 2, y - h, cx + w / 2, y + 4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = band.sun;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx - w / 2, y + 4);
      ctx.quadraticCurveTo(cx - w / 2, y - h, cx, y - h);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    function drawGate(band, ds, x, passed, time) {
      var y = projectY(ds);
      if (y < horizonY - 30 || y > cssH + 50) return;
      var cx = sx(x);
      var half = 26 * scale;
      var poleH = 40 * scale;
      var col = passed ? band.flag : band.sun;
      for (var i = 0; i < 2; i++) {
        var side = i === 0 ? -1 : 1;
        var px = cx + side * half;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.4 * scale;
        ctx.beginPath();
        ctx.moveTo(px, y + 4);
        ctx.lineTo(px, y - poleH);
        ctx.stroke();
        /* 旗子 */
        var wave = Math.sin(time * 5 + i * 1.7) * 4 * scale;
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.92;
        ctx.beginPath();
        ctx.moveTo(px, y - poleH);
        ctx.lineTo(px - side * 16 * scale + wave, y - poleH + 8 * scale);
        ctx.lineTo(px, y - poleH + 15 * scale);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    /* ---------- 玩家 ---------- */
    function drawPlayer(band, x, vx, airHeight, speed, s) {
      var px = sx(x);
      var py = projectY(0) + surfaceOffset(x, s) - airHeight;
      var tilt = Math.max(-0.5, Math.min(0.5, vx / 260));
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(tilt);

      /* 影子 */
      if (airHeight > 1) {
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(0, airHeight + 3, 15 * scale, 4 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      /* 板 */
      var grad = ctx.createLinearGradient(0, -8 * scale, 0, 4 * scale);
      grad.addColorStop(0, '#fff3d6');
      grad.addColorStop(1, band.sun);
      ctx.fillStyle = grad;
      roundRect(ctx, -16 * scale, -5 * scale, 32 * scale, 7 * scale, 3 * scale);
      ctx.fill();

      /* 人 */
      ctx.fillStyle = band.flag;
      ctx.beginPath();
      ctx.arc(0, -14 * scale, 5 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = band.flag;
      ctx.lineWidth = 3 * scale;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -10 * scale);
      ctx.lineTo(-2 * scale, -3 * scale);
      ctx.stroke();
      ctx.restore();

      /* 尾迹 */
      if (speed > 260) {
        ctx.strokeStyle = band.flag;
        ctx.globalAlpha = 0.28;
        ctx.lineWidth = 1.6 * scale;
        ctx.beginPath();
        ctx.moveTo(px - 16 * scale, py - 2 * scale);
        ctx.lineTo(px - (16 + Math.min(46, speed * 0.06)) * scale, py - 2 * scale);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

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

    /* ---------- 雪崩 ---------- */
    /*
     * 雪崩是身后一堵翻涌的沙墙：越近，墙沿越高、颜色越亮。
     * 墙沿用一条起伏的曲线画，下面整片填满。
     */
    function drawAvalanche(band, gap, time) {
      var edge = playerY + gap * 0.24;
      if (edge > cssH + 40) {
        /* 还很远：只在屏幕下缘留一层沙尘 */
        var haze = ctx.createLinearGradient(0, cssH - 60, 0, cssH);
        haze.addColorStop(0, 'rgba(0,0,0,0)');
        haze.addColorStop(1, band.dust);
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = haze;
        ctx.fillRect(0, cssH - 60, cssW, 60);
        ctx.globalAlpha = 1;
        return;
      }
      if (edge < horizonY) edge = horizonY;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, cssH + 10);
      var step = 18;
      for (var x = 0; x <= cssW + step; x += step) {
        var wob = Math.sin(x * 0.035 + time * 4.2) * 16 + Math.sin(x * 0.011 - time * 2.1) * 11;
        ctx.lineTo(x, edge + wob);
      }
      ctx.lineTo(cssW, cssH + 10);
      ctx.closePath();
      var grad = ctx.createLinearGradient(0, edge - 30, 0, cssH);
      grad.addColorStop(0, band.avalanche);
      grad.addColorStop(0.4, band.avalanche);
      grad.addColorStop(1, band.ridge);
      ctx.fillStyle = grad;
      ctx.fill();

      /* 翻涌的颗粒 */
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = band.avalanche;
      for (var i = 0; i < 26; i++) {
        var px = (i * 97 + time * (40 + (i % 5) * 22)) % (cssW + 60) - 30;
        var py = edge + 6 + ((i * 53 + time * 90) % 90);
        var r = 2 + (i % 4);
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    /* ---------- 主绘制 ---------- */
    function render(time, view) {
      if (!view) return;
      var dt = time - lastTime;
      lastTime = time;
      if (dt < 0) dt = 0;
      if (dt > 0.1) dt = 0.1;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      var band = view.band;
      var s = view.s;

      drawSky(band, time, view.fallX);
      drawFarDunes(band, s);
      drawSand(band);
      drawContours(band, s, time);
      drawFastLine(band, s);

      /* 场景物件：从远到近画 */
      var features = view.features || [];
      for (var i = 0; i < features.length; i++) {
        var f = features[i];
        var ds = f.s - s;
        if (ds < -60 || ds > 3200) continue;
        if (f.type === 'ridge') drawRidge(band, ds, f.lo, f.hi);
        else if (f.type === 'gate') drawGate(band, ds, f.x, f.passed, time);
        else if (f.type === 'ramp') drawRamp(band, ds, f.x);
      }

      drawPlayer(band, view.x, view.vx, view.airHeight, view.speed, view.s);

      /* 粒子 */
      for (var k = 0; k < dust.length; k++) {
        var p = dust[k];
        ctx.globalAlpha = 1 - p.life / p.max;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      drawAvalanche(band, view.gap, time);

      /* 危险提示：雪崩逼近时四周压红 */
      if (view.risk) {
        var pulse = 0.18 + 0.12 * Math.sin(time * 9);
        ctx.strokeStyle = 'rgba(255,90,60,' + pulse.toFixed(3) + ')';
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, cssW - 6, cssH - 6);
      }
    }

    return {
      resize: resize,
      ensureSize: resize,
      getScale: function () { return scale; },
      getOffset: function () { return { x: offX, y: 0 }; },
      getPlayerY: function () { return playerY; },
      getHorizonY: function () { return horizonY; },
      projectY: projectY,
      sx: sx,
      spray: spray,
      burst: burst,
      clearEffects: clearEffects,
      updateEffects: updateEffects,
      render: render
    };
  }

  root.DuneRender = {
    createRenderer: createRenderer,
    WORLD_W: WORLD_W
  };
})(typeof window !== 'undefined' ? window : global);
