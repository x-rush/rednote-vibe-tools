/*
 * 彩沙瓶 · 渲染层
 * Canvas 2D。虚拟画布固定 430 高，宽度随屏幕变化，只做等比缩放。
 * 场景：一盏玻璃瓶立在木质工作台上，瓶里的彩色沙按层堆着。
 * Chrome 61 基线：不用 clip-path、filter 等新特性。
 */
(function (root) {
  'use strict';

  var VIEW_HEIGHT = 430;
  var GRID_W = 280;          /* 瓶内网格宽度（虚拟像素） */
  var CELL_H = 8.4;          /* 一粒沙的高度 */
  var BOTTOM_Y = 396;        /* 瓶内底边 */
  var NECK_TOP = 52;         /* 瓶口高度 */
  var WALL = 9;              /* 瓶壁厚度 */
  var COLS = 24;             /* 瓶内列数 */
  var MAX_HEIGHT = 34;       /* 瓶内最大层数 */

  /* Chrome 61 没有 roundRect，手写一个圆角矩形路径 */
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
    var fieldWidth = 400;
    var reduced = false;

    var grains = [];
    var floaters = [];
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
      scale = cssH / VIEW_HEIGHT;
      fieldWidth = cssW / scale;
      return true;
    }

    /* ---------- 瓶体几何 ---------- */
    function bottleGeom() {
      var half = GRID_W / 2;
      var cx = fieldWidth / 2;
      return {
        cx: cx,
        left: cx - half - WALL,
        right: cx + half + WALL,
        inner: half,
        cellW: GRID_W / COLS,
        top: BOTTOM_Y - MAX_HEIGHT * CELL_H,
        bottom: BOTTOM_Y,
        neckTop: NECK_TOP,
        neckHalf: half * 0.42
      };
    }

    function colX(geom, col) {
      return geom.cx - geom.inner + col * geom.cellW;
    }

    /* ---------- 特效 ---------- */
    function dropGrain(x, y, color, targetY) {
      grains.push({ x: x, y: y, vy: 0, color: color, targetY: targetY, life: 0 });
      if (grains.length > 260) grains.splice(0, grains.length - 260);
    }

    function floatText(x, y, text, color, size) {
      floaters.push({ x: x, y: y, text: text, color: color, size: size || 16, life: 0, max: 0.8 });
      if (floaters.length > 16) floaters.shift();
    }

    function clearEffects() {
      grains.length = 0;
      floaters.length = 0;
    }

    function updateEffects(dt) {
      var i;
      for (i = grains.length - 1; i >= 0; i--) {
        var g = grains[i];
        g.life += dt;
        if (g.life >= 0.42 || g.y >= g.targetY) {
          grains.splice(i, 1);
          continue;
        }
        g.vy += 900 * dt;
        g.y += g.vy * dt;
        if (g.y >= g.targetY) g.y = g.targetY;
      }
      for (i = floaters.length - 1; i >= 0; i--) {
        var f = floaters[i];
        f.life += dt;
        if (f.life >= f.max) {
          floaters.splice(i, 1);
          continue;
        }
        f.y -= dt * 26;
      }
    }

    /* ---------- 背景 ---------- */
    function drawTable(meta) {
      var grad = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
      grad.addColorStop(0, '#f3e3cc');
      grad.addColorStop(0.34, '#e8cfa8');
      grad.addColorStop(0.36, meta.wood[0]);
      grad.addColorStop(1, meta.wood[1]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, fieldWidth, VIEW_HEIGHT);

      /* 木纹 */
      ctx.strokeStyle = 'rgba(90,58,34,0.16)';
      ctx.lineWidth = 1.6;
      for (var y = 152; y < VIEW_HEIGHT; y += 26) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (var x = 0; x <= fieldWidth; x += 26) {
          ctx.lineTo(x, y + Math.sin(x * 0.017 + y * 0.05) * 3.2);
        }
        ctx.stroke();
      }
      /* 台面高光 */
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(0, 150, fieldWidth, 4);
    }

    /* ---------- 玻璃瓶 ---------- */
    function drawBottle(geom) {
      /* 瓶内阴影 */
      ctx.fillStyle = 'rgba(60,36,20,0.12)';
      ctx.beginPath();
      ctx.ellipse(geom.cx, BOTTOM_Y + 6, geom.inner * 0.92, 9, 0, 0, Math.PI * 2);
      ctx.fill();

      /* 瓶身玻璃 */
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(geom.cx - geom.neckHalf, geom.neckTop);
      ctx.lineTo(geom.cx + geom.neckHalf, geom.neckTop);
      ctx.lineTo(geom.cx + geom.neckHalf, geom.top - 8);
      ctx.quadraticCurveTo(geom.cx + geom.inner, geom.top + 26, geom.cx + geom.inner, geom.bottom - 10);
      ctx.quadraticCurveTo(geom.cx + geom.inner, geom.bottom, geom.cx + geom.inner - 12, geom.bottom);
      ctx.lineTo(geom.cx - geom.inner + 12, geom.bottom);
      ctx.quadraticCurveTo(geom.cx - geom.inner, geom.bottom, geom.cx - geom.inner, geom.bottom - 10);
      ctx.quadraticCurveTo(geom.cx - geom.inner, geom.top + 26, geom.cx - geom.neckHalf, geom.top - 8);
      ctx.closePath();

      var glass = ctx.createLinearGradient(geom.left, 0, geom.right, 0);
      glass.addColorStop(0, 'rgba(255,255,255,0.42)');
      glass.addColorStop(0.22, 'rgba(255,255,255,0.16)');
      glass.addColorStop(0.75, 'rgba(226,240,238,0.2)');
      glass.addColorStop(1, 'rgba(255,255,255,0.42)');
      ctx.fillStyle = glass;
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.72)';
      ctx.lineWidth = WALL;
      ctx.stroke();
      ctx.restore();

      /* 瓶口 */
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.ellipse(geom.cx, geom.neckTop, geom.neckHalf + WALL * 0.6, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();

      /* 高光 */
      ctx.fillStyle = 'rgba(255,255,255,0.34)';
      ctx.beginPath();
      ctx.moveTo(geom.cx - geom.inner * 0.66, geom.top + 16);
      ctx.lineTo(geom.cx - geom.inner * 0.52, geom.top + 16);
      ctx.lineTo(geom.cx - geom.inner * 0.58, geom.bottom - 22);
      ctx.lineTo(geom.cx - geom.inner * 0.72, geom.bottom - 22);
      ctx.closePath();
      ctx.fill();
    }

    /* ---------- 沙 ---------- */
    function drawSand(meta, view, geom) {
      var cols = view.cols;
      var palette = meta.palette;
      for (var c = 0; c < cols.length; c++) {
        var column = cols[c];
        var x = colX(geom, c);
        for (var r = 0; r < column.length; r++) {
          var y = geom.bottom - (r + 1) * CELL_H;
          var base = palette[column[r]] || '#cccccc';
          ctx.fillStyle = base;
          ctx.fillRect(x, y, geom.cellW + 0.4, CELL_H + 0.4);
          /* 颗粒高光：只给最上面一格加，避免逐格描边太脏 */
          if (r === column.length - 1) {
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fillRect(x, y, geom.cellW + 0.4, 1.6);
          }
        }
      }
    }

    /* ---------- 目标缩略图 ---------- */
    function drawTarget(meta, view, geom) {
      if (!view.target) return;
      var boxW = 74;
      var boxH = 92;
      var x = fieldWidth - boxW - 10;
      var y = 14;
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      roundRect(ctx, x, y, boxW, boxH, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,86,58,0.3)';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      var grid = view.target.grid;
      var cols = meta.cols;
      var cellW = (boxW - 16) / cols;
      var cellH = 3.1;
      var baseY = y + boxH - 12;
      for (var r = 0; r < grid.length; r++) {
        for (var c = 0; c < cols; c++) {
          var color = grid[r][c];
          if (color < 0) continue;
          ctx.fillStyle = meta.palette[color];
          ctx.fillRect(x + 8 + c * cellW, baseY - (r + 1) * cellH, cellW + 0.3, cellH + 0.3);
        }
      }
      ctx.fillStyle = 'rgba(60,40,26,0.55)';
      ctx.font = '600 11px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('目标', x + 8, y + 14);
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

      drawTable(meta);
      var geom = bottleGeom();
      drawBottle(geom);
      drawSand(meta, view, geom);

      /* 下落中的沙粒 */
      for (var i = 0; i < grains.length; i++) {
        var g = grains[i];
        ctx.globalAlpha = g.life > 0.3 ? 1 - (g.life - 0.3) / 0.12 : 1;
        ctx.fillStyle = g.color;
        ctx.fillRect(g.x, g.y, geom.cellW, CELL_H);
      }
      ctx.globalAlpha = 1;

      /* 浮字 */
      for (var j = 0; j < floaters.length; j++) {
        var f = floaters[j];
        ctx.globalAlpha = 1 - f.life / f.max;
        ctx.fillStyle = f.color;
        ctx.font = '700 ' + f.size + 'px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(f.text, f.x, f.y);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';

      drawTarget(meta, view, geom);
    }

    return {
      resize: resize,
      ensureSize: resize,
      getFieldWidth: function () { return fieldWidth; },
      getScale: function () { return scale; },
      getGeom: bottleGeom,
      /*
       * 把画布上的 CSS 像素横坐标换算成列号。
       * 画布按 scale 等比缩放，虚拟坐标 = CSS 坐标 / scale，
       * 直接拿 CSS 坐标去比虚拟几何会整体偏移（越靠右偏得越多）。
       */
      colAt: function (cssX) {
        var geom = bottleGeom();
        var vx = cssX / scale;
        var index = Math.floor((vx - (geom.cx - geom.inner)) / geom.cellW);
        if (index < 0 || index >= COLS) return -1;
        return index;
      },
      dropGrain: dropGrain,
      floatText: floatText,
      clearEffects: clearEffects,
      updateEffects: updateEffects,
      render: render,
      setReducedMotion: function (v) { reduced = !!v; },
      isReducedMotion: function () { return reduced; }
    };
  }

  root.SandRender = { createRenderer: createRenderer, VIEW_HEIGHT: VIEW_HEIGHT, CELL_H: CELL_H };
})(typeof window !== 'undefined' ? window : global);
