/*
 * 珍珠消消乐 · 渲染层
 * Canvas 2D：珍珠球体（高光 / 次表面散射 / 接触阴影）、连锁拖尾、屏幕震动、糖浆光晕。
 */
(function (root) {
  'use strict';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOutCubic(t) { var u = 1 - t; return 1 - u * u * u; }
  function easeOutBack(t) { var c = 1.70158, c3 = c + 1, u = t - 1; return 1 + c3 * u * u * u + c * u * u; }
  function easeInQuad(t) { return t * t; }

  /* ---------- 颜色 ---------- */
  function hexToRgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function rgba(hex, a) {
    var c = hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  }
  function mix(hexA, hexB, t) {
    var a = hexToRgb(hexA), b = hexToRgb(hexB);
    var r = Math.round(lerp(a.r, b.r, t));
    var g = Math.round(lerp(a.g, b.g, t));
    var bl = Math.round(lerp(a.b, b.b, t));
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  /* ---------- 渲染器 ---------- */
  function createRenderer(canvas, options) {
    var opts = options || {};
    var ctx = canvas.getContext('2d');
    var dpr = 1;
    var W = 0, H = 0;
    var layout = { cell: 40, gap: 6, originX: 0, originY: 0, cols: 6, rows: 8 };
    var flavors = [];
    var flavorById = {};
    var pearls = [];       /* 视觉层珍珠 {id,color,row,col,x,y,scale,alpha,state,...} */
    var particles = [];
    var ripples = [];
    var floaters = [];
    var shake = { x: 0, y: 0, power: 0 };
    var flash = { a: 0, color: '#ffffff' };
    var sugar = { a: 0 };
    var reduced = false;

    function setFlavorList(list) {
      flavors = list || [];
      flavorById = {};
      for (var i = 0; i < flavors.length; i++) flavorById[flavors[i].id] = flavors[i];
    }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      dpr = Math.min(root.devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(rect.width));
      H = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      computeLayout();
      return { w: W, h: H, dpr: dpr };
    }

    /*
     * 画布 CSS 尺寸可能被 HUD 显隐等布局变化改变，
     * 若不同步内部缓冲会导致图形被拉伸，这里按需自愈。
     */
    function ensureSize() {
      var cw = canvas.clientWidth;
      var ch = canvas.clientHeight;
      if (!cw || !ch) return false;
      if (cw === W && ch === H) return false;
      resize();
      return true;
    }

    function computeLayout() {
      var cols = layout.cols, rows = layout.rows;
      var padX = 10, padY = 8;
      var availW = W - padX * 2;
      var availH = H - padY * 2;
      var gap = Math.max(3, Math.round(Math.min(W, H) * 0.013));
      var cell = Math.floor(Math.min((availW - gap * (cols - 1)) / cols, (availH - gap * (rows - 1)) / rows));
      cell = clamp(cell, 22, 78);
      var boardW = cell * cols + gap * (cols - 1);
      var boardH = cell * rows + gap * (rows - 1);
      layout.cell = cell;
      layout.gap = gap;
      layout.originX = Math.round((W - boardW) / 2);
      layout.originY = Math.round((H - boardH) / 2);
    }

    function setGrid(cols, rows) {
      layout.cols = cols;
      layout.rows = rows;
      computeLayout();
    }

    function cellX(col) { return layout.originX + col * (layout.cell + layout.gap); }
    function cellY(row) { return layout.originY + row * (layout.cell + layout.gap); }
    function cellCenter(col) { return cellX(col) + layout.cell / 2; }
    function cellCenterY(row) { return cellY(row) + layout.cell / 2; }

    /* 命中测试：返回 {row,col} 或 null */
    function hitTest(x, y) {
      var col = Math.round((x - layout.originX) / (layout.cell + layout.gap));
      var row = Math.round((y - layout.originY) / (layout.cell + layout.gap));
      if (row < 0 || row >= layout.rows || col < 0 || col >= layout.cols) return null;
      var cx = cellX(col), cy = cellY(row);
      if (x < cx - layout.gap / 2 || x > cx + layout.cell + layout.gap / 2) return null;
      if (y < cy - layout.gap / 2 || y > cy + layout.cell + layout.gap / 2) return null;
      return { row: row, col: col };
    }

    /* ---------- 珍珠绘制 ---------- */
    function drawPearl(p) {
      var f = flavorById[p.colorId];
      if (!f) return;
      var x = p.x, y = p.y;
      var r = layout.cell * 0.5 * p.scale;
      if (r <= 0.2) return;
      var alpha = p.alpha == null ? 1 : p.alpha;
      if (alpha <= 0.01) return;

      ctx.save();
      ctx.globalAlpha = alpha;

      /* 接触阴影（贴在格子底部的软影） */
      if (p.state !== 'flying') {
        ctx.save();
        ctx.globalAlpha = alpha * 0.3 * (p.shadow == null ? 1 : p.shadow);
        var shadowGrad = ctx.createRadialGradient(x, y + r * 0.62, r * 0.1, x, y + r * 0.62, r * 0.95);
        shadowGrad.addColorStop(0, 'rgba(74,38,20,0.55)');
        shadowGrad.addColorStop(1, 'rgba(74,38,20,0)');
        ctx.fillStyle = shadowGrad;
        ctx.beginPath();
        ctx.ellipse(x, y + r * 0.62, r * 0.95, r * 0.38, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      /* 球体主体：偏心径向渐变模拟次表面散射 */
      var gx = x - r * 0.32, gy = y - r * 0.36;
      var body = ctx.createRadialGradient(gx, gy, r * 0.05, x, y, r * 1.02);
      body.addColorStop(0, f.accent);
      body.addColorStop(0.28, f.light);
      body.addColorStop(0.62, f.body);
      body.addColorStop(1, f.dark);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      /* 边缘暗部收束 */
      var rim = ctx.createRadialGradient(x, y, r * 0.72, x, y, r);
      rim.addColorStop(0, 'rgba(0,0,0,0)');
      rim.addColorStop(1, rgba(f.dark, 0.55));
      ctx.fillStyle = rim;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      /* 主高光 */
      var hl = ctx.createRadialGradient(x - r * 0.34, y - r * 0.4, 0, x - r * 0.34, y - r * 0.4, r * 0.52);
      hl.addColorStop(0, 'rgba(255,255,255,0.95)');
      hl.addColorStop(0.35, 'rgba(255,255,255,0.42)');
      hl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hl;
      ctx.beginPath();
      ctx.ellipse(x - r * 0.3, y - r * 0.36, r * 0.44, r * 0.32, -0.5, 0, Math.PI * 2);
      ctx.fill();

      /* 次高光小点 */
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.beginPath();
      ctx.ellipse(x + r * 0.26, y + r * 0.3, r * 0.14, r * 0.1, 0.6, 0, Math.PI * 2);
      ctx.fill();

      /* 底部环境反射光 */
      var bounce = ctx.createRadialGradient(x + r * 0.12, y + r * 0.66, 0, x + r * 0.12, y + r * 0.66, r * 0.6);
      bounce.addColorStop(0, rgba(f.accent, 0.3));
      bounce.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = bounce;
      ctx.beginPath();
      ctx.ellipse(x + r * 0.1, y + r * 0.6, r * 0.5, r * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();

      /* 选中/可点高亮环 */
      if (p.highlight > 0.01) {
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.85 * p.highlight) + ')';
        ctx.lineWidth = Math.max(1.5, r * 0.11);
        ctx.beginPath();
        ctx.arc(x, y, r * (1.02 + 0.1 * p.highlight), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* ---------- 背景：茶汤底 ---------- */
    function drawBackground(t) {
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#2a1610');
      g.addColorStop(0.45, '#3d2015');
      g.addColorStop(1, '#1d0f0b');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      /* 顶部糖浆光晕 */
      var halo = ctx.createRadialGradient(W * 0.5, -H * 0.12, 0, W * 0.5, -H * 0.12, H * 0.7);
      halo.addColorStop(0, 'rgba(255,186,122,0.34)');
      halo.addColorStop(0.5, 'rgba(214,120,60,0.14)');
      halo.addColorStop(1, 'rgba(214,120,60,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, W, H);

      /* 缓慢漂浮的气泡 */
      var seed = 7;
      for (var i = 0; i < 14; i++) {
        seed = (seed * 9301 + 49297) % 233280;
        var bx = (seed / 233280) * W;
        seed = (seed * 9301 + 49297) % 233280;
        var by = (seed / 233280) * H;
        var speed = 8 + (i % 5) * 5;
        var yy = (by - t * speed) % (H + 60);
        if (yy < -40) yy += H + 60;
        var br = 2 + (i % 4) * 2.4;
        ctx.strokeStyle = 'rgba(255,220,180,0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(bx + Math.sin(t * 0.7 + i) * 6, yy, br, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    /* ---------- 棋盘底板 ---------- */
    function drawBoardPlate() {
      var pad = layout.gap * 1.6;
      var x = layout.originX - pad;
      var y = layout.originY - pad;
      var w = layout.cell * layout.cols + layout.gap * (layout.cols - 1) + pad * 2;
      var h = layout.cell * layout.rows + layout.gap * (layout.rows - 1) + pad * 2;
      var r = 22;
      ctx.save();
      ctx.beginPath();
      roundRect(ctx, x, y, w, h, r);
      var plate = ctx.createLinearGradient(0, y, 0, y + h);
      plate.addColorStop(0, 'rgba(255,236,214,0.13)');
      plate.addColorStop(1, 'rgba(120,60,30,0.10)');
      ctx.fillStyle = plate;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,225,195,0.22)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      /* 内部茶色积液 */
      var liquid = ctx.createLinearGradient(0, y + h * 0.35, 0, y + h);
      liquid.addColorStop(0, 'rgba(196,112,54,0)');
      liquid.addColorStop(1, 'rgba(196,112,54,0.16)');
      ctx.fillStyle = liquid;
      ctx.beginPath();
      roundRect(ctx, x, y, w, h, r);
      ctx.fill();
      ctx.restore();
    }

    function roundRect(c, x, y, w, h, r) {
      var rr = Math.min(r, w / 2, h / 2);
      c.moveTo(x + rr, y);
      c.lineTo(x + w - rr, y);
      c.quadraticCurveTo(x + w, y, x + w, y + rr);
      c.lineTo(x + w, y + h - rr);
      c.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
      c.lineTo(x + rr, y + h);
      c.quadraticCurveTo(x, y + h, x, y + h - rr);
      c.lineTo(x, y + rr);
      c.quadraticCurveTo(x, y, x + rr, y);
      c.closePath();
    }

    /* ---------- 粒子 ---------- */
    function burst(x, y, colorId, count, power) {
      var f = flavorById[colorId] || { light: '#fff', accent: '#fff' };
      for (var i = 0; i < count; i++) {
        var a = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        var sp = (60 + Math.random() * 190) * (power || 1);
        particles.push({
          x: x, y: y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 60 * (power || 1),
          r: 1.6 + Math.random() * 3.4,
          life: 0.5 + Math.random() * 0.5,
          age: 0,
          color: Math.random() > 0.45 ? f.light : f.accent,
          gravity: 520
        });
      }
    }

    function ripple(x, y, color, maxR) {
      ripples.push({ x: x, y: y, r: 4, maxR: maxR || 90, age: 0, life: 0.45, color: color });
    }

    function floater(x, y, text, color, scale) {
      floaters.push({ x: x, y: y, text: text, color: color, age: 0, life: 0.95, scale: scale || 1 });
    }

    function addShake(power) {
      shake.power = Math.min(26, shake.power + power);
    }

    function addFlash(color, amount) {
      flash.color = color;
      flash.a = Math.max(flash.a, amount);
    }

    function updateEffects(dt) {
      var i;
      for (i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.age += dt;
        if (p.age >= p.life) { particles.splice(i, 1); continue; }
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.985;
      }
      for (i = ripples.length - 1; i >= 0; i--) {
        var r = ripples[i];
        r.age += dt;
        if (r.age >= r.life) { ripples.splice(i, 1); continue; }
        r.r = lerp(4, r.maxR, easeOutCubic(r.age / r.life));
      }
      for (i = floaters.length - 1; i >= 0; i--) {
        var fl = floaters[i];
        fl.age += dt;
        if (fl.age >= fl.life) { floaters.splice(i, 1); continue; }
      }
      if (shake.power > 0.05) {
        shake.power *= Math.pow(0.0016, dt);
        shake.x = (Math.random() - 0.5) * shake.power;
        shake.y = (Math.random() - 0.5) * shake.power;
      } else {
        shake.power = 0; shake.x = 0; shake.y = 0;
      }
      flash.a = Math.max(0, flash.a - dt * 2.6);
      sugar.a = Math.max(0, sugar.a - dt * 1.8);
    }

    function drawEffects() {
      var i;
      for (i = 0; i < ripples.length; i++) {
        var r = ripples[i];
        var k = 1 - r.age / r.life;
        ctx.strokeStyle = rgba(r.color, 0.5 * k);
        ctx.lineWidth = 2 + 4 * k;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (i = 0; i < particles.length; i++) {
        var p = particles[i];
        var k = 1 - p.age / p.life;
        ctx.fillStyle = rgba(p.color, 0.85 * k);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (0.4 + 0.6 * k), 0, Math.PI * 2);
        ctx.fill();
      }
      for (i = 0; i < floaters.length; i++) {
        var f = floaters[i];
        var t = f.age / f.life;
        var pop = t < 0.18 ? easeOutBack(t / 0.18) : 1;
        ctx.save();
        ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
        ctx.translate(f.x, f.y - t * 46);
        ctx.scale(f.scale * pop, f.scale * pop);
        ctx.font = '800 ' + Math.round(20 * f.scale) + 'px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(40,16,8,0.75)';
        ctx.strokeText(f.text, 0, 0);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, 0, 0);
        ctx.restore();
      }
    }

    /* ---------- 主绘制 ---------- */
    function render(t) {
      ctx.save();
      ctx.clearRect(0, 0, W, H);
      ctx.translate(shake.x, shake.y);
      drawBackground(t);
      drawBoardPlate();

      /* 按 row 排序，保证下方珍珠压在上方 */
      var sorted = pearls.slice().sort(function (a, b) { return a.row - b.row; });
      for (var i = 0; i < sorted.length; i++) drawPearl(sorted[i]);

      drawEffects();

      if (flash.a > 0.01) {
        ctx.fillStyle = rgba(flash.color, flash.a * 0.42);
        ctx.fillRect(0, 0, W, H);
      }
      if (sugar.a > 0.01) {
        var sg = ctx.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, Math.max(W, H) * 0.7);
        sg.addColorStop(0, 'rgba(255,206,140,' + (sugar.a * 0.2) + ')');
        sg.addColorStop(1, 'rgba(255,206,140,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
    }

    function setReducedMotion(v) { reduced = !!v; }

    var api = {
      ctx: ctx,
      resize: resize,
      ensureSize: ensureSize,
      render: render,
      updateEffects: updateEffects,
      setFlavorList: setFlavorList,
      setGrid: setGrid,
      hitTest: hitTest,
      cellX: cellX,
      cellY: cellY,
      cellCenter: cellCenter,
      cellCenterY: cellCenterY,
      getLayout: function () { return layout; },
      burst: burst,
      ripple: ripple,
      floater: floater,
      addShake: addShake,
      addFlash: addFlash,
      setSugar: function (v) { sugar.a = Math.max(sugar.a, v); },
      setPearls: function (list) { pearls = list; },
      getPearls: function () { return pearls; },
      clearEffects: function () { particles.length = 0; ripples.length = 0; floaters.length = 0; shake.power = 0; flash.a = 0; },
      setReducedMotion: setReducedMotion,
      isReduced: function () { return reduced; }
    };
    return api;
  }

  root.BobaRender = { createRenderer: createRenderer, rgba: rgba, mix: mix, hexToRgb: hexToRgb };
})(typeof window !== 'undefined' ? window : global);
