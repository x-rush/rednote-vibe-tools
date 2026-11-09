/*
 * 彩沙瓶 · 渲染层
 * Canvas 2D。虚拟画布固定 430 高，宽度随屏幕变化，只做等比缩放。
 * 沙引擎坐标系与渲染坐标系一致：engine.W = fieldWidth，engine.H = 430。
 * 瓶体轮廓直接采样引擎 bottleX() 剖面——视觉边界与物理边界严格重合，
 * 这一点是原版玩法识别的一部分（瓶颈会限制你后期的操作）。
 * 场景：暖光木工作台 + 有厚度的玻璃瓶 + 逐粒沙堆；「举向光亮」结果页切换背光模式。
 * 性能模型：静态内容烘焙进三张离屏画布（bg / sand / glass），
 *   沙层按引擎 dirty 标记失效——沙是逐粒物理，粒子集合或位置变了才重画全部粒子，
 *   静止帧只做 3 次 drawImage 合成。粒子用按色缓存的 sprite drawImage，2600 粒也可控。
 * Chrome 61 基线：不用 clip-path、filter、roundRect 等新特性。
 */
(function (root) {
  'use strict';

  var VIEW_HEIGHT = 430;     /* 引擎与渲染共用的虚拟高度 */
  var TABLE_Y = 168;         /* 桌面台沿 */
  var BG_PAD = 10;           /* 背景缓存层的左右余量：整体视差位移用 */
  var WALL = 9;              /* 瓶壁视觉厚度 */

  function makeLayer(w, h) {
    var off = root.document.createElement('canvas');
    off.width = Math.max(1, w);
    off.height = Math.max(1, h);
    return off;
  }

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

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpColor(a, b, t) {
    var ar = parseInt(a.slice(1, 3), 16);
    var ag = parseInt(a.slice(3, 5), 16);
    var ab = parseInt(a.slice(5, 7), 16);
    var br = parseInt(b.slice(1, 3), 16);
    var bg = parseInt(b.slice(3, 5), 16);
    var bb = parseInt(b.slice(5, 7), 16);
    var r = Math.round(lerp(ar, br, t));
    var g = Math.round(lerp(ag, bg, t));
    var bl = Math.round(lerp(ab, bb, t));
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  function clampIndex(i, n) {
    if (i < 0) return 0;
    if (i > n - 1) return n - 1;
    return i;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }

  /* ---------- 墙面细颗粒纹理 ---------- */
  function wallPattern(ctx) {
    if (ctx.__sandWall) return ctx.__sandWall;
    var size = 48;
    var off = root.document.createElement('canvas');
    off.width = size;
    off.height = size;
    var c = off.getContext('2d');
    var seed = 424299;
    function rand() {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    }
    for (var i = 0; i < 420; i++) {
      var x = rand() * size;
      var y = rand() * size;
      var r = 0.3 + rand() * 0.7;
      c.fillStyle = rand() > 0.5 ? 'rgba(255,232,196,0.16)' : 'rgba(20,12,6,0.2)';
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
    ctx.__sandWall = ctx.createPattern(off, 'repeat');
    return ctx.__sandWall;
  }

  function createRenderer(canvas) {
    var ctx = canvas.getContext('2d');
    var dpr = 1;
    var cssW = 0;
    var cssH = 0;
    var scale = 1;
    var fieldWidth = 400;
    var reduced = false;

    var engine = null;
    var mode = 'craft';        /* cover | craft | result */

    /* 封瓶演出粒子 */
    var ribbons = [];
    var rings = [];
    var card = null;
    var sealT = 0;
    var sealActive = false;

    var pointer = { x: 0, y: 0, active: false, down: false };
    var glare = 0;

    /* ---------- 离屏层 ---------- */
    var bgLayer = null;
    var sandLayer = null;
    var glassLayer = null;
    var bgCtx = null;
    var sandCtx = null;
    var glassCtx = null;
    var bgDirty = true;
    var sandDirty = true;
    var glassDirty = true;
    var bgMode = null;
    var stats = { frames: 0, lastFrameDraws: 0, lastFrameMs: 0 };

    /* 沙粒图集缓存在 createRenderer 闭包内（见下方 atlas 区块） */

    /* 绘制函数都引用闭包里的 ctx；画离屏层时临时切换过去，画完恢复 */
    function useLayer(target, fn) {
      var old = ctx;
      ctx = target;
      try {
        fn();
      } finally {
        ctx = old;
      }
    }

    /* ---------- 尺寸 ---------- */
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
      var physW = canvas.width;
      var physH = canvas.height;
      var padPhys = Math.ceil(BG_PAD * dpr * scale);
      bgLayer = makeLayer(physW + padPhys * 2, physH);
      bgCtx = bgLayer.getContext('2d');
      sandLayer = makeLayer(physW, physH);
      sandCtx = sandLayer.getContext('2d');
      glassLayer = makeLayer(physW, physH);
      glassCtx = glassLayer.getContext('2d');
      bgDirty = true;
      sandDirty = true;
      glassDirty = true;
      bgMode = null;
      clipPath = null;
      /* 引擎坐标系跟随画布；原版 resize 会按比例缩放已有沙粒 */
      if (engine) engine.resize(fieldWidth, VIEW_HEIGHT);
      return true;
    }

    /* ---------- 引擎绑定 ---------- */
    function setEngine(next, nextMode) {
      if (engine === next && mode === nextMode) return;
      engine = next;
      mode = nextMode;
      sandDirty = true;
      bgDirty = true;
      glassDirty = true;
      if (engine && fieldWidth > 0) engine.resize(fieldWidth, VIEW_HEIGHT);
    }

    /* ---------- 瓶体几何（全部来自引擎 bottleX 剖面） ---------- */
    function bottleGeom() {
      if (!engine || !(engine.W > 0)) return null;
      var top = engine.topY();
      var bottom = engine.bottomY();
      var cx = engine.W / 2;
      var bottomPair = engine.bottleX(bottom);
      var topPair = engine.bottleX(top);
      return {
        cx: cx,
        left: bottomPair[0],
        right: bottomPair[1],
        inner: bottomPair[1] - cx,
        top: top,
        bottom: bottom,
        neckTop: top,
        neckHalf: topPair[1] - cx,
        W: engine.W,
        H: engine.H
      };
    }

    /*
     * 瓶身轮廓路径：从引擎 bottleX() 逐段采样。
     * 左右两壁各采 44 段，瓶颈直段 / 肩部二次曲线 / 底部收圆全部来自原版公式。
     */
    function bottlePath(g, target) {
      var c = target || ctx;
      if (!g) g = bottleGeom();
      var steps = 44;
      var leftPts = [];
      var rightPts = [];
      for (var i = 0; i <= steps; i++) {
        var y = g.top + ((g.bottom - g.top) * i) / steps;
        var pair = engine.bottleX(y);
        leftPts.push({ x: pair[0], y: y });
        rightPts.push({ x: pair[1], y: y });
      }
      c.beginPath();
      c.moveTo(leftPts[0].x, g.top);
      for (var l = 1; l < leftPts.length; l++) c.lineTo(leftPts[l].x, leftPts[l].y);
      for (var r = rightPts.length - 1; r >= 0; r--) c.lineTo(rightPts[r].x, rightPts[r].y);
      c.closePath();
      return { leftPts: leftPts, rightPts: rightPts };
    }

    /* ---------- 视差：烘焙时冻结为 0，运行期用整层 drawImage 偏移实现 ---------- */
    function layerShift(k) {
      if (reduced || !pointer.active) return 0;
      return (pointer.x - fieldWidth / 2) * k;
    }

    /* 暖光晕 */
    function glowAt(cx, cy, r, col, alpha) {
      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(' + col + ',' + alpha.toFixed(3) + ')');
      g.addColorStop(0.55, 'rgba(' + col + ',' + (alpha * 0.34).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + col + ',0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }

    /* ---------- 远景：暖光墙 ---------- */
    function drawRoom(meta) {
      var wall = meta.wall || ['#241a14', '#5d4029'];
      var shift = layerShift(0.006);
      ctx.save();
      ctx.translate(shift, 0);
      /* 远景压暗、偏冷，和中景近景拉开明度与色温 */
      var grad = ctx.createLinearGradient(0, 0, 0, TABLE_Y);
      grad.addColorStop(0, '#150f0c');
      grad.addColorStop(0.3, wall[0]);
      grad.addColorStop(0.78, lerpColor(wall[0], wall[1], 0.72));
      grad.addColorStop(1, wall[1]);
      ctx.fillStyle = grad;
      ctx.fillRect(-BG_PAD - shift, 0, fieldWidth + BG_PAD * 2, VIEW_HEIGHT);
      /* 墙面细颗粒 */
      var pat = wallPattern(ctx);
      if (pat) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = pat;
        ctx.fillRect(-BG_PAD - shift, 0, fieldWidth + BG_PAD * 2, TABLE_Y);
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      /* 吊灯打在墙上的暖光晕 */
      glowAt(fieldWidth * 0.5, 60, fieldWidth * 0.58, '255,196,124', 0.26);
      /* 窗那侧的暖光 */
      glowAt(fieldWidth * 0.13, 24, fieldWidth * 0.44, '255,186,110', 0.2);
      /* 墙脚压暗 */
      var foot = ctx.createLinearGradient(0, TABLE_Y - 46, 0, TABLE_Y);
      foot.addColorStop(0, 'rgba(10,6,3,0)');
      foot.addColorStop(1, 'rgba(10,6,3,0.5)');
      ctx.fillStyle = foot;
      ctx.fillRect(-BG_PAD, TABLE_Y - 46, fieldWidth + BG_PAD * 2, 46);
    }

    /*
     * 窗光：左上打进来的斜向光柱。
     * 上下两段用同一组边界坐标，保证方向一致、边缘柔化。
     * xl/xr 是相对场宽的比例。
     */
    function drawShaft(y0, y1, xl0, xr0, xl1, xr1, alpha) {
      var bands = [
        { a0: 0, a1: 1, w: 0.22 },
        { a0: 0.16, a1: 0.84, w: 0.34 },
        { a0: 0.34, a1: 0.66, w: 0.5 }
      ];
      for (var b = 0; b < bands.length; b++) {
        var band = bands[b];
        var l0 = xl0 + (xr0 - xl0) * band.a0;
        var r0 = xl0 + (xr0 - xl0) * band.a1;
        var l1 = xl1 + (xr1 - xl1) * band.a0;
        var r1 = xl1 + (xr1 - xl1) * band.a1;
        var g = ctx.createLinearGradient(0, y0, 0, y1);
        g.addColorStop(0, 'rgba(255,226,168,' + (alpha * band.w).toFixed(3) + ')');
        g.addColorStop(0.6, 'rgba(255,214,150,' + (alpha * band.w * 0.55).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(255,206,140,' + (alpha * band.w * 0.2).toFixed(3) + ')');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(fieldWidth * l0, y0);
        ctx.lineTo(fieldWidth * r0, y0);
        ctx.lineTo(fieldWidth * r1, y1);
        ctx.lineTo(fieldWidth * l1, y1);
        ctx.closePath();
        ctx.fill();
      }
    }

    /* 光柱在墙上的部分 */
    function drawWallShaft() {
      drawShaft(-24, TABLE_Y, -0.12, 0.18, 0.1, 0.4, 0.3);
    }

    /* ---------- 中景：吊灯 ---------- */
    function drawLamp(x, cordY, r, glowR, warm) {
      /* 吊线 */
      ctx.strokeStyle = 'rgba(16,10,5,0.6)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, cordY - r * 0.9);
      ctx.stroke();
      /* 灯罩 */
      var shade = ctx.createLinearGradient(x - r * 1.3, 0, x + r * 1.3, 0);
      shade.addColorStop(0, '#7c4f2c');
      shade.addColorStop(0.42, '#b57b45');
      shade.addColorStop(1, '#4a2c17');
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.28, cordY - r * 1.9);
      ctx.lineTo(x + r * 0.28, cordY - r * 1.9);
      ctx.lineTo(x + r * 1.25, cordY - r * 0.15);
      ctx.quadraticCurveTo(x, cordY + r * 0.2, x - r * 1.25, cordY - r * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,206,150,0.28)';
      ctx.lineWidth = 1;
      ctx.stroke();
      /* 灯泡 */
      var bulb = ctx.createRadialGradient(x - r * 0.2, cordY + r * 0.1, 0, x, cordY + r * 0.25, r * 0.95);
      bulb.addColorStop(0, '#fff6dc');
      bulb.addColorStop(0.5, warm || '#ffd88f');
      bulb.addColorStop(1, 'rgba(255,180,90,0.15)');
      ctx.fillStyle = bulb;
      ctx.beginPath();
      ctx.arc(x, cordY + r * 0.25, r * 0.72, 0, Math.PI * 2);
      ctx.fill();
      /* 光晕 */
      glowAt(x, cordY + r * 0.3, glowR, '255,206,138', 0.3);
    }

    function drawLamps() {
      var shift = layerShift(0.014);
      ctx.save();
      ctx.translate(shift, 0);
      drawLamp(fieldWidth * 0.5, 52, 6, fieldWidth * 0.30, '#ffd88f');
      drawLamp(fieldWidth * 0.125, 22, 4, fieldWidth * 0.17, '#ffd08a');
      drawLamp(fieldWidth * 0.875, 30, 4.4, fieldWidth * 0.19, '#ffd08a');
      ctx.restore();
    }

    /* ---------- 中景：架子上的瓶影 ---------- */
    function jarPath(x, baseY, w, h, kind) {
      ctx.beginPath();
      if (kind === 'tall') {
        ctx.moveTo(x + w * 0.34, baseY - h);
        ctx.lineTo(x + w * 0.66, baseY - h);
        ctx.lineTo(x + w * 0.66, baseY - h * 0.7);
        ctx.quadraticCurveTo(x + w, baseY - h * 0.48, x + w, baseY - h * 0.12);
        ctx.quadraticCurveTo(x + w, baseY, x + w - 3, baseY);
        ctx.lineTo(x + 3, baseY);
        ctx.quadraticCurveTo(x, baseY, x, baseY - h * 0.12);
        ctx.quadraticCurveTo(x, baseY - h * 0.48, x + w * 0.34, baseY - h * 0.7);
        ctx.closePath();
      } else if (kind === 'squat') {
        ctx.moveTo(x + w * 0.24, baseY - h);
        ctx.lineTo(x + w * 0.76, baseY - h);
        ctx.lineTo(x + w, baseY - h * 0.58);
        ctx.quadraticCurveTo(x + w, baseY, x + w - 4, baseY);
        ctx.lineTo(x + 4, baseY);
        ctx.quadraticCurveTo(x, baseY, x, baseY - h * 0.58);
        ctx.closePath();
      } else {
        ctx.moveTo(x + w * 0.18, baseY - h);
        ctx.quadraticCurveTo(x + w * 0.5, baseY - h * 1.04, x + w * 0.82, baseY - h);
        ctx.quadraticCurveTo(x + w, baseY - h * 0.6, x + w, baseY - h * 0.28);
        ctx.quadraticCurveTo(x + w, baseY, x + w - 4, baseY);
        ctx.lineTo(x + 4, baseY);
        ctx.quadraticCurveTo(x, baseY, x, baseY - h * 0.28);
        ctx.quadraticCurveTo(x, baseY - h * 0.6, x + w * 0.18, baseY - h);
        ctx.closePath();
      }
    }

    function drawShelfBoard(x0, x1, y, thickness) {
      var g = ctx.createLinearGradient(0, y, 0, y + thickness);
      g.addColorStop(0, '#7b4f2c');
      g.addColorStop(0.35, '#5a3720');
      g.addColorStop(1, '#2b1a0f');
      ctx.fillStyle = g;
      ctx.fillRect(x0, y, x1 - x0, thickness);
      /* 上沿受光 */
      ctx.fillStyle = 'rgba(255,214,160,0.34)';
      ctx.fillRect(x0, y, x1 - x0, 1.4);
      /* 板下阴影 */
      var sh = ctx.createLinearGradient(0, y + thickness, 0, y + thickness + 16);
      sh.addColorStop(0, 'rgba(12,7,3,0.5)');
      sh.addColorStop(1, 'rgba(12,7,3,0)');
      ctx.fillStyle = sh;
      ctx.fillRect(x0, y + thickness, x1 - x0, 16);
    }

    function drawShelf() {
      var shift = layerShift(0.014);
      ctx.save();
      ctx.translate(shift, 0);

      /* 左边的架子 */
      var lx0 = fieldWidth * 0.03;
      var lx1 = fieldWidth * 0.31;
      var lTop = 86;
      drawShelfBoard(lx0, lx1, lTop, 8);
      var ljars = [
        { x: lx0 + 6, w: 17, h: 20, k: 'round' },
        { x: lx0 + 28, w: 13, h: 27, k: 'tall' },
        { x: lx0 + 46, w: 19, h: 16, k: 'squat' }
      ];
      for (var i = 0; i < ljars.length; i++) {
        var j = ljars[i];
        /* 罐子投影 */
        ctx.fillStyle = 'rgba(10,6,2,0.32)';
        ctx.beginPath();
        ctx.ellipse(j.x + j.w / 2 + 4, lTop + 2, j.w * 0.6, 3.4, 0, 0, Math.PI * 2);
        ctx.fill();
        jarPath(j.x, lTop, j.w, j.h, j.k);
        ctx.fillStyle = 'rgba(28,17,10,0.72)';
        ctx.fill();
        /* 左侧受光的边 */
        ctx.save();
        ctx.clip();
        ctx.fillStyle = 'rgba(255,214,158,0.16)';
        ctx.fillRect(j.x, lTop - j.h, Math.max(2, j.w * 0.2), j.h);
        ctx.fillStyle = 'rgba(255,226,180,0.1)';
        ctx.fillRect(j.x, lTop - j.h, j.w, 1.6);
        ctx.restore();
      }

      /* 右边的架子 */
      var rx0 = fieldWidth * 0.69;
      var rx1 = fieldWidth * 0.97;
      var rTop = 72;
      drawShelfBoard(rx0, rx1, rTop, 8);
      var rjars = [
        { x: rx0 + 7, w: 15, h: 18, k: 'squat' },
        { x: rx0 + 27, w: 12, h: 25, k: 'tall' },
        { x: rx0 + 45, w: 20, h: 15, k: 'round' }
      ];
      for (var k = 0; k < rjars.length; k++) {
        var rj = rjars[k];
        ctx.fillStyle = 'rgba(10,6,2,0.32)';
        ctx.beginPath();
        ctx.ellipse(rj.x + rj.w / 2 + 4, rTop + 2, rj.w * 0.6, 3.4, 0, 0, Math.PI * 2);
        ctx.fill();
        jarPath(rj.x, rTop, rj.w, rj.h, rj.k);
        ctx.fillStyle = 'rgba(24,14,8,0.76)';
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.fillStyle = 'rgba(255,214,158,0.14)';
        ctx.fillRect(rj.x, rTop - rj.h, Math.max(2, rj.w * 0.2), rj.h);
        ctx.fillStyle = 'rgba(255,226,180,0.09)';
        ctx.fillRect(rj.x, rTop - rj.h, rj.w, 1.6);
        ctx.restore();
      }
      ctx.restore();
    }

    /* ---------- 近景：木桌 ---------- */
    function drawTable(meta) {
      var wood = meta.wood || ['#7d5231', '#3a2113'];
      var shift = layerShift(0.024);
      ctx.save();
      ctx.translate(shift, 0);

      var grad = ctx.createLinearGradient(0, TABLE_Y, 0, VIEW_HEIGHT);
      grad.addColorStop(0, lerpColor(wood[0], '#d9a05f', 0.45));
      grad.addColorStop(0.12, wood[0]);
      grad.addColorStop(0.5, lerpColor(wood[0], wood[1], 0.55));
      grad.addColorStop(0.82, lerpColor(wood[0], wood[1], 0.9));
      grad.addColorStop(1, lerpColor(wood[1], '#150b04', 0.55));
      ctx.fillStyle = grad;
      ctx.fillRect(-BG_PAD - shift, TABLE_Y, fieldWidth + BG_PAD * 2, VIEW_HEIGHT - TABLE_Y);

      /* 木板缝：木板横向铺，几道缝把桌面分开 */
      var seams = [56, 118, 182, 244];
      for (var s = 0; s < seams.length; s++) {
        var sy = TABLE_Y + seams[s];
        if (sy > VIEW_HEIGHT - 6) continue;
        ctx.fillStyle = 'rgba(28,15,6,0.45)';
        ctx.fillRect(-BG_PAD - shift, sy, fieldWidth + BG_PAD * 2, 1.8);
        ctx.fillStyle = 'rgba(255,214,158,0.12)';
        ctx.fillRect(-BG_PAD - shift, sy + 1.8, fieldWidth + BG_PAD * 2, 1);
      }

      /* 木纹：走向沿桌面横向，一深一浅两组 */
      var i;
      for (i = 0; i < 26; i++) {
        var gy = TABLE_Y + 4 + i * 9.6;
        if (gy > VIEW_HEIGHT) break;
        var dark = i % 2 === 0;
        ctx.strokeStyle = dark ? 'rgba(38,20,8,0.30)' : 'rgba(255,214,158,0.09)';
        ctx.lineWidth = dark ? 1.5 : 1.1;
        ctx.beginPath();
        ctx.moveTo(-BG_PAD - shift, gy);
        for (var x = -BG_PAD; x <= fieldWidth + BG_PAD + 24; x += 26) {
          var wob = Math.sin(x * 0.016 + gy * 0.09) * 2.2 + Math.sin(x * 0.043 + gy * 0.021) * 1.1;
          ctx.lineTo(x - shift, gy + wob);
        }
        ctx.stroke();
      }

      /* 木节 */
      var knots = [[0.22, 0.62, 13, 6], [0.78, 0.34, 9, 4]];
      for (i = 0; i < knots.length; i++) {
        var kx = fieldWidth * knots[i][0];
        var ky = TABLE_Y + (VIEW_HEIGHT - TABLE_Y) * knots[i][1];
        ctx.strokeStyle = 'rgba(44,22,8,0.34)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(kx, ky, knots[i][2], knots[i][3], 0.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(kx, ky, knots[i][2] * 0.5, knots[i][3] * 0.5, 0.2, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      /* 台沿：一条被窗光打亮的硬边 */
      ctx.fillStyle = 'rgba(255,224,176,0.5)';
      ctx.fillRect(-BG_PAD, TABLE_Y - 2.4, fieldWidth + BG_PAD * 2, 2.6);
      ctx.fillStyle = 'rgba(20,12,6,0.42)';
      ctx.fillRect(-BG_PAD, TABLE_Y, fieldWidth + BG_PAD * 2, 5);

      /* 光柱落在桌面上 */
      drawShaft(TABLE_Y, VIEW_HEIGHT + 10, 0.1, 0.4, 0.26, 0.56, 0.34);
      /* 桌面上的光斑 */
      glowAt(fieldWidth * 0.41, VIEW_HEIGHT - 24, fieldWidth * 0.34, '255,214,150', 0.2);
      glowAt(fieldWidth * 0.41, TABLE_Y + 26, fieldWidth * 0.2, '255,224,168', 0.16);
    }

    /* ---------- 桌面倒影 ---------- */
    function drawReflection(g) {
      ctx.save();
      /* 倒影只落在瓶底以下的那段桌面上 */
      ctx.beginPath();
      ctx.rect(g.left - 12, g.bottom, g.right - g.left + 24, VIEW_HEIGHT - g.bottom);
      ctx.clip();
      ctx.globalAlpha = 0.13;
      ctx.translate(0, g.bottom);
      ctx.scale(1, -0.22);
      bottlePath(g);
      var grad = ctx.createLinearGradient(g.left, 0, g.right, 0);
      grad.addColorStop(0, 'rgba(255,238,210,0.5)');
      grad.addColorStop(0.4, 'rgba(180,190,190,0.25)');
      grad.addColorStop(1, 'rgba(255,238,210,0.4)');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    }

    /* ---------- 接触阴影 ---------- */
    function drawContactShadow(g) {
      var grad = ctx.createRadialGradient(g.cx, g.bottom + 4, 4, g.cx, g.bottom + 4, g.inner * 1.15);
      grad.addColorStop(0, 'rgba(24,12,4,0.5)');
      grad.addColorStop(0.55, 'rgba(24,12,4,0.2)');
      grad.addColorStop(1, 'rgba(24,12,4,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(g.cx, g.bottom + 4, g.inner * 1.15, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    /* ---------- 瓶身背壁 ---------- */
    /* 原版 drawBottle 的 clip 内壁：随 tilt 一起旋转，所以画进沙层而不是背景层 */
    function drawBottleBack(target, g, backlit) {
      target.save();
      bottlePath(g, target);
      var inner = target.createLinearGradient(0, g.top - 10, 0, g.bottom);
      if (backlit) {
        inner.addColorStop(0, 'rgba(96,84,52,0.30)');
        inner.addColorStop(0.4, 'rgba(120,102,64,0.16)');
        inner.addColorStop(1, 'rgba(90,76,46,0.34)');
      } else {
        inner.addColorStop(0, 'rgba(18,12,8,0.72)');
        inner.addColorStop(0.4, 'rgba(38,27,18,0.5)');
        inner.addColorStop(1, 'rgba(22,14,8,0.78)');
      }
      target.fillStyle = inner;
      target.fill();
      /* 瓶底玻璃厚度 */
      var base = target.createLinearGradient(0, g.bottom - 16, 0, g.bottom);
      base.addColorStop(0, 'rgba(120,150,150,0)');
      base.addColorStop(1, backlit ? 'rgba(160,190,190,0.3)' : 'rgba(150,180,180,0.16)');
      target.fillStyle = base;
      target.fillRect(g.left, g.bottom - 16, g.right - g.left, 16);
      target.restore();
    }

    /* ---------- 「举向光亮」的背光背景 ---------- */
    function drawBacklitBg(g) {
      var grad = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
      grad.addColorStop(0, '#F5ECCF');
      grad.addColorStop(0.5, '#E7D6AC');
      grad.addColorStop(1, '#B7B09C');
      ctx.fillStyle = grad;
      ctx.fillRect(-BG_PAD, 0, fieldWidth + BG_PAD * 2, VIEW_HEIGHT);
      /* 瓶子正后方一团亮光：玻璃和沙都被照透 */
      glowAt(g.cx, g.bottom - 100, g.inner * 2.6, '255,248,224', 0.55);
      glowAt(g.cx, g.top + 30, fieldWidth * 0.3, '255,240,200', 0.3);
      /* 桌面只剩一条淡淡的影子 */
      ctx.fillStyle = 'rgba(120,104,84,0.35)';
      ctx.fillRect(-BG_PAD, VIEW_HEIGHT - 14, fieldWidth + BG_PAD * 2, 14);
    }

    /*
     * 粒子直绘：fillRect。微基准（同机 headless）：2100 次 5px drawImage ≈ 21.8ms，
     * 2100 次 5px fillRect ≈ 3.0ms——逐粒场景必须走 fillRect。
     * 视觉与原版一致：原版 drawBottle 对每粒也只是平涂单色（无渐变着色）；
     * 深度感来自 ② 的整体纵向渐变与 ③ 的堆面亮边。
     */

    /* 粒子矩形取整：软件光栅下整数矩形免抗采样，最快 */
    function grainRect(g, devK) {
      var rd = Math.max(1, Math.round(g.r * devK));
      return {
        x: Math.round(g.x * devK - rd),
        y: Math.round(g.y * devK - rd),
        s: rd * 2
      };
    }

    /* 瓶形裁剪路径（Path2D，视图坐标）：几何不变就不重建 */
    var clipPath = null;
    var clipPathKey = '';
    function bottleClipPath(g) {
      var key = g.W + 'x' + g.H + ':' + engine.shape.id;
      if (clipPath && clipPathKey === key) return clipPath;
      var p = new root.Path2D();
      var steps = 44;
      var leftPts = [];
      var rightPts = [];
      for (var i = 0; i <= steps; i++) {
        var y = g.top + ((g.bottom - g.top) * i) / steps;
        var pair = engine.bottleX(y);
        leftPts.push({ x: pair[0], y: y });
        rightPts.push({ x: pair[1], y: y });
      }
      p.moveTo(leftPts[0].x, g.top);
      for (var l = 1; l < leftPts.length; l++) p.lineTo(leftPts[l].x, leftPts[l].y);
      for (var r = rightPts.length - 1; r >= 0; r--) p.lineTo(rightPts[r].x, rightPts[r].y);
      p.closePath();
      clipPath = p;
      clipPathKey = key;
      return p;
    }

    /*
     * 沙层重绘：逐粒 sprite，支持增量。
     * box = 引擎 dirtyBox（本帧位移并集包围盒，引擎坐标）：
     *   null → 全量重绘（resize / 大范围翻滚）；
     *   有值 → 只清空并重画盒内区域：与盒相交的粒子 + 同一渐变的深度着色与顶缘亮边，
     *   盒面积超过瓶身内腔一半时退回全量。
     * 沙是逐粒物理，失效条件完全由引擎的逐粒位置对比给出——不回退列模型。
     */
    function paintSand(box) {
      if (!engine) {
        sandCtx.setTransform(1, 0, 0, 1, 0, 0);
        sandCtx.clearRect(0, 0, sandLayer.width, sandLayer.height);
        return;
      }
      var devK = dpr * scale;
      var grains = engine.grains;
      var geo = bottleGeom();
      var i;
      var full = !box;

      if (!full) {
        var area = (box[2] - box[0]) * (box[3] - box[1]);
        var innerArea = (geo.right - geo.left) * (geo.bottom - geo.top);
        if (area > innerArea * 0.55) full = true;
      }

      sandCtx.setTransform(1, 0, 0, 1, 0, 0);
      var bx;
      var by;
      var bw;
      var bh;
      if (full) {
        sandCtx.clearRect(0, 0, sandLayer.width, sandLayer.height);
        bx = 0;
        by = 0;
        bw = sandLayer.width;
        bh = sandLayer.height;
      } else {
        bx = Math.max(0, Math.floor((box[0] - 2) * devK));
        by = Math.max(0, Math.floor((box[1] - 2) * devK));
        bw = Math.min(sandLayer.width - bx, Math.ceil((box[2] - box[0] + 4) * devK));
        bh = Math.min(sandLayer.height - by, Math.ceil((box[3] - box[1] + 4) * devK));
        if (bw <= 0 || bh <= 0) return;
        sandCtx.clearRect(bx, by, bw, bh);
      }

      /* ⓪ 瓶身背壁：与沙同层（沙层随瓶身旋转时背壁必须一起转，原版 drawBottle 顺序）。
         增量重绘只允许重画盒内区域，否则会擦掉盒外的沙。 */
      if (full) {
        drawBottleBack(sandCtx, geo, mode === 'result');
      } else {
        sandCtx.save();
        sandCtx.beginPath();
        sandCtx.rect(bx, by, bw, bh);
        sandCtx.clip();
        drawBottleBack(sandCtx, geo, mode === 'result');
        sandCtx.restore();
      }

      /* ① 粒子：设备坐标 1:1 blit（sprite 按粒缓存，半径桶不随帧变）。
         全量路径不再包全画布 clip——层本身就有边界，裁剪只会拖慢 Skia。 */
      var clipBox = full ? null : { x: bx, y: by, w: bw, h: bh };
      if (clipBox) {
        sandCtx.save();
        sandCtx.beginPath();
        sandCtx.rect(bx, by, bw, bh);
        sandCtx.clip();
      }
      if (full) {
        for (i = 0; i < grains.length; i++) {
          var g = grains[i];
          var rectA = grainRect(g, devK);
          sandCtx.fillStyle = g.c;
          sandCtx.fillRect(rectA.x, rectA.y, rectA.s, rectA.s);
        }
      } else {
        var ex0 = box[0] - 3;
        var ex1 = box[2] + 3;
        var ey0 = box[1] - 3;
        var ey1 = box[3] + 3;
        for (i = 0; i < grains.length; i++) {
          var q = grains[i];
          if (q.x + q.r < ex0 || q.x - q.r > ex1 || q.y + q.r < ey0 || q.y - q.r > ey1) continue;
          var rectB = grainRect(q, devK);
          sandCtx.fillStyle = q.c;
          sandCtx.fillRect(rectB.x, rectB.y, rectB.s, rectB.s);
        }
      }

      /* ② 深度着色：同一纵向渐变按绝对坐标取色，增量盒内像素与全量一致。
         bottlePath 用闭包里的 ctx 画路径，这里必须切到 sandCtx。 */
      var pileTop = geo.bottom;
      for (i = 0; i < grains.length; i++) {
        if (grains[i].y < pileTop) pileTop = grains[i].y;
      }
      sandCtx.setTransform(devK, 0, 0, devK, 0, 0);
      if (pileTop < geo.bottom) {
        sandCtx.save();
        sandCtx.clip(bottleClipPath(geo));
        if (!full) {
          sandCtx.beginPath();
          sandCtx.rect(box[0] - 2, box[1] - 2, box[2] - box[0] + 4, box[3] - box[1] + 4);
          sandCtx.clip();
        }
        var tint = sandCtx.createLinearGradient(0, pileTop - 6, 0, geo.bottom);
        tint.addColorStop(0, 'rgba(255,228,162,0.16)');
        tint.addColorStop(0.4, 'rgba(120,66,24,0.05)');
        tint.addColorStop(1, 'rgba(40,18,6,0.30)');
        sandCtx.fillStyle = tint;
        if (full) {
          sandCtx.fillRect(geo.left - 4, pileTop - 8, geo.right - geo.left + 8, geo.bottom - pileTop + 10);
        } else {
          sandCtx.fillRect(box[0] - 2, box[1] - 2, box[2] - box[0] + 4, box[3] - box[1] + 4);
        }
        sandCtx.restore();
      }

      /* ③ 堆面顶缘亮边：按列取最高点，[1,2,1] 平滑两遍后描线（裁剪在盒内） */
      if (grains.length) {
        var e = engine.grainR();
        var cell = 1.7 * e;
        var cols = Math.max(1, Math.ceil(engine.W / cell));
        var tops = [];
        for (i = 0; i < cols; i++) tops.push(engine.bottomY());
        for (i = 0; i < grains.length; i++) {
          var gi = grains[i];
          var idx = clamp(Math.floor(gi.x / cell), 0, cols - 1);
          if (gi.y < tops[idx]) tops[idx] = gi.y;
        }
        for (var pass = 0; pass < 2; pass++) {
          var prev = tops.slice();
          for (i = 0; i < cols; i++) {
            tops[i] = prev[i] * 0.5 +
              (prev[clampIndex(i - 1, cols)] + prev[clampIndex(i + 1, cols)]) * 0.25;
          }
        }
        sandCtx.save();
        if (!full) {
          sandCtx.beginPath();
          sandCtx.rect(box[0] - 2, box[1] - 2, box[2] - box[0] + 4, box[3] - box[1] + 4);
          sandCtx.clip();
        }
        sandCtx.lineJoin = 'round';
        sandCtx.lineCap = 'round';
        /* 只描有沙的列：无沙列保持 bottomY 初值，描出来会在瓶外桌面上
           出现一条全宽横线（沙层随瓶身旋转时会跟着转，非常扎眼） */
        var noSand = engine.bottomY() - 0.01;
        sandCtx.strokeStyle = 'rgba(255,210,142,0.22)';
        sandCtx.lineWidth = 5;
        sandCtx.beginPath();
        var lineStarted = false;
        for (i = 0; i < cols; i++) {
          if (tops[i] > noSand) continue;
          var px = (i + 0.5) * cell;
          if (!lineStarted) { sandCtx.moveTo(px, tops[i] - 0.6); lineStarted = true; }
          else sandCtx.lineTo(px, tops[i] - 0.6);
        }
        sandCtx.stroke();
        var edge = sandCtx.createLinearGradient(0, 0, engine.W, 0);
        edge.addColorStop(0, 'rgba(255,250,228,0.8)');
        edge.addColorStop(0.5, 'rgba(255,240,202,0.55)');
        edge.addColorStop(1, 'rgba(255,222,164,0.3)');
        sandCtx.strokeStyle = edge;
        sandCtx.lineWidth = 1.6;
        sandCtx.beginPath();
        lineStarted = false;
        for (i = 0; i < cols; i++) {
          if (tops[i] > noSand) continue;
          var qx = (i + 0.5) * cell;
          if (!lineStarted) { sandCtx.moveTo(qx, tops[i] - 0.6); lineStarted = true; }
          else sandCtx.lineTo(qx, tops[i] - 0.6);
        }
        sandCtx.stroke();
        sandCtx.restore();
      }
      if (clipBox) sandCtx.restore();
    }

    /* ---------- 玻璃前壁 ---------- */
    function drawBottleFront(g, backlit) {
      ctx.save();
      bottlePath(g);
      var glass = ctx.createLinearGradient(g.left, 0, g.right, 0);
      if (backlit) {
        glass.addColorStop(0, 'rgba(255,252,240,0.5)');
        glass.addColorStop(0.08, 'rgba(255,252,240,0.16)');
        glass.addColorStop(0.42, 'rgba(230,240,238,0.1)');
        glass.addColorStop(0.72, 'rgba(255,248,224,0.12)');
        glass.addColorStop(0.92, 'rgba(255,250,236,0.3)');
        glass.addColorStop(1, 'rgba(255,250,238,0.55)');
      } else {
        glass.addColorStop(0, 'rgba(255,248,232,0.46)');
        glass.addColorStop(0.08, 'rgba(255,248,232,0.12)');
        glass.addColorStop(0.42, 'rgba(196,222,222,0.10)');
        glass.addColorStop(0.72, 'rgba(255,240,214,0.10)');
        glass.addColorStop(0.92, 'rgba(255,248,232,0.26)');
        glass.addColorStop(1, 'rgba(255,246,226,0.50)');
      }
      ctx.fillStyle = glass;
      ctx.fill();
      ctx.restore();

      /* 内壁阴影：贴着左右两侧压暗 */
      ctx.save();
      bottlePath(g);
      ctx.clip();
      var inner = ctx.createLinearGradient(g.left, 0, g.right, 0);
      inner.addColorStop(0, backlit ? 'rgba(90,70,40,0.2)' : 'rgba(18,10,4,0.42)');
      inner.addColorStop(0.16, 'rgba(18,10,4,0)');
      inner.addColorStop(0.82, 'rgba(18,10,4,0)');
      inner.addColorStop(1, backlit ? 'rgba(90,70,40,0.2)' : 'rgba(18,10,4,0.40)');
      ctx.fillStyle = inner;
      ctx.fillRect(g.left, g.neckTop - 10, g.right - g.left, g.bottom - g.neckTop + 20);
      /* 瓶身内侧的暖色反光 */
      var warm = ctx.createLinearGradient(0, g.top, 0, g.bottom);
      warm.addColorStop(0, 'rgba(255,206,140,0.10)');
      warm.addColorStop(0.5, 'rgba(255,206,140,0.02)');
      warm.addColorStop(1, 'rgba(255,206,140,0)');
      ctx.fillStyle = warm;
      ctx.fillRect(g.left, g.neckTop - 10, g.right - g.left, g.bottom - g.neckTop + 20);
      ctx.restore();

      /* 左上高光条 */
      ctx.fillStyle = backlit ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.moveTo(g.cx - g.inner * 0.70, g.top + 18);
      ctx.lineTo(g.cx - g.inner * 0.57, g.top + 18);
      ctx.lineTo(g.cx - g.inner * 0.63, g.bottom - 26);
      ctx.lineTo(g.cx - g.inner * 0.78, g.bottom - 26);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.26)';
      ctx.fillRect(g.cx - g.inner * 0.63, g.top + 26, 3, g.bottom - g.top - 60);

      /* 瓶身厚度：外轮廓的亮边 */
      ctx.save();
      bottlePath(g);
      ctx.strokeStyle = backlit ? 'rgba(255,250,232,0.8)' : 'rgba(255,244,220,0.62)';
      ctx.lineWidth = 2.6;
      ctx.stroke();
      ctx.restore();

      /* 瓶口 */
      ctx.fillStyle = 'rgba(255,248,232,0.38)';
      ctx.beginPath();
      ctx.ellipse(g.cx, g.neckTop, g.neckHalf + WALL * 0.5, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,242,216,0.7)';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      /* 瓶底的一道亮弧，让瓶子坐得住 */
      ctx.save();
      ctx.strokeStyle = backlit ? 'rgba(200,230,230,0.4)' : 'rgba(210,235,235,0.34)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(g.cx, g.bottom - 2, g.inner - 3, 8, 0, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }

    /* ---------- 推杆（木柄小棒）：拖动时跟手 ---------- */
    function drawRod() {
      if (!engine || mode !== 'craft') return;
      if (!pointer.active || !pointer.down) return;
      var x = pointer.x;
      var y = pointer.y;
      /* 原版杆的锚线：从 (x-14, y-26) 到 (x+8, y+22)，视觉层画成木柄小棒 */
      var dx = 8 - -14;
      var dy = 22 - -26;
      var len = Math.sqrt(dx * dx + dy * dy);
      var ang = Math.atan2(dy, dx);
      ctx.save();
      ctx.translate(x - 14, y - 26);
      ctx.rotate(ang);
      /* 投影 */
      ctx.fillStyle = 'rgba(20,10,4,0.28)';
      roundRect(ctx, 3, -4.5, len, 9, 4.5);
      ctx.fill();
      /* 杆身 */
      var body = ctx.createLinearGradient(0, -4.5, 0, 4.5);
      body.addColorStop(0, '#e2b57e');
      body.addColorStop(0.5, '#c58f52');
      body.addColorStop(1, '#8a5a2c');
      ctx.fillStyle = body;
      roundRect(ctx, 0, -4.5, len, 9, 4.5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(96,60,26,0.5)';
      ctx.lineWidth = 1.1;
      ctx.stroke();
      /* 木纹 */
      ctx.strokeStyle = 'rgba(140,94,48,0.45)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(len * 0.12, -1.6);
      ctx.lineTo(len * 0.82, -1.1);
      ctx.moveTo(len * 0.2, 1.8);
      ctx.lineTo(len * 0.75, 1.4);
      ctx.stroke();
      /* 杆头 */
      ctx.fillStyle = '#4C3926';
      ctx.beginPath();
      ctx.arc(len - 2, 0, 4.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,232,190,0.35)';
      ctx.beginPath();
      ctx.arc(len - 3.4, -1.4, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /* ---------- 封瓶演出 ---------- */
    function sealBurst(geo, colors) {
      sealActive = true;
      sealT = 0;
      rings.push({ x: geo.cx, y: geo.bottom - 40, r: 10, life: 0, max: 0.9 });
      var palette = colors && colors.length ? colors : ['#f5d76e'];
      for (var i = 0; i < 34; i++) {
        var ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
        var speed = 90 + Math.random() * 150;
        ribbons.push({
          x: geo.cx + (Math.random() - 0.5) * 30,
          y: geo.neckTop + 8,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed,
          w: 2 + Math.random() * 3,
          h: 6 + Math.random() * 7,
          spin: (Math.random() - 0.5) * 9,
          angle: Math.random() * Math.PI,
          life: 0,
          max: 1.3 + Math.random() * 0.7,
          color: palette[Math.floor(Math.random() * palette.length)]
        });
      }
      if (ribbons.length > 70) ribbons.splice(0, ribbons.length - 70);
      card = { x: geo.cx, y: geo.bottom - 120, life: 0, max: 1.1 };
    }

    function clearEffects() {
      ribbons.length = 0;
      rings.length = 0;
      card = null;
      sealT = 0;
      sealActive = false;
    }

    function updateEffects(dt) {
      var i;
      for (i = ribbons.length - 1; i >= 0; i--) {
        var r = ribbons[i];
        r.life += dt;
        if (r.life >= r.max) {
          ribbons.splice(i, 1);
          continue;
        }
        r.vy += 340 * dt;
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        r.angle += r.spin * dt;
      }
      for (i = rings.length - 1; i >= 0; i--) {
        var ring = rings[i];
        ring.life += dt;
        if (ring.life >= ring.max) {
          rings.splice(i, 1);
          continue;
        }
        ring.r = 10 + ring.life * 150;
      }
      if (card) {
        card.life += dt;
        if (card.life >= card.max) card = null;
      }
      if (sealActive) {
        if (sealT < 1) sealT = Math.min(1, sealT + dt * 1.6);
      }
    }

    function drawSealFx(geo, view) {
      if (!sealActive || sealT <= 0) return;
      var pulse = Math.sin(sealT * Math.PI);
      ctx.save();
      /* 瓶身发光 */
      var glow = ctx.createRadialGradient(geo.cx, geo.bottom - 90, 10, geo.cx, geo.bottom - 90, geo.inner * 2.2);
      glow.addColorStop(0, 'rgba(255,236,180,' + (0.42 * pulse).toFixed(3) + ')');
      glow.addColorStop(0.5, 'rgba(255,206,120,' + (0.18 * pulse).toFixed(3) + ')');
      glow.addColorStop(1, 'rgba(255,206,120,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, fieldWidth, VIEW_HEIGHT);
      ctx.restore();

      /* 冲击环 */
      for (var i = 0; i < rings.length; i++) {
        var ring = rings[i];
        var t = ring.life / ring.max;
        ctx.save();
        ctx.globalAlpha = (1 - t) * 0.7;
        ctx.strokeStyle = 'rgba(255,232,170,0.9)';
        ctx.lineWidth = 3 * (1 - t) + 0.6;
        ctx.beginPath();
        ctx.ellipse(ring.x, ring.y, ring.r, ring.r * 0.42, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      /* 彩带 */
      for (var j = 0; j < ribbons.length; j++) {
        var rb = ribbons[j];
        var life = rb.life / rb.max;
        ctx.save();
        ctx.globalAlpha = life > 0.7 ? (1 - life) / 0.3 : 1;
        ctx.translate(rb.x, rb.y);
        ctx.rotate(rb.angle);
        ctx.fillStyle = rb.color;
        ctx.fillRect(-rb.w / 2, -rb.h / 2, rb.w, rb.h);
        ctx.restore();
      }

      /* 收藏卡飞入 */
      if (card) {
        var ct = card.life / card.max;
        var ease = 1 - Math.pow(1 - ct, 3);
        var cxp = lerp(card.x, fieldWidth - 62, ease);
        var cyp = lerp(card.y, 54, ease);
        var cardScale = lerp(0.4, 1, ease);
        ctx.save();
        ctx.globalAlpha = ct > 0.85 ? (1 - ct) / 0.15 : 1;
        ctx.translate(cxp, cyp);
        ctx.rotate(lerp(0.5, 0, ease));
        ctx.scale(cardScale, cardScale);
        ctx.fillStyle = 'rgba(20,12,6,0.35)';
        roundRect(ctx, -26, -30, 52, 62, 9);
        ctx.fill();
        var cardGrad = ctx.createLinearGradient(-26, -30, 26, 32);
        cardGrad.addColorStop(0, '#fdf1dc');
        cardGrad.addColorStop(1, '#e2c193');
        ctx.fillStyle = cardGrad;
        roundRect(ctx, -28, -32, 52, 62, 9);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        /* 卡上的小瓶 */
        ctx.fillStyle = 'rgba(120,86,58,0.35)';
        ctx.beginPath();
        ctx.moveTo(-8, -20);
        ctx.lineTo(8, -20);
        ctx.lineTo(8, -8);
        ctx.quadraticCurveTo(15, -2, 15, 12);
        ctx.lineTo(-15, 12);
        ctx.quadraticCurveTo(-15, -2, -8, -8);
        ctx.closePath();
        ctx.fill();
        var pal = (view && view.meta && view.meta.colors) || [];
        ctx.fillStyle = pal.length ? pal[0].hex : '#e8735a';
        ctx.beginPath();
        ctx.moveTo(-13, 12);
        ctx.lineTo(13, 12);
        ctx.lineTo(13, 4);
        ctx.quadraticCurveTo(0, -2, -13, 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = pal.length > 1 ? pal[1].hex : '#f2a154';
        ctx.beginPath();
        ctx.moveTo(-13, 4);
        ctx.quadraticCurveTo(0, -2, 13, 4);
        ctx.lineTo(13, -2);
        ctx.quadraticCurveTo(0, -8, -13, -2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    /* ---------- 倒沙的扬尘（引擎 particles，动态层直接画） ---------- */
    function drawEngineParticles() {
      if (!engine || !engine.particles.length) return;
      var pr = 0.8 * engine.grainR();
      for (var i = 0; i < engine.particles.length; i++) {
        var p = engine.particles[i];
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life)) * 0.8;
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, pr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    /* ---------- 扫光带（原版 drawBottle 的 glare：每帧在瓶内 clip 里画一道竖向柔光） ---------- */
    function drawGlareBand(g) {
      if (!engine || !(engine.W > 0)) return;
      var w = engine.W;
      var h = engine.H;
      var t = (glare % 1) * w * 1.6 - 0.3 * w;
      var grad = ctx.createLinearGradient(t - 0.15 * w, 0, t + 0.15 * w, h);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.22)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save();
      ctx.clip(bottleClipPath(g));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    /* ---------- 暗角 ---------- */
    function drawVignette() {
      var grad = ctx.createRadialGradient(
        fieldWidth / 2, VIEW_HEIGHT * 0.44, VIEW_HEIGHT * 0.24,
        fieldWidth / 2, VIEW_HEIGHT * 0.44, VIEW_HEIGHT * 1.0
      );
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.62, 'rgba(14,7,3,0.20)');
      grad.addColorStop(1, 'rgba(10,5,2,0.72)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, fieldWidth, VIEW_HEIGHT);
      /* 顶部与底部再压一道，收边 */
      var top = ctx.createLinearGradient(0, 0, 0, 60);
      top.addColorStop(0, 'rgba(8,4,2,0.5)');
      top.addColorStop(1, 'rgba(8,4,2,0)');
      ctx.fillStyle = top;
      ctx.fillRect(0, 0, fieldWidth, 60);
    }

    /* ---------- 分层烘焙 ---------- */
    function paintBg(meta, view, g) {
      useLayer(bgCtx, function () {
        bgCtx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
        bgCtx.clearRect(-BG_PAD - 2, -2, fieldWidth + BG_PAD * 2 + 4, VIEW_HEIGHT + 4);
        /* 场景往右挪 BG_PAD，给运行期整体视差位移留余量 */
        bgCtx.translate(BG_PAD, 0);
        var backlit = view.mode === 'result';
        if (backlit) {
          drawBacklitBg(g);
        } else {
          drawRoom(meta);
          drawWallShaft();
          drawLamps();
          drawShelf();
          drawTable(meta);
          drawReflection(g);
        }
        drawContactShadow(g);
      });
    }

    function paintGlass(meta, view, g) {
      useLayer(glassCtx, function () {
        glassCtx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
        glassCtx.clearRect(0, 0, fieldWidth, VIEW_HEIGHT);
        drawBottleFront(g, view.mode === 'result');
        drawVignette();
      });
    }

    function ensureLayers(meta, view, g) {
      if (bgDirty || bgMode !== view.mode) {
        paintBg(meta, view, g);
        bgDirty = false;
        bgMode = view.mode;
      }
      if (glassDirty) {
        paintGlass(meta, view, g);
        glassDirty = false;
      }
    }

    /* ---------- 主绘制 ---------- */
    function render(time, view) {
      if (!view || !view.engine) return;
      var meta = view.meta || {};
      if (view.engine !== engine || (view.mode && view.mode !== mode)) {
        setEngine(view.engine, view.mode || 'craft');
      }
      var started = (root.performance && root.performance.now ? root.performance.now() : Date.now());
      /* 原版扫光相位按帧推进：craft .0025/帧（u.current），result .002/帧（s.current） */
      glare += view.mode === 'result' ? 0.002 : 0.0025;

      var g = bottleGeom();
      if (!g) return;

      ensureLayers(meta, view, g);

      /* 沙层：引擎粒子集合或位置有变（dirty）才重画；
         dirtyBox 给出本帧位移包围盒，能增量就增量，否则全量 */
      var sandRepainted = false;
      if (sandDirty || view.engine.dirty) {
        paintSand(sandDirty ? null : view.engine.dirtyBox);
        sandDirty = false;
        view.engine.dirty = false;
        view.engine.dirtyBox = null;
        sandRepainted = true;
      }

      /* ---------- 合成：静止帧 = 3 次 drawImage ---------- */
      var draws = 0;
      /* 原版 drawBottle 第一句：translate(W/2,H/2) rotate(.05*tilt) translate(-W/2,-H/2)
         ——拖动时整个瓶身（背壁/沙/玻璃）绕画布中心旋转，松手即回正。
         背景房间不转（我方保留场景），瓶体两层随 tilt 旋转。 */
      var devS = dpr * scale;
      var rot = view.engine.tilt ? 0.05 * view.engine.tilt : 0;
      var tilted = Math.abs(rot) > 0.0005;
      function applyRotDev() {
        if (!tilted) return;
        ctx.translate((fieldWidth / 2) * devS, (VIEW_HEIGHT / 2) * devS);
        ctx.rotate(rot);
        ctx.translate((-fieldWidth / 2) * devS, (-VIEW_HEIGHT / 2) * devS);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      var shift = layerShift(0.012);
      ctx.drawImage(bgLayer, Math.round((-BG_PAD + shift) * devS), 0);
      draws++;

      applyRotDev();
      ctx.drawImage(sandLayer, 0, 0);
      draws++;

      var fxLive = ribbons.length > 0 || rings.length > 0 || card != null || sealActive;
      var engineFx = view.engine.particles.length > 0;
      var glareLive = view.mode === 'craft' || view.mode === 'result';
      if (engineFx || glareLive) {
        /* 粒子与扫光带都在瓶内、随瓶身转（原版画在 drawBottle 的 clip 内） */
        ctx.setTransform(devS, 0, 0, devS, 0, 0);
        if (tilted) {
          ctx.translate(fieldWidth / 2, VIEW_HEIGHT / 2);
          ctx.rotate(rot);
          ctx.translate(-fieldWidth / 2, -VIEW_HEIGHT / 2);
        }
        if (engineFx) drawEngineParticles();
        if (glareLive) drawGlareBand(g);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        applyRotDev();
      }

      ctx.drawImage(glassLayer, 0, 0);
      draws++;
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      /* 推杆：原版在 drawBottle 之后、不随瓶身旋转的坐标系里画（盖在玻璃上） */
      var rodLive = view.tool === 'rod' && pointer.active && pointer.down && view.mode === 'craft';
      if (rodLive) {
        ctx.setTransform(devS, 0, 0, devS, 0, 0);
        drawRod();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }

      if (fxLive) {
        ctx.setTransform(devS, 0, 0, devS, 0, 0);
        drawSealFx(g, view);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }

      stats.frames++;
      stats.lastFrameDraws = draws;
      stats.sandRepainted = sandRepainted;
      stats.lastFrameMs = (root.performance && root.performance.now ? root.performance.now() : Date.now()) - started;
    }

    return {
      resize: resize,
      ensureSize: resize,
      getFieldWidth: function () { return fieldWidth; },
      getScale: function () { return scale; },
      getEngine: function () { return engine; },
      setEngine: setEngine,
      sealBurst: sealBurst,
      clearEffects: clearEffects,
      updateEffects: updateEffects,
      getStats: function () {
        return {
          frames: stats.frames,
          lastFrameDraws: stats.lastFrameDraws,
          lastFrameMs: Math.round(stats.lastFrameMs * 100) / 100,
          sandRepainted: !!stats.sandRepainted
        };
      },
      setPointer: function (x, y, active, down) {
        pointer.x = x;
        pointer.y = y;
        pointer.active = !!active;
        pointer.down = !!down;
      },
      setReducedMotion: function (v) { reduced = !!v; },
      isReducedMotion: function () { return reduced; },
      render: render
    };
  }

  root.SandRender = {
    createRenderer: createRenderer,
    VIEW_HEIGHT: VIEW_HEIGHT,
    ENGINE_H: VIEW_HEIGHT
  };
})(typeof window !== 'undefined' ? window : global);
