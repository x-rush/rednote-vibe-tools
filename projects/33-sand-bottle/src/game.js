/*
 * 彩沙瓶 · 原版沙引擎（eazo 原版 SandEngine 的 1:1 复刻）
 *
 * 本文件是「严格 1:1 复刻」的施工第一依据：
 * 每一个常量、每一条公式都来自原版源码（projects/33-sand-bottle/reference/eazo-spec.txt
 * 与 %TEMP%\eazo-original\33\12gurs1rhkq1r.js 的 chunk 52499 / 33131）。
 * 原版的缺陷也照抄：例如 2600 粒沙根本填不满一只原版尺寸的瓶子，
 * fillLevel 最高只能到 ~0.3，isFull 实际上只由粒数上限触发——这都是原版行为，不得「修正」。
 *
 * 原版没有 undo、没有关卡、没有目标轮廓、没有评分：
 * 只有「选瓶 → 拖动倒沙与倾斜 → 小棒推沙 → 举向光亮」。
 *
 * Chrome 61 基线（ES2017）：不用可选链、空值合并、class 字段、roundRect。
 */
(function (root) {
  'use strict';

  /* 原版 helper：function t(e,t,r){return e<t?t:e>r?r:e} */
  function clamp(e, lo, hi) {
    return e < lo ? lo : (e > hi ? hi : e);
  }

  /*
   * 原版 BOTTLE_SHAPES（chunk 33131）——五种瓶型，参数一字不改。
   * bodyHalf  : 瓶身半宽（× 引擎宽度 W）
   * neckHalf  : 瓶口半宽（× W）
   * neckSpan  : 瓶颈占画布高度的比例
   * shoulderSpan: 肩部过渡占画布高度的比例
   * roundBottom: 瓶底收圆的比例
   */
  var BOTTLE_SHAPES = [
    { id: 'round', name: 'Round Shoulder', bodyHalf: 0.33, neckHalf: 0.12, neckSpan: 0.16, shoulderSpan: 0.12, roundBottom: 0.5 },
    { id: 'cylinder', name: 'Tall Cylinder', bodyHalf: 0.28, neckHalf: 0.14, neckSpan: 0.12, shoulderSpan: 0.08, roundBottom: 0.15 },
    { id: 'flask', name: 'Flask', bodyHalf: 0.36, neckHalf: 0.1, neckSpan: 0.2, shoulderSpan: 0.16, roundBottom: 0.35 },
    { id: 'teardrop', name: 'Teardrop', bodyHalf: 0.35, neckHalf: 0.11, neckSpan: 0.14, shoulderSpan: 0.24, roundBottom: 0.85 },
    { id: 'wide', name: 'Wide Body', bodyHalf: 0.4, neckHalf: 0.13, neckSpan: 0.11, shoulderSpan: 0.1, roundBottom: 0.25 }
  ];

  /* 原版 SAND_COLORS（chunk 33131）——十二种沙色，hex 一字不改 */
  var SAND_COLORS = [
    { id: 'ochre', hex: '#D7A34A', name: 'Ochre' },
    { id: 'amber', hex: '#E8954A', name: 'Amber' },
    { id: 'coral', hex: '#B96C3F', name: 'Coral' },
    { id: 'rust', hex: '#A55C49', name: 'Rust' },
    { id: 'clay', hex: '#8D5A3B', name: 'Clay' },
    { id: 'cream', hex: '#ECE5CD', name: 'Cream' },
    { id: 'wheat', hex: '#D9C7A5', name: 'Wheat' },
    { id: 'gold', hex: '#C8A86B', name: 'Gold' },
    { id: 'moss', hex: '#76815C', name: 'Moss' },
    { id: 'teal', hex: '#6E7C77', name: 'Teal' },
    { id: 'violet', hex: '#7A6A86', name: 'Violet' },
    { id: 'slate', hex: '#4F4A38', name: 'Slate' }
  ];

  /* 原版 shapeById：找不到就回退到第一种 */
  function shapeById(id) {
    for (var i = 0; i < BOTTLE_SHAPES.length; i++) {
      if (BOTTLE_SHAPES[i].id === id) return BOTTLE_SHAPES[i];
    }
    return BOTTLE_SHAPES[0];
  }

  /* 原版沙引擎的固定随机数发生器（mulberry32），保证同一种子下逐粒沙可复现 */
  function makeRng(seed) {
    var t = seed >>> 0;
    return function () {
      t |= 0;
      var e = Math.imul((t = (t + 0x6d2b79f5) | 0) ^ (t >>> 15), 1 | t);
      e = (e + Math.imul(e ^ (e >>> 7), 61 | e)) ^ e;
      return ((e ^ (e >>> 14)) >>> 0) / 0x100000000;
    };
  }

  /*
   * 沙引擎（chunk 52499 的 class SandEngine）。
   * 坐标系：W/H = 画布的 CSS 像素尺寸，与原版 ResizeObserver 给出的尺寸一致。
   */
  function SandEngine(shape, seed) {
    this.W = 0;
    this.H = 0;
    this.shape = shape || BOTTLE_SHAPES[0];
    this.grains = [];
    this.particles = [];
    this.tilt = 0;
    this.seed = seed == null ? 0x13527d6 : seed;
    this.rng = makeRng(this.seed);
    /* 渲染层用：沙粒集合发生变化时置 true，缓存层据此失效。
       dirtyBox 是本帧位移粒子的包围盒（引擎坐标，含新旧位置、按粒半径外扩）；
       为 null 表示需要全量重绘（resize / pour / rod 等集合级变化）。 */
    this.dirty = true;
    this.dirtyBox = null;
  }

  SandEngine.prototype.resize = function (w, h) {
    if (!(w > 0) || !(h > 0)) return;
    if (this.W > 0 && this.H > 0 && this.grains.length) {
      var rx = w / this.W;
      var ry = h / this.H;
      for (var i = 0; i < this.grains.length; i++) {
        this.grains[i].x *= rx;
        this.grains[i].y *= ry;
        this.grains[i]._px = this.grains[i].x;
        this.grains[i]._py = this.grains[i].y;
      }
    }
    this.W = w;
    this.H = h;
    this.dirty = true;
    this.dirtyBox = null;
  };

  SandEngine.prototype.setShape = function (shape) {
    this.shape = shape;
    this.dirty = true;
    this.dirtyBox = null;
  };

  SandEngine.prototype.reset = function () {
    this.grains = [];
    this.particles = [];
    this.tilt = 0;
    this.dirty = true;
    this.dirtyBox = null;
  };

  /*
   * 瓶身半宽剖面（原版 bottleX）：
   *   n = y / H
   *   瓶颈段（n < neckSpan）：半宽 = W * neckHalf
   *   肩部段：二次曲线从 neckHalf 过渡到 bodyHalf
   *   瓶身段（n > .94）：按 roundBottom 收底
   * 返回 [左边界, 右边界]
   */
  SandEngine.prototype.bottleX = function (y) {
    var W = this.W;
    var H = this.H;
    var shape = this.shape;
    var n = y / H;
    var cx = W / 2;
    var body = W * shape.bodyHalf;
    var neck = W * shape.neckHalf;
    var half = body;
    if (n < shape.neckSpan) {
      half = neck;
    } else if (n < shape.neckSpan + shape.shoulderSpan) {
      half = neck + (body - neck) * (1 - Math.pow(1 - clamp((n - shape.neckSpan) / shape.shoulderSpan, 0, 1), 2));
    } else if (n > 0.94) {
      half = body * (1 - ((n - 0.94) / 0.06) * 0.35 * shape.roundBottom);
    }
    return [cx - half, cx + half];
  };

  SandEngine.prototype.topY = function () {
    return Math.max(8, 0.03 * this.H);
  };

  SandEngine.prototype.bottomY = function () {
    return this.H - Math.max(10, 0.02 * this.H);
  };

  /* 沙粒是否在瓶内（左右各留 1px 壁厚） */
  SandEngine.prototype.inside = function (x, y) {
    if (y < this.topY() || y > this.bottomY()) return false;
    var r = this.bottleX(y);
    return x > r[0] + 1 && x < r[1] - 1;
  };

  /* 单粒沙半径：max(1.6, .006 * W) */
  SandEngine.prototype.grainR = function () {
    return Math.max(1.6, 0.006 * this.W);
  };

  /*
   * 填充度：瓶内最高一粒沙到瓶底的高度，占瓶子内高的比例。
   * 注意原版取的是所有沙粒里最小的 y（正在空中飞的也算）。
   */
  SandEngine.prototype.fillLevel = function () {
    if (!this.grains.length) return 0;
    var top = this.bottomY();
    for (var i = 0; i < this.grains.length; i++) {
      if (this.grains[i].y < top) top = this.grains[i].y;
    }
    var span = this.bottomY() - this.topY();
    return clamp((this.bottomY() - top) / span, 0, 1);
  };

  /* 满瓶判据：粒数上限 2600，或者填充度超过 .97 */
  SandEngine.prototype.isFull = function () {
    return this.grains.length >= 2600 || this.fillLevel() > 0.97;
  };

  /*
   * 倒沙：每次调用生成 count 粒沙，落在 (x, y) 附近 ±2 粒半径 × ±1 粒半径的抖动范围，
   * 只有落在瓶内的才入瓶。速度带倾斜分量。
   */
  SandEngine.prototype.pour = function (x, y, color, count) {
    if (this.isFull()) return 0;
    var a = this.grainR();
    var added = 0;
    for (var o = 0; o < count && this.grains.length < 2600; o++) {
      var gx = x + (this.rng() - 0.5) * a * 4;
      var gy = y + (this.rng() - 0.5) * a * 2;
      if (this.inside(gx, gy)) {
        this.grains.push({
          x: gx,
          y: gy,
          vx: 1.4 * this.tilt + (this.rng() - 0.5) * 0.6,
          vy: 1.2 + 0.8 * this.rng(),
          c: color,
          r: a * (0.85 + 0.35 * this.rng()),
          settled: false,
          _px: gx,
          _py: gy
        });
        this.particles.push({
          x: gx,
          y: gy - 3 * a,
          vx: 1.2 * this.tilt,
          vy: 2.4 + this.rng(),
          life: 1,
          c: color
        });
        added++;
      }
    }
    if (added) {
      this.dirty = true;
      this.dirtyBox = null;
    }
    return added;
  };

  /*
   * 推杆（小棒）：作用半径固定 .11 * W，与拖动方向无关。
   * 受力是径向的：沿 (棒→粒) 方向推，强度 (1 - s/a) * 3.2，再叠加拖动位移。
   */
  SandEngine.prototype.rod = function (x, y, dx, dy) {
    var a = 0.11 * this.W;
    var moved = 0;
    for (var i = 0; i < this.grains.length; i++) {
      var g = this.grains[i];
      var ox = g.x - x;
      var oy = g.y - y;
      var s = Math.hypot(ox, oy);
      if (s < a && s > 0.001) {
        var push = (1 - s / a) * 3.2;
        g.x += (ox / s) * push + 0.35 * dx;
        g.y += (oy / s) * push * 0.5 + 0.3 * dy;
        g.vy = -0.6;
        g.settled = false;
        moved++;
      }
    }
    if (moved) {
      this.dirty = true;
      this.dirtyBox = null;
    }
    return moved;
  };

  /*
   * 每帧物理：重力 .22（速度上限 5）、倾斜横向分量 .05 * tilt、水平阻尼 *.9。
   * 已静止的沙粒在 |tilt| < .04 时跳过积分（但仍然参与堆叠）。
   */
  SandEngine.prototype.step = function () {
    var e = this.grainR();
    var bottom = this.bottomY();
    var i;
    for (i = 0; i < this.grains.length; i++) {
      var g = this.grains[i];
      if (g.settled && 0.04 > Math.abs(this.tilt)) continue;
      g.vy = Math.min(5, g.vy + 0.22);
      g.vx += 0.05 * this.tilt;
      g.vx *= 0.9;
      var nx = g.x + g.vx;
      var ny = g.y + g.vy;
      if (!this.inside(nx, ny)) {
        var bx = this.bottleX(clamp(ny, this.topY(), bottom));
        if (nx <= bx[0] + 1) nx = bx[0] + 1 + 0.2 * g.r;
        else if (nx >= bx[1] - 1) nx = bx[1] - 1 - 0.2 * g.r;
        g.vx *= -0.3;
        if (ny > bottom) {
          ny = bottom - g.r;
          g.vy = 0;
        }
      }
      g.x = nx;
      g.y = Math.min(bottom - 0.5 * g.r, ny);
    }

    this.stack(e);

    for (i = 0; i < this.particles.length; i++) {
      var p = this.particles[i];
      p.vy += 0.22;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.06;
    }
    var keep = [];
    for (i = 0; i < this.particles.length; i++) {
      if (this.particles[i].life > 0) keep.push(this.particles[i]);
    }
    this.particles = keep;

    /* 位置真的变了才让渲染缓存失效（静止的沙堆不重绘）。
       dirtyBox 记录本帧所有位移的并集包围盒（新旧位置都算、按粒半径外扩），
       渲染层据此做增量重绘。 */
    var bx0 = 0;
    var by0 = 0;
    var bx1 = 0;
    var by1 = 0;
    var boxInit = false;
    for (i = 0; i < this.grains.length; i++) {
      var q = this.grains[i];
      if (q.x !== q._px || q.y !== q._py) {
        var pad = q.r + 1;
        var qx0 = (q._px < q.x ? q._px : q.x) - pad;
        var qy0 = (q._py < q.y ? q._py : q.y) - pad;
        var qx1 = (q._px > q.x ? q._px : q.x) + pad;
        var qy1 = (q._py > q.y ? q._py : q.y) + pad;
        if (!boxInit) {
          bx0 = qx0;
          by0 = qy0;
          bx1 = qx1;
          by1 = qy1;
          boxInit = true;
        } else {
          if (qx0 < bx0) bx0 = qx0;
          if (qy0 < by0) by0 = qy0;
          if (qx1 > bx1) bx1 = qx1;
          if (qy1 > by1) by1 = qy1;
        }
        q._px = q.x;
        q._py = q.y;
        this.dirty = true;
      }
    }
    if (this.dirty && !boxInit) {
      /* dirty 由 pour/rod 等路径设置：它们的 dirtyBox 已置 null（全量） */
    } else if (boxInit) {
      var box = this.dirtyBox;
      if (box) {
        if (bx0 < box[0]) box[0] = bx0;
        if (by0 < box[1]) box[1] = by0;
        if (bx1 > box[2]) box[2] = bx1;
        if (by1 > box[3]) box[3] = by1;
      } else {
        this.dirtyBox = [bx0, by0, bx1, by1];
      }
    }
  };

  /*
   * 堆叠（原版 stack）：按列做高度场，格宽 1.7 * 粒半径。
   *   落位高度 = 列顶 - 1.1 * 粒半径
   *   落位后列顶 = 粒心 - 0.6 * 粒半径
   *   两侧高差超过 .7 * 格宽时沿坡向滑落 .6 * 格宽
   * 高度场缓冲区按需扩容后复用（原版每帧 new Float32Array；
   * 复用只减少 GC 尖峰，数值与原版逐位一致）。
   */
  SandEngine.prototype.stack = function (e) {
    var grains = this.grains;
    var cell = 1.7 * e;
    var cols = Math.max(1, Math.ceil(this.W / cell));
    var tops = this._topsBuf;
    if (!tops || tops.length !== cols) tops = this._topsBuf = new Float32Array(cols);
    var bottom = this.bottomY();
    var i;
    for (i = 0; i < cols; i++) tops[i] = bottom;

    grains.sort(function (a, b) { return b.y - a.y; });

    for (i = 0; i < grains.length; i++) {
      var g = grains[i];
      /* 四期体验修正（经用户拍板偏离原版）：原版每帧全体重建堆，粒子落定后仍会
       * 因 settled 标志逐帧翻转而缓慢蠕动（堆面压实收敛以分钟计，用户实测
       * 「一直在动、没有从动态到静态的过程」）。修正：落定粒子在静止时冻结
       * （不参与物理重排），但仍然占列顶高度场（新沙落在冻结层之上，分层不穿透）；
       * 倒沙/倾斜时（|tilt|>=0.04）全体解冻重排，与 step() 的 settled 跳过条件对称。
       * 滑落/落位/列顶公式保持原版逐字不变。 */
      if (g.settled && Math.abs(this.tilt) < 0.04) {
        var idxF = clamp(Math.floor(g.x / cell), 0, cols - 1);
        tops[idxF] = Math.min(tops[idxF], g.y - 0.6 * e);
        continue;
      }
      var idx = clamp(Math.floor(g.x / cell), 0, cols - 1);
      var limit = tops[idx] - 1.1 * e;
      /* 四期体验修正：落位判定带 0.05px 容差。原版 `g.y > limit` 在粒子落位后
       * （g.y==limit）逐帧翻回 settled=false，堆面压实永不收敛（用户实测
       * 「一直在动、不是正常物理」）。容差让已落位粒子保持 settled=true。 */
      if (g.y > limit - 0.05) {
        g.y = limit;
        g.vy = 0;
        g.settled = true;
        var left = idx > 0 ? tops[idx - 1] : bottom;
        var right = idx < cols - 1 ? tops[idx + 1] : bottom;
        var dl = left - g.y;
        var dr = right - g.y;
        var h = 0.7 * cell;
        if (dl > h && dl >= dr) {
          g.x -= 0.6 * cell;
          g.y = left - 1.1 * e;
          g.settled = false;
        } else if (dr > h) {
          g.x += 0.6 * cell;
          g.y = right - 1.1 * e;
          g.settled = false;
        }
        var f = clamp(Math.floor(g.x / cell), 0, cols - 1);
        tops[f] = Math.min(tops[f], g.y - 0.6 * e);
      } else {
        g.settled = false;
      }
      var bx = this.bottleX(clamp(g.y, this.topY(), bottom));
      if (g.x < bx[0] + e) g.x = bx[0] + e;
      if (g.x > bx[1] - e) g.x = bx[1] - e;
    }
  };

  /*
   * 原版进入制作页时的演示灌注：420 粒沙、三种颜色各 140 粒，
   * 三条带子的高度依次抬高 0.05 * H，横向按 sin(t) * 0.14 * W 摆动。
   * 这一步是原版行为：瓶子从来不是空的。
   */
  SandEngine.prototype.demoFill = function () {
    if (this.grains.length) return 0;
    var added = 0;
    var x0 = this.W / 2;
    var bottom = this.bottomY();
    for (var t = 0; t < 420; t++) {
      var band = Math.floor(t / 140);
      added += this.pour(
        x0 + Math.sin(t) * this.W * 0.14,
        bottom - band * this.H * 0.05 - 4,
        SAND_COLORS[band].hex,
        1
      );
    }
    return added;
  };

  /*
   * 结构化存档用：把逐粒沙压成「每列的颜色游程」，不存任何图片。
   */
  SandEngine.prototype.layerRuns = function () {
    var cell = 1.7 * this.grainR();
    var cols = Math.max(1, Math.ceil(this.W / cell));
    var buckets = [];
    var i;
    for (i = 0; i < cols; i++) buckets.push([]);
    for (i = 0; i < this.grains.length; i++) {
      var g = this.grains[i];
      var idx = clamp(Math.floor(g.x / cell), 0, cols - 1);
      buckets[idx].push(g);
    }
    var runs = [];
    for (i = 0; i < cols; i++) {
      var list = buckets[i];
      list.sort(function (a, b) { return b.y - a.y; });
      var col = [];
      var j;
      for (j = 0; j < list.length; j++) {
        var color = list[j].c;
        if (col.length && col[col.length - 1][0] === color) {
          col[col.length - 1][1] += 1;
        } else {
          col.push([color, 1]);
        }
      }
      runs.push(col);
    }
    return runs;
  };

  root.SandGame = {
    BOTTLE_SHAPES: BOTTLE_SHAPES,
    SAND_COLORS: SAND_COLORS,
    shapeById: shapeById,
    SandEngine: SandEngine,
    MAX_GRAINS: 2600,
    clamp: clamp
  };
})(typeof window !== 'undefined' ? window : global);
