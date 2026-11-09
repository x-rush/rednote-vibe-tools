/*
 * 弹珠神殿（玉球金殿）· 渲染层
 * Canvas 2D。三期起坐标系与原版一致：直接用画布 CSS 像素，
 * 殿内区域 = game.areaFor(w, h, demo) = {x:26, y:H*(.16|.07), w:W-52, h:H*(.56|.44)}。
 *
 * 二期视觉体系（保留）：
 *   · 宝石：多面切割（刻面 + 渐变体积 + 内发光 + 高光点 + 投影），带原版随机相位呼吸
 *   · 殿堂：石砖边框、立柱、地砖透视、墙面暗角、光柱尘埃
 *   · 玉球：玻璃球（渐变体积 + 高光 + 反射 + 接触阴影），蓄力时有光晕
 *   · 瞄准线：原版几何（虚线段 min(200,拖距)*1.6 + 球周力度弧），只换材质
 *   · 正反馈：收集爆闪 + 环波 + 新生光环 + 粒子；大连锁全屏光爆
 *   · 球迹 / 收集粒子：原版的光点衰减样式（数值按原版）
 *
 * Chrome 61 基线：不用 roundRect / clip-path / filter / conic-gradient 等新特性。
 */
(function (root) {
  'use strict';

  var game = root.BilliardGame;
  var BALL_R = game ? game.BALL_R : 13;

  /* ---------- 小工具 ---------- */
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

  /* 十六进制颜色：提亮 / 压暗 */
  function parseHex(hex) {
    var s = String(hex || '#ffffff').replace('#', '');
    if (s.length === 3) s = s.charAt(0) + s.charAt(0) + s.charAt(1) + s.charAt(1) + s.charAt(2) + s.charAt(2);
    var n = parseInt(s, 16);
    if (isNaN(n)) return { r: 255, g: 255, b: 255 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgba(hex, a) {
    var c = parseHex(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  }

  /* amount > 0 提亮到白色，< 0 压暗到黑色 */
  function shade(hex, amount) {
    var c = parseHex(hex);
    var t = amount > 0 ? 255 : 0;
    var p = Math.abs(amount);
    var r = Math.round(c.r + (t - c.r) * p);
    var g = Math.round(c.g + (t - c.g) * p);
    var b = Math.round(c.b + (t - c.b) * p);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  /* 稳定伪随机：同一个种子每次刷新都是同一批尘埃 */
  function hash01(i) {
    var x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function createRenderer(canvas) {
    var ctx = canvas.getContext('2d');
    var dpr = 1;
    var cssW = 0;
    var cssH = 0;
    var reduced = false;
    var sparks = [];
    var rings = [];
    var absorbs = [];
    var births = [];   /* 连锁球新生：宝石变球那一刻的实体化光环 */
    var flashLevel = 0;
    var flashColor = '#ffe9b8';
    var shakeLevel = 0;
    var shakeX = 0;
    var shakeY = 0;
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
      return true;
    }

    /* ---------- 特效 ---------- */
    /* 光点：宝石碎裂、撞墙的火星 */
    function burst(x, y, color, count) {
      var n = count || 16;
      for (var i = 0; i < n; i++) {
        var a = (Math.PI * 2 * i) / n + (i % 3) * 0.24;
        var sp = 60 + (i % 5) * 34;
        sparks.push({
          x: x,
          y: y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 40,
          life: 0,
          max: 0.5 + (i % 4) * 0.08,
          color: color,
          size: 1.4 + (i % 3) * 0.7
        });
      }
      if (sparks.length > 220) sparks.splice(0, sparks.length - 220);
    }

    /* 环波：一圈向外扩散的冲击环 */
    function ring(x, y, color, maxR, dur) {
      rings.push({ x: x, y: y, r: 2, max: maxR || 46, life: 0, maxLife: dur || 0.5, color: color });
      if (rings.length > 40) rings.shift();
    }

    /* 宝石被吸入球口：缩小着飞向玉球 */
    function absorb(gemX, gemY, ballX, ballY, color, glow, ringSize) {
      absorbs.push({
        x: gemX,
        y: gemY,
        tx: ballX,
        ty: ballY,
        life: 0,
        max: 0.42,
        color: color,
        glow: glow
      });
      ring(gemX, gemY, glow || '#ffffff', ringSize || 42, 0.45);
      burst(gemX, gemY, glow || '#ffffff', 18);
    }

    /*
     * 宝石变身连锁球：爆闪 + 环波 + 新生光环（光环收束成球的那一瞬间）。
     * 复用宝石特效体系，但不再「飞向球口」——宝石原地化作新球，连锁从这里继续。
     */
    function convertFx(x, y, color, glow, ringSize) {
      burst(x, y, glow || '#ffffff', 20);
      ring(x, y, glow || '#ffffff', ringSize || 52, 0.5);
      births.push({ x: x, y: y, life: 0, max: 0.36, color: glow || color || '#ffffff' });
      if (births.length > 24) births.shift();
    }

    /* 全屏光爆：大连锁 / 一殿收齐时用 */
    function flash(amount, color) {
      flashLevel = Math.max(flashLevel, amount);
      if (color) flashColor = color;
    }

    /* 屏幕微震 */
    function shake(amount) {
      shakeLevel = Math.max(shakeLevel, amount);
    }

    function clearEffects() {
      sparks.length = 0;
      rings.length = 0;
      absorbs.length = 0;
      births.length = 0;
      flashLevel = 0;
      shakeLevel = 0;
    }

    function updateEffects(dt) {
      var i;
      for (i = sparks.length - 1; i >= 0; i--) {
        var s = sparks[i];
        s.life += dt;
        if (s.life >= s.max) {
          sparks.splice(i, 1);
          continue;
        }
        s.vy += 260 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= 1 - 1.6 * dt;
      }
      for (i = rings.length - 1; i >= 0; i--) {
        var r = rings[i];
        r.life += dt;
        if (r.life >= r.maxLife) rings.splice(i, 1);
      }
      for (i = absorbs.length - 1; i >= 0; i--) {
        var a = absorbs[i];
        a.life += dt;
        if (a.life >= a.max) absorbs.splice(i, 1);
      }
      for (i = births.length - 1; i >= 0; i--) {
        var bn = births[i];
        bn.life += dt;
        if (bn.life >= bn.max) births.splice(i, 1);
      }
      if (flashLevel > 0) {
        flashLevel -= dt * 2.2;
        if (flashLevel < 0) flashLevel = 0;
      }
      if (shakeLevel > 0) {
        shakeLevel -= dt * 3.4;
        if (shakeLevel < 0) shakeLevel = 0;
        shakeX = (Math.random() - 0.5) * shakeLevel * 9;
        shakeY = (Math.random() - 0.5) * shakeLevel * 9;
      } else {
        shakeX = 0;
        shakeY = 0;
      }
    }

    /* ---------- 殿堂（屏幕坐标，围绕殿内区域） ---------- */
    var ROOM_PAD = 130;   /* 殿堂向外延伸：屏幕留白也画满，不留黑边 */

    /* 后墙 + 拱门 + 帷幔（区域上沿以上） */
    function drawBackWall(theme, area, time) {
      var x0 = -ROOM_PAD;
      var y0 = -ROOM_PAD;
      var wallBottom = area.y;
      var wallW = cssW + ROOM_PAD * 2;
      var wall = ctx.createLinearGradient(0, y0, 0, wallBottom);
      wall.addColorStop(0, shade(theme.top, -0.32));
      wall.addColorStop(0.5, shade(theme.top, 0.06));
      wall.addColorStop(0.86, theme.bottom);
      wall.addColorStop(1, shade(theme.bottom, -0.4));
      ctx.fillStyle = wall;
      ctx.fillRect(x0, y0, wallW, wallBottom - y0);

      /* 远景：拱廊剪影 */
      var arcadeY = wallBottom - 6;
      ctx.fillStyle = rgba(theme.brickDark, 0.7);
      for (var a = 0; a < 9; a++) {
        var aw = wallW / 9;
        var cx = x0 + aw * (a + 0.5);
        ctx.beginPath();
        ctx.moveTo(cx - aw * 0.34, arcadeY);
        ctx.lineTo(cx - aw * 0.34, arcadeY - aw * 0.46);
        ctx.quadraticCurveTo(cx, arcadeY - aw * 0.86, cx + aw * 0.34, arcadeY - aw * 0.46);
        ctx.lineTo(cx + aw * 0.34, arcadeY);
        ctx.closePath();
        ctx.fill();
      }

      /* 墙面砖缝 */
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (var y = -ROOM_PAD; y < wallBottom; y += 20) {
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 + wallW, y);
        ctx.stroke();
      }
      for (var row = 0; row < 20; row++) {
        var yy = -ROOM_PAD + row * 20;
        if (yy > wallBottom) break;
        var off = row % 2 === 0 ? 0 : 13;
        for (var x = x0 + off; x < x0 + wallW; x += 26) {
          ctx.beginPath();
          ctx.moveTo(x, yy);
          ctx.lineTo(x, Math.max(y0, yy - 20));
          ctx.stroke();
        }
      }

      /* 中央拱门：殿堂尽头的一线光 */
      var aw2 = Math.min(cssW, area.w) * 0.42;
      var ax = (cssW - aw2) / 2;
      var wallH = wallBottom - y0;
      var ay = wallBottom - Math.min(aw2 * 0.92, wallH * 0.7);
      var arch = ctx.createLinearGradient(0, ay, 0, wallBottom);
      arch.addColorStop(0, rgba(theme.wall, 0.2));
      arch.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = arch;
      ctx.beginPath();
      ctx.moveTo(ax, wallBottom);
      ctx.lineTo(ax, ay + aw2 * 0.5);
      ctx.quadraticCurveTo(cssW / 2, ay - aw2 * 0.32, ax + aw2, ay + aw2 * 0.5);
      ctx.lineTo(ax + aw2, wallBottom);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba(theme.wall, 0.34);
      ctx.lineWidth = 1.4;
      ctx.stroke();

      /* 中景立柱：两侧各两根，做出纵深 */
      var colW = 13;
      for (var s = 0; s < 4; s++) {
        var side = s < 2 ? -1 : 1;
        var idx = s % 2;
        var cx2 = side < 0 ? -ROOM_PAD * 0.42 + idx * 26 : cssW + ROOM_PAD * 0.42 - idx * 26;
        var cGrad = ctx.createLinearGradient(cx2 - colW, 0, cx2 + colW, 0);
        cGrad.addColorStop(0, 'rgba(0,0,0,0.42)');
        cGrad.addColorStop(0.45, rgba(theme.pillar, 0.92));
        cGrad.addColorStop(1, 'rgba(0,0,0,0.46)');
        ctx.fillStyle = cGrad;
        ctx.fillRect(cx2 - colW, y0, colW * 2, wallH);
        ctx.fillStyle = rgba(theme.wall, 0.2);
        ctx.fillRect(cx2 - colW * 1.6, y0, colW * 3.2, 7);
        ctx.fillRect(cx2 - colW * 1.6, wallBottom - 12, colW * 3.2, 7);
      }

      /* 帷幔：贴着球道两侧垂下来的布幔 */
      for (var v = 0; v < 2; v++) {
        var bx = v === 0 ? -2 : cssW - 14;
        var bg = ctx.createLinearGradient(bx, 0, bx + 16, 0);
        bg.addColorStop(0, rgba(theme.pillar, 0.8));
        bg.addColorStop(1, 'rgba(0,0,0,0.4)');
        ctx.fillStyle = bg;
        ctx.fillRect(bx, y0, 16, wallH);
        ctx.fillStyle = rgba(theme.wall, 0.2);
        ctx.fillRect(bx + (v === 0 ? 0 : 14), y0, 2, wallH);
      }
    }

    /* 地砖透视：区域下沿以下，越靠近观众砖越大 */
    function drawFloor(theme, area) {
      var x0 = -ROOM_PAD;
      var w = cssW + ROOM_PAD * 2;
      var floorTop = area.y + area.h;
      var floorBottom = cssH + ROOM_PAD;
      var floor = ctx.createLinearGradient(0, floorTop, 0, floorBottom);
      floor.addColorStop(0, shade(theme.floor, -0.05));
      floor.addColorStop(1, shade(theme.floor, -0.5));
      ctx.fillStyle = floor;
      ctx.fillRect(x0, floorTop, w, floorBottom - floorTop);

      /* 地平线亮边 */
      ctx.strokeStyle = rgba(theme.wall, 0.3);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, floorTop + 0.5);
      ctx.lineTo(x0 + w, floorTop + 0.5);
      ctx.stroke();

      var vpx = cssW / 2;
      var vpy = floorTop - area.h * 0.35;
      var floorH = floorBottom - floorTop;
      var rows = 6;
      for (var r = 0; r < rows; r++) {
        var f0 = Math.pow(r / rows, 1.9);
        var f1 = Math.pow((r + 1) / rows, 1.9);
        var y0 = floorTop + floorH * f0;
        var y1 = floorTop + floorH * f1;
        var spread0 = (y0 - vpy) * 1.5;
        var spread1 = (y1 - vpy) * 1.5;
        var seams = 9;
        for (var s = 0; s <= seams; s++) {
          var t = s / seams;
          var sx0 = vpx + (t - 0.5) * spread0;
          var sx1 = vpx + (t - 0.5) * spread1;
          ctx.strokeStyle = r % 2 === 0 ? 'rgba(0,0,0,0.32)' : rgba(theme.wall, 0.07);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(sx0, y0);
          ctx.lineTo(sx1, y1);
          ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.24)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x0, y0 + 0.5);
        ctx.lineTo(x0 + w, y0 + 0.5);
        ctx.stroke();
      }

      /* 地面反光：靠近观众一侧压暗，做出重量 */
      var shadeBand = Math.min(70, floorH * 0.5);
      var shadeG = ctx.createLinearGradient(0, floorBottom - shadeBand - ROOM_PAD, 0, floorBottom);
      shadeG.addColorStop(0, 'rgba(0,0,0,0)');
      shadeG.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = shadeG;
      ctx.fillRect(x0, floorBottom - shadeBand - ROOM_PAD, w, shadeBand + ROOM_PAD);
    }

    /* 光柱与尘埃：打在殿堂里的体积光 */
    function drawLight(theme, time) {
      var x0 = -ROOM_PAD;
      var w = cssW + ROOM_PAD * 2;
      for (var s = 0; s < 3; s++) {
        var baseX = cssW * (0.18 + s * 0.3);
        var drift = Math.sin(time * 0.18 + s * 1.7) * 6;
        var halfTop = 14;
        var halfBottom = 38;
        var beam = ctx.createLinearGradient(baseX, -ROOM_PAD, baseX + 30, cssH + ROOM_PAD);
        beam.addColorStop(0, rgba(theme.wall, 0.14));
        beam.addColorStop(0.55, rgba(theme.wall, 0.05));
        beam.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(baseX - halfTop + drift, -ROOM_PAD);
        ctx.lineTo(baseX + halfTop + drift, -ROOM_PAD);
        ctx.lineTo(baseX + halfBottom + drift * 2.4, cssH + ROOM_PAD);
        ctx.lineTo(baseX - halfBottom + drift * 2.4, cssH + ROOM_PAD);
        ctx.closePath();
        ctx.fill();
      }

      /* 尘埃 */
      for (var d = 0; d < 52; d++) {
        var seed = d * 3.77;
        var dx = x0 + hash01(d) * w;
        var dy = -ROOM_PAD + ((hash01(d + 91) * (cssH + ROOM_PAD * 2) + time * (5 + hash01(d + 5) * 9)) % (cssH + ROOM_PAD * 2));
        var twinkle = 0.25 + 0.55 * Math.abs(Math.sin(time * 1.4 + seed));
        var size = 0.6 + hash01(d + 17) * 1.4;
        ctx.globalAlpha = twinkle * 0.45;
        ctx.fillStyle = theme.wall;
        ctx.beginPath();
        ctx.arc(dx + Math.sin(time * 0.4 + seed) * 5, dy, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    /* 石砖边框：球道四周砌起来的石台，球就贴着内侧弹 */
    function drawStoneBorder(theme, area) {
      var band = 16;
      var rows = 3;
      var rowH = band / rows;
      var brickW = 26;

      /* 上边与下边 */
      for (var side = 0; side < 2; side++) {
        var y0 = side === 0 ? area.y - band : area.y + area.h;
        for (var r = 0; r < rows; r++) {
          var off = r % 2 === 0 ? 0 : brickW / 2;
          for (var x = area.x - brickW; x < area.x + area.w + brickW; x += brickW) {
            var bx = x + off;
            var by = y0 + r * rowH;
            var g = ctx.createLinearGradient(0, by, 0, by + rowH);
            g.addColorStop(0, shade(theme.brick, side === 0 ? 0.2 : 0.34));
            g.addColorStop(1, shade(theme.brick, side === 0 ? -0.12 : 0.04));
            ctx.fillStyle = g;
            ctx.fillRect(bx + 0.7, by + 0.7, brickW - 1.4, rowH - 1.4);
            ctx.strokeStyle = 'rgba(0,0,0,0.35)';
            ctx.lineWidth = 0.8;
            ctx.strokeRect(bx + 0.7, by + 0.7, brickW - 1.4, rowH - 1.4);
          }
        }
      }

      /* 左右两边 */
      for (var s2 = 0; s2 < 2; s2++) {
        var x0 = s2 === 0 ? area.x - band : area.x + area.w;
        for (var r2 = 0; r2 < rows; r2++) {
          var off2 = r2 % 2 === 0 ? 0 : rowH / 2;
          for (var y = area.y - band; y < area.y + area.h + band; y += rowH) {
            var byy = y + off2;
            var g2 = ctx.createLinearGradient(x0, 0, x0 + band, 0);
            g2.addColorStop(0, shade(theme.brick, s2 === 0 ? 0.2 : 0.34));
            g2.addColorStop(1, shade(theme.brick, s2 === 0 ? -0.12 : 0.04));
            ctx.fillStyle = g2;
            ctx.fillRect(x0 + 0.7, byy + 0.7, band - 1.4, rowH - 1.4);
            ctx.strokeStyle = 'rgba(0,0,0,0.35)';
            ctx.lineWidth = 0.8;
            ctx.strokeRect(x0 + 0.7, byy + 0.7, band - 1.4, rowH - 1.4);
          }
        }
      }

      /* 内侧高光边：光源在左上 */
      ctx.strokeStyle = rgba(theme.wall, 0.3);
      ctx.lineWidth = 1.4;
      ctx.strokeRect(area.x + 0.7, area.y + 0.7, area.w - 1.4, area.h - 1.4);
      /* 外侧压暗，把球道圈出来 */
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 3;
      ctx.strokeRect(area.x - band + 0.5, area.y - band + 0.5, area.w + band * 2 - 1, area.h + band * 2 - 1);
    }

    /* 原版拱门横梁：区域上沿的金色弧梁（照抄原版形状，材质用殿堂主题色） */
    function drawArchBeam(theme, area) {
      var top = area.y;
      ctx.fillStyle = rgba(theme.brickDark, 0.9);
      ctx.beginPath();
      ctx.moveTo(-10, top - 18);
      ctx.quadraticCurveTo(cssW / 2, top - 56, cssW + 10, top - 18);
      ctx.lineTo(cssW + 10, top - 6);
      ctx.quadraticCurveTo(cssW / 2, top - 42, -10, top - 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = rgba(theme.wall, 0.75);
      ctx.beginPath();
      ctx.moveTo(-10, top - 14);
      ctx.quadraticCurveTo(cssW / 2, top - 50, cssW + 10, top - 14);
      ctx.lineTo(cssW + 10, top - 9);
      ctx.quadraticCurveTo(cssW / 2, top - 45, -10, top - 9);
      ctx.closePath();
      ctx.fill();
    }

    /* ---------- 宝石：多面切割（带原版随机相位呼吸） ---------- */
    function drawGem(x, y, style, time, phase) {
      var r = style.size || 14;
      var spin = time * 0.55;
      /* 原版呼吸：s = .75 + .25*sin(.004*t + ph)，作用于光晕亮度 */
      var pulse = 0.75 + 0.25 * Math.sin(time * 4 + (phase || 0));

      /* 接触投影 */
      var shadow = ctx.createRadialGradient(x, y + r * 0.9, 0, x, y + r * 0.9, r * 1.5);
      shadow.addColorStop(0, 'rgba(0,0,0,0.42)');
      shadow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = shadow;
      ctx.beginPath();
      ctx.ellipse(x, y + r * 0.9, r * 1.2, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();

      /* 内发光（原版 lighter 混合 + 相位呼吸） */
      ctx.globalCompositeOperation = 'lighter';
      var halo = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 2.1);
      halo.addColorStop(0, rgba(style.glow, 0.5 * pulse));
      halo.addColorStop(0.45, rgba(style.glow, 0.16 * pulse));
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      ctx.save();
      ctx.translate(x, y);

      /* 六边形刻面 */
      var sides = 6;
      var lightAngle = -2.3 + Math.sin(time * 0.6) * 0.25;
      for (var i = 0; i < sides; i++) {
        var a0 = spin + (Math.PI * 2 * i) / sides;
        var a1 = spin + (Math.PI * 2 * (i + 1)) / sides;
        var mid = (a0 + a1) / 2;
        var facing = Math.cos(mid - lightAngle);
        /* 面向光源的刻面更亮，背面更暗 */
        var amount = 0.42 * facing;
        ctx.fillStyle = shade(style.color, amount);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a0) * r, Math.sin(a0) * r);
        ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
        ctx.lineTo(Math.cos(a1) * r * 0.42 + 0, Math.sin(a1) * r * 0.42 - r * 0.12);
        ctx.lineTo(Math.cos(a0) * r * 0.42 + 0, Math.sin(a0) * r * 0.42 - r * 0.12);
        ctx.closePath();
        ctx.fill();
      }

      /* 台面：顶部的小平面 */
      ctx.fillStyle = shade(style.color, 0.5);
      ctx.beginPath();
      for (var t = 0; t < sides; t++) {
        var at = spin + (Math.PI * 2 * t) / sides - Math.PI / sides;
        var tx = Math.cos(at) * r * 0.42;
        var ty = Math.sin(at) * r * 0.42 - r * 0.12;
        if (t === 0) ctx.moveTo(tx, ty);
        else ctx.lineTo(tx, ty);
      }
      ctx.closePath();
      ctx.fill();

      /* 外轮廓 */
      ctx.strokeStyle = rgba(style.glow, 0.85);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (var o = 0; o < sides; o++) {
        var ao = spin + (Math.PI * 2 * o) / sides;
        var ox = Math.cos(ao) * r;
        var oy = Math.sin(ao) * r;
        if (o === 0) ctx.moveTo(ox, oy);
        else ctx.lineTo(ox, oy);
      }
      ctx.closePath();
      ctx.stroke();

      /* 高光点 */
      var hx = Math.cos(lightAngle) * r * 0.5;
      var hy = Math.sin(lightAngle) * r * 0.5 - r * 0.18;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.ellipse(hx, hy, r * 0.17, r * 0.11, lightAngle, 0, Math.PI * 2);
      ctx.fill();

      /* 折射：底面的一道亮弧 */
      ctx.strokeStyle = rgba(style.glow, 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, r * 0.08, r * 0.62, 0.35, 1.5);
      ctx.stroke();

      ctx.restore();
    }

    /* ---------- 玉球 / 连锁球：玻璃球 ---------- */
    function drawBall(x, y, style, charge, time) {
      var r = style.radius || BALL_R;

      /* 蓄力光晕：拖拽越远越亮 */
      if (charge > 0.01) {
        var halo = ctx.createRadialGradient(x, y, r * 0.4, x, y, r + 26 * charge);
        halo.addColorStop(0, rgba(style.glow || '#ffffff', 0.42 * charge));
        halo.addColorStop(0.5, rgba(style.glow || '#ffffff', 0.14 * charge));
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(x, y, r + 26 * charge, 0, Math.PI * 2);
        ctx.fill();
      }

      /* 接触阴影 */
      var shadow = ctx.createRadialGradient(x, y + r * 0.85, 0, x, y + r * 0.85, r * 1.6);
      shadow.addColorStop(0, 'rgba(0,0,0,0.45)');
      shadow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = shadow;
      ctx.beginPath();
      ctx.ellipse(x, y + r * 0.85, r * 1.3, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      /* 玻璃体积：左上高光 */
      var body = ctx.createRadialGradient(x - r * 0.35, y - r * 0.42, r * 0.1, x, y, r);
      body.addColorStop(0, style.core);
      body.addColorStop(0.35, style.color);
      body.addColorStop(0.82, style.deep || shade(style.color, -0.45));
      body.addColorStop(1, shade(style.deep || style.color, -0.6));
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      /* 内折射：底部一道弯月 */
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();
      var caustic = ctx.createRadialGradient(x + r * 0.25, y + r * 0.45, 0, x + r * 0.25, y + r * 0.45, r * 0.9);
      caustic.addColorStop(0, rgba(style.glow || '#ffffff', 0.55));
      caustic.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = caustic;
      ctx.beginPath();
      ctx.arc(x + r * 0.22, y + r * 0.4, r * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      /* 边缘反光 */
      ctx.strokeStyle = rgba(style.glow || '#ffffff', 0.55);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(x, y, r - 0.6, 0.35, 2.1);
      ctx.stroke();

      /* 高光 */
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath();
      ctx.ellipse(x - r * 0.34, y - r * 0.38, r * 0.24, r * 0.16, -0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(x + r * 0.32, y + r * 0.36, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }

    /* 主球常亮光晕（原版：lighter 径向 rgba(140,255,210,.32) r40） */
    function drawBallGlow(x, y, style) {
      var r = style.radius || BALL_R;
      ctx.globalCompositeOperation = 'lighter';
      var glow = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 3.1);
      glow.addColorStop(0, rgba(style.glow || '#8fe3c6', 0.32));
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, r * 3.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }

    /* ---------- 瞄准线：原版几何（虚线段 + 球周力度弧），只换材质 ----------
     * 原版：长 = min(200, 拖距) * 1.6，虚线 [10,8]，球周 r22 弧 ±0.4rad。
     * 不做反弹预测（原版没有）。 */
    function drawAim(ball, aim, theme, style) {
      var dragLen = Math.min(200, aim.dist || 0);
      var angle = aim.angle || 0;
      var len = dragLen * 1.6;
      var dx = Math.cos(angle);
      var dy = Math.sin(angle);
      var strength = Math.min(1, (aim.power || 0) / (game.LAUNCH_MAX || 0.62));

      /* 能量虚线：从玉球指向发射方向 */
      ctx.strokeStyle = rgba(style.glow || theme.wall, 0.55 + strength * 0.4);
      ctx.lineWidth = 2 + strength * 1.6;
      ctx.lineCap = 'round';
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(ball.x, ball.y);
      ctx.lineTo(ball.x + dx * len, ball.y + dy * len);
      ctx.stroke();
      ctx.setLineDash([]);

      /* 球周力度弧（原版：r22、±0.4rad、金色） */
      ctx.strokeStyle = rgba(theme.wall, 0.5);
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 22, angle - 0.4, angle + 0.4);
      ctx.stroke();
    }

    /* ---------- 球迹（原版 E：衰减光点） ---------- */
    function drawTrail(trail, style) {
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < trail.length; i++) {
        var e = trail[i];
        var life = e.life;
        var r = Math.max(0.3, 11 * life);
        var glow = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, 2 * r);
        glow.addColorStop(0, rgba(style.glow || '#96ffd6', 0.35 * life));
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(e.x, e.y, Math.max(0.3, 2 * r), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    /* ---------- 收集粒子（原版 j：hsla 金色光点） ---------- */
    function drawParticles(particles) {
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        var r = Math.max(0.2, p.r * p.life);
        var glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 3 * r);
        glow.addColorStop(0, 'hsla(' + Math.round(p.hue) + ',100%,80%,' + (0.8 * p.life) + ')');
        glow.addColorStop(1, 'hsla(' + Math.round(p.hue) + ',100%,60%,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.2, 3 * r), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    /* ---------- 特效绘制 ---------- */
    function drawEffects() {
      var i;
      /* 吸入动画：宝石缩小着飞向球口 */
      for (i = 0; i < absorbs.length; i++) {
        var a = absorbs[i];
        var t = a.life / a.max;
        var e = t * t;
        var gx = a.x + (a.tx - a.x) * e;
        var gy = a.y + (a.ty - a.y) * e;
        var size = (1 - e) * 12;
        ctx.globalAlpha = 1 - t * 0.85;
        ctx.fillStyle = a.glow || a.color;
        ctx.beginPath();
        ctx.arc(gx, gy, Math.max(0.6, size), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = (1 - t) * 0.5;
        ctx.fillStyle = a.color;
        ctx.beginPath();
        ctx.arc(gx, gy, Math.max(0.3, size * 0.45), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      /* 连锁球新生：光环从宝石尺寸收束成球，中心一闪 */
      for (i = 0; i < births.length; i++) {
        var bn = births[i];
        var bt = bn.life / bn.max;
        var ease = 1 - (1 - bt) * (1 - bt);
        var br = 8 + 16 * ease;
        ctx.globalAlpha = (1 - bt) * 0.8;
        ctx.strokeStyle = bn.color;
        ctx.lineWidth = 2.2 * (1 - bt) + 0.4;
        ctx.beginPath();
        ctx.arc(bn.x, bn.y, br, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = (1 - bt) * 0.55;
        ctx.fillStyle = bn.color;
        ctx.beginPath();
        ctx.arc(bn.x, bn.y, Math.max(0.5, 10 * (1 - bt)), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      /* 环波 */
      for (i = 0; i < rings.length; i++) {
        var r = rings[i];
        var rt = r.life / r.maxLife;
        var radius = r.r + (r.max - r.r) * rt;
        ctx.strokeStyle = r.color;
        ctx.globalAlpha = (1 - rt) * 0.75;
        ctx.lineWidth = 2.4 * (1 - rt) + 0.4;
        ctx.beginPath();
        ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      /* 光点 */
      for (i = 0; i < sparks.length; i++) {
        var sp = sparks[i];
        var life = 1 - sp.life / sp.max;
        ctx.globalAlpha = life;
        ctx.fillStyle = sp.color;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.size * life + 0.4, 0, Math.PI * 2);
        ctx.fill();
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
      /* 底色：先铺一层主题色 */
      var base = ctx.createLinearGradient(0, 0, 0, cssH);
      base.addColorStop(0, theme.top);
      base.addColorStop(1, shade(theme.floor, -0.5));
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, cssW, cssH);

      /* 殿堂（带震屏偏移；坐标系就是 CSS px，只平移） */
      ctx.setTransform(dpr, 0, 0, dpr, dpr * shakeX, dpr * shakeY);

      var area = view.area;
      drawBackWall(theme, area, time);
      drawFloor(theme, area);
      drawLight(theme, time);
      drawArchBeam(theme, area);
      drawStoneBorder(theme, area);

      drawTrail(view.trail || [], view.ballStyle);
      drawParticles(view.particles || []);

      var gems = view.gems || [];
      for (var g = 0; g < gems.length; g++) {
        if (gems[g].got) continue;
        drawGem(gems[g].x, gems[g].y, gems[g].style, time, gems[g].ph);
      }

      if (view.aim) drawAim(view.ball, view.aim, theme, view.ballStyle);

      /* 连锁球：宝石变身的玻璃小球，染着本殿宝石的颜色（玉球最后画，压在最上面） */
      var balls = view.chains || [];
      var chainStyle = view.chainStyle || {};
      for (var cb = 0; cb < balls.length; cb++) {
        drawBall(
          balls[cb].x,
          balls[cb].y,
          {
            color: chainStyle.color,
            core: '#ffffff',
            deep: chainStyle.deep,
            glow: chainStyle.glow,
            radius: game.CHAIN_R
          },
          0,
          time
        );
      }

      drawBallGlow(view.ball.x, view.ball.y, view.ballStyle);
      drawBall(view.ball.x, view.ball.y, view.ballStyle, view.charge || 0, time);
      drawEffects();

      /* 暗角：把注意力压回殿堂中心 */
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var vig = ctx.createRadialGradient(
        cssW * 0.5,
        cssH * 0.46,
        Math.min(cssW, cssH) * 0.28,
        cssW * 0.5,
        cssH * 0.5,
        Math.max(cssW, cssH) * 0.78
      );
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, theme.vignette || 'rgba(0,0,0,0.62)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, cssW, cssH);

      /* 全屏光爆：大连锁 / 一殿收齐时的高光时刻 */
      if (flashLevel > 0) {
        ctx.fillStyle = rgba(flashColor, Math.min(0.85, flashLevel));
        ctx.fillRect(0, 0, cssW, cssH);
      }
    }

    return {
      resize: resize,
      ensureSize: resize,
      getScale: function () { return 1; },
      getOffset: function () { return { x: 0, y: 0 }; },
      getSize: function () { return { w: cssW, h: cssH }; },
      toArena: function (clientX, clientY) {
        var rect = canvas.getBoundingClientRect();
        return {
          x: clientX - rect.left,
          y: clientY - rect.top
        };
      },
      burst: burst,
      ring: ring,
      absorb: absorb,
      convertFx: convertFx,
      flash: flash,
      shake: shake,
      clearEffects: clearEffects,
      updateEffects: updateEffects,
      render: render,
      setReducedMotion: function (v) { reduced = !!v; },
      isReducedMotion: function () { return reduced; }
    };
  }

  root.BilliardRender = {
    createRenderer: createRenderer,
    BALL_R: BALL_R
  };
})(typeof window !== 'undefined' ? window : global);
