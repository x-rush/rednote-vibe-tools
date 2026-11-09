/*
 * 沙丘速降 · 渲染层（eazo 原版 1:1 复刻 + 二期视觉升级的允许保留项）
 *
 * 几何与常量全部照抄原版：
 *   · 屏幕自上而下：坡顶线 d = 屏高×0.2，玩家行 u = 屏高×0.66；
 *     封面/结算状态则 u = 屏高×0.4、d = 屏高×0.3。
 *   · 天空渐变、太阳、三层远景沙丘、沙面渐变、速度线、旗门画法、
 *     粒子辉光、雪崩渐变与飞石的颜色与位置全部取自原版源码。
 *   · 旗门只画在 d ~ 屏高+40 之间，旗杆间距 104×缩放，
 *     旗色：未判定 #e8503c / 穿过 #7ce0a6 / 错过 #8e8e8e。
 *
 * 二期视觉升级中「不表达玩法规则」的部分予以保留：
 *   · 滑雪者剪影（姿态只由原版的 vx 决定：rotate(0.36×clamp(2.4×vx))）；
 *   · 沙面压雪纹（纯装饰的横向纹理，不参与任何判定）；
 *   · 暗角。
 *
 * 已删除的自创表现：赛道内外视觉分区、雪崩翻卷实体演出、冲击波与屏震。
 *
 * Chrome 61 基线：不用 roundRect / clip-path 等新特性。
 */
(function (root) {
  'use strict';

  var PLAYER_SCALE_PLAY = 1.15;  /* 原版：游玩时人物 scale 1.15 */
  var PLAYER_SCALE_CRUISE = 1.5; /* 原版：巡航（封面/结算）时 scale 1.5 */
  var PLAYER_TILT = 0.36;        /* 原版 rotate(.36 × clamp(2.4×vx)) */
  var PLAYER_LEAN = 2.4;         /* 原版 lean = clamp(2.4×vx, -1, 1) */

  function createRenderer(canvas) {
    var ctx = canvas.getContext('2d');
    var dpr = 1;
    var cssW = 0;
    var cssH = 0;
    var lastU = 0;
    var lastD = 0;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      var w = Math.max(1, Math.round(rect.width));
      var h = Math.max(1, Math.round(rect.height));
      var nextDpr = Math.min(2, root.devicePixelRatio || 1);
      if (w === cssW && h === cssH && nextDpr === dpr) return false;
      cssW = w;
      cssH = h;
      dpr = nextDpr;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      return true;
    }

    /* ---------- 背景：原版天空渐变 ---------- */
    function drawSky(pal) {
      var g = ctx.createLinearGradient(0, 0, 0, cssH);
      var stops = pal.sky;
      for (var i = 0; i < stops.length; i++) {
        g.addColorStop(i === 0 ? 0 : stops[i].index, stops[i].color);
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cssW, cssH);
    }

    /* ---------- 太阳（原版：lighter 叠加） ---------- */
    function drawSun(pal, d) {
      var x = cssW * 0.72;
      var y = d - 26;
      ctx.globalCompositeOperation = 'lighter';
      var g = ctx.createRadialGradient(x, y, 6, x, y, 190);
      g.addColorStop(0, pal.sunCore);
      g.addColorStop(0.2, pal.sunMid);
      g.addColorStop(1, pal.sunEdge);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 190, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.sunDisc;
      ctx.beginPath();
      ctx.arc(x, y, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }

    /* ---------- 三层远景沙丘（原版） ---------- */
    function drawDunes(pal, d) {
      for (var e = 0; e < 3; e++) {
        ctx.fillStyle = pal.dunes[e];
        ctx.beginPath();
        var yAt = function (x) {
          return d + 22 * e - Math.sin(0.008 * x + 2 * e) * (16 - 4 * e) - 5 * Math.sin(0.02 * x + e);
        };
        ctx.moveTo(0, yAt(0));
        for (var x = 0; x <= cssW; x += 18) ctx.lineTo(x, yAt(x));
        ctx.lineTo(cssW, cssH);
        ctx.lineTo(0, cssH);
        ctx.closePath();
        ctx.fill();
      }
    }

    /* ---------- 沙面（原版渐变 + 起伏轮廓） ---------- */
    function drawSand(pal, d) {
      var g = ctx.createLinearGradient(0, d, 0, cssH);
      g.addColorStop(0, pal.sand[0]);
      g.addColorStop(0.45, pal.sand[1]);
      g.addColorStop(1, pal.sand[2]);
      ctx.fillStyle = g;
      var yAt = function (x) {
        return d + 30 - 12 * Math.sin(0.01 * x) - 8 * Math.sin(0.031 * x + 1.3) - 3 * Math.sin(0.07 * x);
      };
      ctx.beginPath();
      ctx.moveTo(0, yAt(0));
      for (var x = 0; x <= cssW; x += 12) ctx.lineTo(x, yAt(x));
      ctx.lineTo(cssW, cssH);
      ctx.lineTo(0, cssH);
      ctx.closePath();
      ctx.fill();
      /* 原版在这里只设置描边色（供下面的速度线使用），不额外描边 */
      ctx.strokeStyle = pal.sandEdge;
    }

    /*
     * 速度线（原版 20 条）：随世界距离向下滚动，是速度感的主要来源。
     * 纯装饰，不参与任何判定。
     */
    function drawSpeedLines(pal, d, wy) {
      for (var e = 0; e < 20; e++) {
        var r = d + 46 + ((62 * e + 0.9 * wy) % (cssH - d));
        var i = Math.max(0.15, (r - d) / (cssH - d));
        ctx.lineWidth = 1 + 3 * i;
        ctx.beginPath();
        for (var x = -20; x <= cssW + 20; x += 24) {
          ctx.lineTo(x, r + 5 * Math.sin(0.02 * x + e) * i);
        }
        ctx.stroke();
      }
    }

    /*
     * 压雪纹（二期视觉升级保留项）：横向的雪棱/阴影带，
     * 随世界距离向下滚动。纯装饰，不表示任何规则。
     */
    function drawSnowTexture(pal, d, wy) {
      ctx.save();
      ctx.strokeStyle = pal.texture;
      ctx.lineWidth = 1.4;
      var spacing = 120;
      var base = Math.floor(wy / spacing) * spacing;
      for (var i = 0; i < 12; i++) {
        var ws = base + i * spacing;
        var y = d + 46 + ((ws - wy) * 0.55) % (cssH - d);
        if (y < d + 30 || y > cssH) continue;
        var alpha = 0.05 + 0.05 * Math.min(1, (y - d) / Math.max(1, cssH - d));
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        for (var x = -20; x <= cssW + 20; x += 26) {
          ctx.lineTo(x, y + 3 * Math.sin(0.018 * x + i * 1.7));
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    /* ---------- 旗门（原版画法） ---------- */
    function drawGates(pal, state, u, d) {
      var list = state.gateList;
      for (var i = 0; i < list.length; i++) {
        var g = list[i];
        var r = u - (g.y - state.wy);
        if (r < d || r > cssH + 40) continue;
        var sc = Math.max(0.25, (r - d) / (cssH - d));
        var half = 52 * sc * 2;
        for (var n = -1; n <= 1; n += 2) {
          var a = g.x + n * half;
          ctx.strokeStyle = pal.gatePole;
          ctx.lineWidth = 3 * sc + 1;
          ctx.beginPath();
          ctx.moveTo(a, r);
          ctx.lineTo(a, r - 46 * sc - 12);
          ctx.stroke();
          ctx.fillStyle = g.passed === 1 ? pal.gatePass : (g.passed === 2 ? pal.gateMiss : pal.gateIdle);
          ctx.beginPath();
          ctx.moveTo(a, r - 46 * sc - 12);
          ctx.lineTo(a + 24 * n * sc, r - 36 * sc - 8);
          ctx.lineTo(a, r - 28 * sc - 6);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    /* ---------- 滑雪者剪影（二期视觉保留项，姿态来自原版 vx） ---------- */
    function drawSkier(visual, x, y, tilt, scale) {
      var body = visual.player.body;
      var light = visual.player.bodyLight;
      var board = visual.player.board;
      var boardEdge = visual.player.boardEdge;
      var rim = visual.player.rim;
      var goggle = visual.player.goggle;

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.rotate(tilt);

      /* 板：翘头的一块 */
      var bw = 34;
      var bh = 7;
      var bg = ctx.createLinearGradient(0, -bh, 0, bh);
      bg.addColorStop(0, board);
      bg.addColorStop(1, boardEdge);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.moveTo(-bw * 0.52, -bh * 0.2);
      ctx.quadraticCurveTo(-bw * 0.5, -bh * 1.05, -bw * 0.36, -bh * 1.05);
      ctx.lineTo(bw * 0.4, -bh * 0.35);
      ctx.quadraticCurveTo(bw * 0.54, -bh * 0.5, bw * 0.56, bh * 0.35);
      ctx.lineTo(-bw * 0.42, bh * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rim;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-bw * 0.5, -bh * 0.35);
      ctx.quadraticCurveTo(0, -bh * 0.9, bw * 0.52, -bh * 0.1);
      ctx.stroke();
      ctx.globalAlpha = 1;

      /* 腿 */
      ctx.strokeStyle = body;
      ctx.lineCap = 'round';
      ctx.lineWidth = 4.6;
      ctx.beginPath();
      ctx.moveTo(-4, -bh * 0.3);
      ctx.lineTo(-2.6, -11);
      ctx.moveTo(5, -bh * 0.2);
      ctx.lineTo(3.2, -11.5);
      ctx.stroke();

      /* 身子 */
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(-6.6, -11);
      ctx.quadraticCurveTo(-7.6, -21, -4.2, -25.5);
      ctx.quadraticCurveTo(-0.6, -28.6, 3.2, -25.2);
      ctx.quadraticCurveTo(5.6, -21.6, 4.6, -12.4);
      ctx.quadraticCurveTo(0, -9.4, -6.6, -11);
      ctx.closePath();
      ctx.fill();

      /* 背上的高光 */
      ctx.strokeStyle = light;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-6.2, -12.6);
      ctx.quadraticCurveTo(-7.2, -21.4, -3.6, -25.4);
      ctx.stroke();
      ctx.globalAlpha = 1;

      /* 手臂 */
      ctx.strokeStyle = body;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(-3.4, -23.6);
      ctx.quadraticCurveTo(-10.5, -21.4, -13.2, -16.2);
      ctx.moveTo(3.4, -23.2);
      ctx.quadraticCurveTo(9.6, -21.6, 12.6, -17.2);
      ctx.stroke();

      /* 手杖 */
      ctx.strokeStyle = light;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-13.2, -16.2);
      ctx.lineTo(-16.5, -2.5);
      ctx.moveTo(12.6, -17.2);
      ctx.lineTo(16.2, -3.5);
      ctx.stroke();
      ctx.globalAlpha = 1;

      /* 头盔与护目镜 */
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(-0.6, -30.4, 5.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rim;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(-0.6, -30.4, 5.4, Math.PI * 0.9, Math.PI * 2.1);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = goggle;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(-1.4, -30, 3.2, 1.9, -0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.restore();
    }

    function drawPlayer(visual, state, u, mode) {
      var scale = mode === 'play' ? PLAYER_SCALE_PLAY : PLAYER_SCALE_CRUISE;
      var lean = state.vx * PLAYER_LEAN;
      if (lean > 1) lean = 1;
      if (lean < -1) lean = -1;
      var tilt = PLAYER_TILT * lean;

      /* 接地阴影（原版：板下的椭圆阴影） */
      ctx.fillStyle = visual.player.shadow;
      ctx.beginPath();
      ctx.ellipse(state.x + 4 * scale, u + 20 * scale, 40 * scale, 10 * scale, 0, 0, Math.PI * 2);
      ctx.fill();

      drawSkier(visual, state.x, u, tilt, scale);
    }

    /* ---------- 粒子（原版辉光） ---------- */
    function drawParticles(state) {
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < state.particles.length; i++) {
        var q = state.particles[i];
        var e = Math.max(0.2, q.r * q.life);
        var g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 2.6 * e);
        g.addColorStop(0, 'rgba(255,238,205,' + (0.55 * q.life).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(245,220,180,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(q.x, q.y, Math.max(0.2, 2.6 * e), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    /* ---------- 雪崩（原版：一层按 ava 驱动的渐变 + 飞尘 + 飞石） ---------- */
    function drawAvalanche(pal, state, u, d, now) {
      var j = d + 26 + (u - d - 40) * (1 - state.ava);
      var g = ctx.createLinearGradient(0, j - 90, 0, j + 30);
      g.addColorStop(0, pal.avalanche[0]);
      g.addColorStop(0.45, pal.avalanche[1]);
      g.addColorStop(1, pal.avalanche[2]);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, j - 90);
      ctx.lineTo(cssW, j - 90);
      ctx.lineTo(cssW, j);
      for (var x = cssW; x >= 0; x -= 16) {
        ctx.lineTo(x, j + 12 * Math.sin(0.035 * x + 0.004 * now) + 5 * Math.sin(0.09 * x + 0.007 * now));
      }
      ctx.closePath();
      ctx.fill();

      /* 飞尘 */
      for (var r = 0; r < 26; r++) {
        var dx = (137.1 * r + 0.05 * now) % cssW;
        var dy = j - 40 + 30 * Math.sin(2 * r + 0.005 * now);
        var dg = ctx.createRadialGradient(dx, dy, 0, dx, dy, 26);
        dg.addColorStop(0, pal.avalancheDust[0]);
        dg.addColorStop(1, pal.avalancheDust[1]);
        ctx.fillStyle = dg;
        ctx.beginPath();
        ctx.arc(dx, dy, 26, 0, Math.PI * 2);
        ctx.fill();
      }

      /* 飞石 */
      ctx.fillStyle = pal.avalancheRock;
      for (var k = 0; k < 5; k++) {
        var rx = (191 * k + 0.06 * now) % cssW;
        var ry = j - 6 + 8 * Math.sin(3 * k + 0.004 * now);
        ctx.beginPath();
        ctx.ellipse(rx, ry, 6, 4, k, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    /* ---------- 暗角（二期视觉保留项） ---------- */
    function drawVignette(visual) {
      var g = ctx.createRadialGradient(cssW / 2, cssH * 0.52, cssH * 0.24, cssW / 2, cssH * 0.52, cssH * 0.78);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, visual.vignette);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cssW, cssH);
    }

    /* ---------- 封面遮罩（原版） ---------- */
    function drawCoverVeil(pal) {
      var g = ctx.createLinearGradient(0, 0.47 * cssH, 0, cssH);
      g.addColorStop(0, pal.veil[0]);
      g.addColorStop(0.16, pal.veil[1]);
      g.addColorStop(1, pal.veil[2]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0.47 * cssH, cssW, 0.53 * cssH);
    }

    /* ---------- 主绘制 ---------- */
    function render(view) {
      if (!view || !view.state) return;
      var state = view.state;
      var pal = view.palette;
      var visual = view.visual;
      var mode = view.mode === 'play' ? 'play' : 'cruise';
      var u = view.u;
      var d = view.d;
      var now = view.now || 0;
      lastU = u;
      lastD = d;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      drawSky(pal);
      drawSun(pal, d);
      drawDunes(pal, d);
      drawSand(pal, d);
      drawSpeedLines(pal, d, state.wy);
      drawSnowTexture(pal, d, state.wy);
      drawGates(pal, state, u, d);
      /* 原版：l.dead>1 时不再画人物（死亡瞬间被雪崩吞没），粒子照画 */
      if (!(state.dead > 1)) drawPlayer(visual, state, u, mode);
      drawParticles(state);
      drawAvalanche(pal, state, u, d, now);
      if (view.veil) drawCoverVeil(pal);
      drawVignette(visual);
    }

    return {
      resize: resize,
      ensureSize: resize,
      getSize: function () { return { w: cssW, h: cssH }; },
      getScale: function () { return 1; },
      getOffset: function () { return { x: 0, y: 0 }; },
      getPlayerY: function () { return lastU; },
      getHorizonY: function () { return lastD; },
      render: render
    };
  }

  root.DuneRender = {
    createRenderer: createRenderer,
    PLAYER_SCALE_PLAY: PLAYER_SCALE_PLAY,
    PLAYER_SCALE_CRUISE: PLAYER_SCALE_CRUISE
  };
})(typeof window !== 'undefined' ? window : global);
