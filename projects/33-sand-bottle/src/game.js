/*
 * 彩沙瓶 · 玩法逻辑
 *
 * 瓶子里是一列一列的沙。核心是两种不同的运动：
 *   1. 倒沙（pour）：沙粒落到某列后堆高，坡度超过安息角就会自己往低处滑。
 *      所以「自然堆积」永远会留下斜坡，要铺平就得一点点补。
 *   2. 塑形（shape）：用小棒把沙从一列搬到另一列，可以强行堆出斜坡之外的形状。
 *      塑形不受安息角约束——这正是「靠工具塑形而不是让它自己塌」的意思。
 *
 * 瓶子内部是 cols 列 × maxHeight 层的离散网格，每格记一个颜色索引。
 * 目标图案也是同一套网格，关卡只描述「色带 + 山峰」，由 buildTarget 展开。
 */
(function (root) {
  'use strict';

  var DEFAULT_COLS = 24;
  var DEFAULT_MAX_HEIGHT = 34;
  var DEFAULT_MAX_SLOPE = 2;

  function emptyCols(count) {
    var cols = [];
    for (var i = 0; i < count; i++) cols.push([]);
    return cols;
  }

  /* 把关卡描述展开成目标网格：先铺色带，再在色带之上叠出三角形山峰 */
  function buildTarget(level, meta) {
    var cols = meta.cols || DEFAULT_COLS;
    var rows = meta.maxHeight || DEFAULT_MAX_HEIGHT;
    var grid = [];
    for (var r = 0; r < rows; r++) {
      var line = [];
      for (var c = 0; c < cols; c++) line.push(-1);
      grid.push(line);
    }

    var row = 0;
    var bands = level.bands || [];
    var baseHeight = 0;
    for (var i = 0; i < bands.length; i++) {
      var band = bands[i];
      baseHeight += band.height;
      for (var b = 0; b < band.height && row < rows; b++) {
        for (var c2 = 0; c2 < cols; c2++) grid[row][c2] = band.color;
        row++;
      }
    }

    if (level.peak) {
      var p = level.peak;
      var center = p.center * (cols - 1);
      var half = p.halfWidth * (cols - 1);
      /* 三角形山：每往上一层，横向半宽就收一点，坡度 = 高度 / 半宽 */
      for (var k = 0; k < p.height; k++) {
        var frac = p.height <= 1 ? 0 : 1 - k / (p.height - 1);
        var wide = half * frac;
        var lo = Math.max(0, Math.round(center - wide));
        var hi = Math.min(cols - 1, Math.round(center + wide));
        if (row + k >= rows) break;
        for (var cc = lo; cc <= hi; cc++) grid[row + k][cc] = p.color;
      }
    }

    var cells = 0;
    var maxHeight = 0;
    var heights = [];
    for (var r2 = 0; r2 < rows; r2++) {
      for (var c3 = 0; c3 < cols; c3++) {
        if (grid[r2][c3] >= 0) cells++;
      }
    }
    for (var c4 = 0; c4 < cols; c4++) {
      var h = 0;
      for (var r3 = 0; r3 < rows; r3++) {
        if (grid[r3][c4] >= 0) h++;
      }
      heights.push(h);
      if (h > maxHeight) maxHeight = h;
    }
    return { grid: grid, cells: cells, maxHeight: maxHeight, heights: heights, baseHeight: baseHeight };
  }

  function createRun(content) {
    var meta = content.meta;
    var state = {
      content: content,
      meta: meta,
      levelIndex: 0,
      level: null,
      cols: emptyCols(meta.cols || DEFAULT_COLS),
      palette: 0,
      tool: 'pour',
      used: 0,
      budget: 0,
      target: null,
      score: 0,
      sealed: 0,
      bottles: [],
      phase: 'building'
    };
    loadLevel(state, 0);
    return state;
  }

  function loadLevel(state, index) {
    var levels = state.content.levels;
    var next = Math.max(0, Math.min(index, levels.length - 1));
    state.levelIndex = next;
    state.level = levels[next];
    state.cols = emptyCols(state.meta.cols || DEFAULT_COLS);
    state.palette = (state.level.bands && state.level.bands[0] ? state.level.bands[0].color : 0);
    state.used = 0;
    state.tool = 'pour';
    state.target = buildTarget(state.level, state.meta);
    state.budget = Math.ceil(state.target.cells * (state.level.budgetRatio || 1.4));
    state.phase = 'building';
  }

  function maxSlope(state) {
    return state.meta.maxSlope || DEFAULT_MAX_SLOPE;
  }

  /*
   * 安息角松弛：相邻两列高度差超过上限时，把高的一列顶层沙挪到低的一列。
   * 只在倒沙与挖沙后执行——塑形是玩家主动的强行操作，不受这条约束。
   */
  function relax(state) {
    var limit = maxSlope(state);
    var guard = 0;
    var moved = true;
    while (moved && guard < 4000) {
      moved = false;
      guard++;
      for (var c = 0; c < state.cols.length - 1; c++) {
        var h1 = state.cols[c].length;
        var h2 = state.cols[c + 1].length;
        if (h1 - h2 > limit) {
          state.cols[c + 1].push(state.cols[c].pop());
          moved = true;
        } else if (h2 - h1 > limit) {
          state.cols[c].push(state.cols[c + 1].pop());
          moved = true;
        }
      }
    }
  }

  /* 倒沙：往第 col 列顶部加一粒当前颜色的沙 */
  function pour(state, col) {
    if (state.phase !== 'building') return null;
    if (col < 0 || col >= state.cols.length) return null;
    if (state.used >= state.budget) return { type: 'full' };
    var maxHeight = state.meta.maxHeight || DEFAULT_MAX_HEIGHT;
    if (state.cols[col].length >= maxHeight) return { type: 'overflow' };
    state.cols[col].push(state.palette);
    state.used += 1;
    relax(state);
    return { type: 'pour', col: col, color: state.palette };
  }

  /* 塑形：把 fromCol 顶层一粒沙搬到 toCol。沙量不变，坡度不变。 */
  function shape(state, fromCol, toCol) {
    if (state.phase !== 'building') return null;
    if (fromCol < 0 || fromCol >= state.cols.length) return null;
    if (toCol < 0 || toCol >= state.cols.length) return null;
    if (fromCol === toCol) return null;
    var maxHeight = state.meta.maxHeight || DEFAULT_MAX_HEIGHT;
    if (state.cols[fromCol].length <= 0) return { type: 'empty' };
    if (state.cols[toCol].length >= maxHeight) return { type: 'overflow' };
    var grain = state.cols[fromCol].pop();
    state.cols[toCol].push(grain);
    return { type: 'shape', from: fromCol, to: toCol, color: grain };
  }

  /* 挖沙：拿走第 col 列顶层一粒沙，额度退还 */
  function scoop(state, col) {
    if (state.phase !== 'building') return null;
    if (col < 0 || col >= state.cols.length) return null;
    if (state.cols[col].length <= 0) return { type: 'empty' };
    var grain = state.cols[col].pop();
    state.used -= 1;
    relax(state);
    return { type: 'scoop', col: col, color: grain };
  }

  function totalCells(state) {
    var sum = 0;
    for (var c = 0; c < state.cols.length; c++) sum += state.cols[c].length;
    return sum;
  }

  /*
   * 吻合度：分母取目标格数，这样「少堆了」和「堆错了」都会拉低分数。
   * 多出来的沙靠 coverage 上限来罚（目标位置之外的沙不算命中）。
   *
   * 光看吻合度不够：目标里的色带往往占了大头，峰只占小头，
   * 所以「峰堆歪了」几乎不影响比率。这里再加一条按列比高度的判据：
   * 每一列的实际高度和目标高度最多差 heightTolerance 层。
   */
  function evaluate(state) {
    var grid = state.target.grid;
    var match = 0;
    var filled = 0;
    for (var c = 0; c < state.cols.length; c++) {
      var column = state.cols[c];
      for (var r = 0; r < column.length; r++) {
        filled++;
        if (grid[r] && grid[r][c] === column[r]) match++;
      }
    }
    var targetCells = state.target.cells;
    var ratio = targetCells > 0 ? match / targetCells : 0;
    var coverage = targetCells > 0 ? filled / targetCells : 0;
    var actualMax = 0;
    var heightError = 0;
    var peakError = 0;
    var baseError = 0;
    var targetHeights = state.target.heights || [];
    var baseHeight = state.target.baseHeight || 0;
    for (var c2 = 0; c2 < state.cols.length; c2++) {
      var actualHeight = state.cols[c2].length;
      if (actualHeight > actualMax) actualMax = actualHeight;
      var targetHeight = targetHeights[c2] || 0;
      var error = Math.abs(actualHeight - targetHeight);
      if (error > heightError) heightError = error;
      /* 山上的列和底下的列分开算：山不够高和沙面不平是两回事 */
      if (targetHeight > baseHeight) {
        if (error > peakError) peakError = error;
      } else if (error > baseError) {
        baseError = error;
      }
    }
    var tolerance = state.level.tolerance || 0.85;
    var amountTolerance = state.level.amountTolerance || 0.18;
    var heightTolerance =
      state.level.heightTolerance == null ? 1 : state.level.heightTolerance;

    var ratioOk = ratio >= tolerance;
    var amountOk = coverage >= 1 - amountTolerance && coverage <= 1 + amountTolerance;
    var heightOk = baseError <= heightTolerance;
    /* 有山的关卡：山本身必须堆到目标高度（允许差一层，和逐列的高度容差一致） */
    var hasPeak = !!state.level.peak;
    var peakOk = !hasPeak || peakError <= heightTolerance;

    var reason = '';
    var copy = (state.content && state.content.copy) || {};
    if (!amountOk) reason = copy.reasonAmount || '沙量不对';
    else if (!ratioOk) {
      /* 沙量够但没铺满 → 是沙不够；沙量够也铺满了还不对 → 是颜色不对 */
      reason = coverage < 1 ? (copy.reasonShort || '沙还不够铺满') : (copy.reasonColor || '颜色还没对');
    } else if (!peakOk) reason = copy.reasonPeak || '山还不够高';
    else if (!heightOk) reason = copy.reasonHeight || '沙面还不够平';

    var ok = ratioOk && amountOk && heightOk && peakOk;
    return {
      match: match,
      filled: filled,
      targetCells: targetCells,
      ratio: ratio,
      coverage: coverage,
      actualMax: actualMax,
      targetMax: state.target.maxHeight,
      heightError: heightError,
      peakError: peakError,
      baseError: baseError,
      heightTolerance: heightTolerance,
      reason: reason,
      passed: ok
    };
  }

  /* 封口：把当前瓶子收进收藏架，只存结构化的层色清单，不存任何图片 */
  function seal(state) {
    var result = evaluate(state);
    if (!result.passed) return null;
    var layers = [];
    for (var c = 0; c < state.cols.length; c++) {
      var column = [];
      for (var r = 0; r < state.cols[c].length; r++) column.push(state.cols[c][r]);
      layers.push(column);
    }
    var bottle = {
      id: state.levelIndex,
      name: state.level.name,
      colors: layers,
      ratio: Math.round(result.ratio * 100),
      score: state.score
    };
    state.bottles.push(bottle);
    state.sealed += 1;
    return bottle;
  }

  root.SandGame = {
    DEFAULT_COLS: DEFAULT_COLS,
    DEFAULT_MAX_HEIGHT: DEFAULT_MAX_HEIGHT,
    buildTarget: buildTarget,
    createRun: createRun,
    loadLevel: loadLevel,
    pour: pour,
    shape: shape,
    scoop: scoop,
    relax: relax,
    evaluate: evaluate,
    totalCells: totalCells,
    seal: seal
  };
})(typeof window !== 'undefined' ? window : global);
