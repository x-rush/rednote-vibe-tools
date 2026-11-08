/*
 * 珍珠消消乐 · 核心玩法逻辑
 * 纯逻辑模块：不触碰 DOM，可在 Node 下直接单测。
 */
(function (root) {
  'use strict';

  var DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  var QUEUE_LEN = 12;
  var MAX_CHAIN = 6;

  /* ---------- 随机数：mulberry32，可复现 ---------- */
  function createRng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rng, list) {
    return list[Math.floor(rng() * list.length) % list.length];
  }

  /*
   * 若把 (r,c) 放成 color，它会与多少颗已有同色珠子连成一块。
   * 返回值不含 (r,c) 自身：0 表示孤立的单颗，1 表示对子，2 表示会成三连。
   */
  function neighborComponentSize(board, r, c, color) {
    var cols = board.cols, rows = board.rows;
    var seen = {};
    var stack = [];
    var dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (var d = 0; d < 4; d++) {
      var nr = r + dirs[d][0], nc = c + dirs[d][1];
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      var cell = board.cells[nr * cols + nc];
      if (cell && cell.color === color) stack.push([nr, nc]);
    }
    var size = 0;
    while (stack.length) {
      var cur = stack.pop();
      if (cur[0] < 0 || cur[0] >= rows || cur[1] < 0 || cur[1] >= cols) continue;
      var key = cur[0] * cols + cur[1];
      if (seen[key]) continue;
      seen[key] = 1;
      var cell2 = board.cells[key];
      if (!cell2 || cell2.color !== color) continue;
      size++;
      for (var i = 0; i < 4; i++) {
        stack.push([cur[0] + dirs[i][0], cur[1] + dirs[i][1]]);
      }
    }
    return size;
  }

  /*
   * 填充剩余位置。
   *
   * 绝大多数位置只放「不会立刻成三连」的颜色（邻居连通量 ≤ 1），
   * 但保留约三成位置允许拼出 L 形三连（邻居连通量 = 2）。
   * 理由：颜色越多，盘面越稀疏，若一味禁止成组，6 色的后期关卡会变成
   * 「整盘只有一组可点」的苦差，玩家既没有选择也没有连锁可言。
   * 少量主动成组让盘面始终摆着若干可选目标，连锁才有触发土壤；
   * 连锁深度与每轮组数都有上限，不会演变成一次点击清空半盘。
   */
  function fillRemaining(board, palette, rng) {
    var rows = board.rows, cols = board.cols;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var index = r * cols + c;
        if (board.cells[index].color !== -1) continue;
        var safe = [];
        var trio = [];
        for (var p = 0; p < palette.length; p++) {
          var size = neighborComponentSize(board, r, c, palette[p]);
          if (size <= 1) safe.push(palette[p]);
          else if (size === 2) trio.push(palette[p]);
        }
        var choices;
        if (!safe.length) {
          choices = trio.length ? trio : palette.slice();
        } else if (trio.length && rng() < 0.3) {
          choices = trio.concat(safe);
        } else {
          choices = safe;
        }
        board.cells[index].color = pick(rng, choices);
      }
    }
  }

  /* ---------- 棋盘 ---------- */
  /*
   * 盘面生成：先播下若干「独立小簇」（3~5 颗同色）作为玩家可点的目标，
   * 其余位置用「不与已放珠子连成三连」的方式填充。
   * 这样盘面既有清晰可点的目标，又不会密到一处点击就把全盘连锁清空。
   */
  function makeBoard(cols, rows, palette, rng) {
    var cells = [];
    var id = 1;
    var i, r, c;
    for (i = 0; i < cols * rows; i++) cells.push({ id: id++, color: -1 });

    var board = { cols: cols, rows: rows, cells: cells, nextId: id };

    var clusterCount = 4 + Math.floor(rng() * 3);
    var placedClusters = [];
    var attempts = 0;
    while (placedClusters.length < clusterCount && attempts < 300) {
      attempts++;
      var size = 3 + Math.floor(rng() * 3);
      var cr = Math.floor(rng() * rows);
      var cc = Math.floor(rng() * cols);
      /* 簇形限定为直线或 L 形：形状紧凑，大小可控，不会意外连成大块 */
      var shape = [];
      if (rng() < 0.5) {
        for (var s = 0; s < size; s++) shape.push([0, s]);
      } else {
        shape.push([0, 0]);
        for (var t = 1; t < size; t++) {
          if (t % 2 === 1) shape.push([0, t]);
          else shape.push([1, t - 1]);
        }
      }
      var cellsToTry = [];
      var ok = true;
      var used = {};
      for (var k = 0; k < shape.length; k++) {
        var nr = cr + shape[k][0];
        var nc = cc + shape[k][1];
        if (nr >= rows || nc >= cols || nr < 0 || nc < 0) { ok = false; break; }
        var idx = nr * cols + nc;
        if (cells[idx].color !== -1 || used[idx]) { ok = false; break; }
        /* 与已播下的簇保持距离，避免两个簇连成大块 */
        for (var p = 0; p < placedClusters.length; p++) {
          var other = placedClusters[p];
          if (Math.abs(other.r - nr) <= 1 && Math.abs(other.c - nc) <= 1) { ok = false; break; }
        }
        if (!ok) break;
        used[idx] = 1;
        cellsToTry.push(idx);
      }
      if (!ok || cellsToTry.length < 3) continue;
      var clusterColor = palette[Math.floor(rng() * palette.length) % palette.length];
      for (i = 0; i < cellsToTry.length; i++) cells[cellsToTry[i]].color = clusterColor;
      placedClusters.push({ r: cr, c: cc });
    }

    fillRemaining(board, palette, rng);
    ensureCluster(board, palette, rng);
    return board;
  }

  /*
   * 保证盘面至少存在一组可消的三连，避免死局。
   * 只在完全没有三连时补一颗，且不参与连锁判定（见 resolveTap 的 known 集合）。
   */
  function ensureCluster(board, palette, rng) {
    var groups = findAllGroups(board);
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].length >= 3) return false;
    }
    /* 在上半盘随机一列强制凑出纵向三连 */
    var col = Math.floor(rng() * board.cols);
    var start = Math.floor(rng() * Math.max(1, board.rows - 2));
    var color = palette[Math.floor(rng() * palette.length) % palette.length];
    for (var r = start; r < Math.min(board.rows, start + 3); r++) {
      board.cells[r * board.cols + col].color = color;
    }
    return true;
  }

  function neighbors(board, index) {
    var r = Math.floor(index / board.cols);
    var c = index % board.cols;
    var out = [];
    for (var i = 0; i < 4; i++) {
      var nr = r + DIRS[i][0];
      var nc = c + DIRS[i][1];
      if (nr < 0 || nr >= board.rows || nc < 0 || nc >= board.cols) continue;
      out.push(nr * board.cols + nc);
    }
    return out;
  }

  /* 与 index 同色且相连的一组（含自身） */
  function findGroup(board, index) {
    var cell = board.cells[index];
    if (!cell) return [];
    var color = cell.color;
    var seen = {};
    var stack = [index];
    var group = [];
    seen[index] = 1;
    while (stack.length) {
      var cur = stack.pop();
      group.push(cur);
      var ns = neighbors(board, cur);
      for (var i = 0; i < ns.length; i++) {
        var n = ns[i];
        if (seen[n]) continue;
        var nc = board.cells[n];
        if (!nc || nc.color !== color) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    return group;
  }

  /* 全盘所有同色连通块 */
  function findAllGroups(board) {
    var seen = {};
    var groups = [];
    for (var i = 0; i < board.cells.length; i++) {
      if (seen[i] || !board.cells[i]) continue;
      var group = findGroup(board, i);
      for (var j = 0; j < group.length; j++) seen[group[j]] = 1;
      groups.push(group);
    }
    return groups;
  }

  /* 下落：列内压实，记录位移 */
  function applyGravity(board) {
    var falls = [];
    for (var c = 0; c < board.cols; c++) {
      var write = board.rows - 1;
      for (var r = board.rows - 1; r >= 0; r--) {
        var index = r * board.cols + c;
        var cell = board.cells[index];
        if (!cell) continue;
        if (write !== r) {
          var to = write * board.cols + c;
          board.cells[to] = cell;
          board.cells[index] = null;
          falls.push({ from: index, to: to, id: cell.id, color: cell.color, distance: write - r });
        }
        write--;
      }
    }
    return falls;
  }

  /*
   * 补充队列：让玩家可以提前预判即将到来的颜色。
   * 关键约束是队列本身要有足够的颜色多样性——
   * 若队列只在一两种颜色间交替，填进去的珠子必然连成新组，
   * 引发连锁雪崩，一���点击就能清空半个盘面。
   */
  function nextQueueColor(queue, palette, rng) {
    /* 队列中出现次数越少的颜色，权重越高，保证色板轮转 */
    var counts = {};
    for (var i = 0; i < queue.length; i++) {
      counts[queue[i]] = (counts[queue[i]] || 0) + 1;
    }
    var total = 0;
    var weights = [];
    for (var p = 0; p < palette.length; p++) {
      var weight = 1 + 4 / (1 + (counts[palette[p]] || 0));
      weights.push(weight);
      total += weight;
    }
    var roll = rng() * total;
    for (var j = 0; j < palette.length; j++) {
      roll -= weights[j];
      if (roll <= 0) return palette[j];
    }
    return palette[palette.length - 1];
  }

  function refillQueue(board, queue, palette, rng) {
    while (queue.length < QUEUE_LEN) queue.push(nextQueueColor(queue, palette, rng));
    return queue;
  }

  /*
   * 顶部补充：空位按「行优先、同行从左到右」填入队列头部颜色。
   *
   * 补充的珠子可以拼出三连，这是连锁的主要来源；
   * 但要拦住四连以上的巨块，否则一次点击就会抹掉半个盘面。
   * 玩家仍可通过「接下来」预览规划，成组与否保留了一点手气。
   */
  function refillBoard(board, queue, palette, rng) {
    var spawns = [];
    for (var r = 0; r < board.rows; r++) {
      for (var c = 0; c < board.cols; c++) {
        var index = r * board.cols + c;
        if (board.cells[index]) continue;
        refillQueue(board, queue, palette, rng);
        var color = queue.shift();
        /*
         * 补充的珠子优先取「不会立刻与落位珠子连成四颗以上」的颜色。
         * 允许它拼出三连——那正是连锁的来源，是这个游戏最爽的部分；
         * 但要拦住四连以上的大色块，否则一次点击就会抹掉半个盘面。
         * 只换一次，避免过度干预玩家的规划；玩家看到的「接下来」预览仍大体成立。
         */
        if (neighborComponentSize(board, r, c, color) >= 3 && queue.length) {
          var alt = queue[0];
          if (neighborComponentSize(board, r, c, alt) < 3) {
            queue.shift();
            queue.push(color);
            color = alt;
          }
        }
        refillQueue(board, queue, palette, rng);
        var cell = { id: board.nextId++, color: color };
        board.cells[index] = cell;
        spawns.push({ index: index, id: cell.id, color: color, row: r, col: c });
      }
    }
    return spawns;
  }

  function groupPayload(board, group) {
    var out = [];
    for (var i = 0; i < group.length; i++) {
      var index = group[i];
      var cell = board.cells[index];
      out.push({ index: index, id: cell.id, color: cell.color, row: Math.floor(index / board.cols), col: index % board.cols });
    }
    return out;
  }

  /*
   * 点一次珠子后完整结算：
   * 移除 → 下落 → 补充 → 只把「新生」的同色三连继续连锁
   *
   * 判定基准是「珍珠身份集合」而不是位置：
   * 一组三颗整体下滑后仍是同一批珍珠，不算新生，不会重复触发；
   * 只有因下落或补充而真正形成的新组合才算连锁。
   */
  function groupKey(ids) {
    var sorted = ids.slice().sort(function (a, b) { return a - b; });
    return sorted.join('-');
  }

  function groupsOfSize(board, minSize) {
    var all = findAllGroups(board);
    var out = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].length >= minSize) out.push(all[i]);
    }
    return out;
  }

  function resolveTap(state, index) {
    var board = state.board;
    if (!board.cells[index]) return { ok: false, reason: 'empty', groupSize: 0 };
    var first = findGroup(board, index);
    if (first.length < 3) return { ok: false, reason: 'too-few', groupSize: first.length };

    var timeline = [];
    var pops = [];
    var pending = [first];
    var chain = 0;
    var totalPopped = 0;
    var totalScore = 0;

    /* 已知的三连身份集合：初始盘面上的三连属于玩家手动点击的目标 */
    var known = {};
    var initialGroups = groupsOfSize(board, 3);
    for (var k = 0; k < initialGroups.length; k++) {
      var ids = [];
      for (var m = 0; m < initialGroups[k].length; m++) ids.push(board.cells[initialGroups[k][m]].id);
      known[groupKey(ids)] = 1;
    }

    while (pending.length && chain < MAX_CHAIN) {
      chain++;
      var groups = pending.map(function (g) { return groupPayload(board, g); });
      var stepScore = 0;
      var stepPopped = 0;
      for (var gi = 0; gi < groups.length; gi++) {
        var g = groups[gi];
        for (var i = 0; i < g.length; i++) {
          board.cells[g[i].index] = null;
          pops.push({ index: g[i].index, color: g[i].color, step: chain });
        }
        stepPopped += g.length;
        /* 单颗 10 分，连锁倍率最高 5 倍，保证分数可控可读 */
        stepScore += g.length * 10 * Math.min(chain, 5);
      }
      var falls = applyGravity(board);
      var spawns = refillBoard(board, state.queue, state.palette, state.rng);
      totalPopped += stepPopped;
      totalScore += stepScore;
      timeline.push({
        chain: chain,
        groups: groups,
        falls: falls,
        spawns: spawns,
        popped: stepPopped,
        score: stepScore
      });

      /*
       * 只挑「新生」的组合继续连锁。
       * 每轮最多取一组：一次连锁里同时清掉多组会让分数与盘面都失控，
       * 逐组推进既有层层递进的爽感，也让连锁倍率读得准。
       */
      var current = groupsOfSize(board, 3);
      var next = [];
      for (var a = 0; a < current.length; a++) {
        var curIds = [];
        for (var b = 0; b < current[a].length; b++) curIds.push(board.cells[current[a][b]].id);
        var key = groupKey(curIds);
        if (!known[key]) {
          known[key] = 1;
          next.push(current[a]);
          break;
        }
      }
      pending = next;
    }

    /* 结算后确保盘面仍存在玩家可点的三连，避免死局 */
    ensureCluster(board, state.palette, state.rng);

    return {
      ok: true,
      chain: chain,
      popped: totalPopped,
      score: totalScore,
      timeline: timeline,
      pops: pops
    };
  }

  /* ---------- 一局进度 ---------- */
  function createRun(content) {
    var meta = content.meta;
    var level = content.levels[0];
    var state = {
      content: content,
      meta: meta,
      levelIndex: 0,
      level: level,
      palette: level.palette.slice(),
      board: makeBoard(meta.boardCols, meta.boardRows, level.palette, createRng(meta.seedBase)),
      queue: [],
      rng: createRng(meta.seedBase + 7),
      tapsLeft: level.taps,
      cleared: 0,
      score: 0,
      bestChain: 0,
      bestChainPops: [],
      bestChainStep: 0,
      history: []
    };
    refillQueue(state.board, state.queue, state.palette, state.rng);
    return state;
  }

  function previewColors(state, count) {
    refillQueue(state.board, state.queue, state.palette, state.rng);
    return state.queue.slice(0, Math.min(count, state.queue.length));
  }

  function loadLevel(state, index) {
    var content = state.content;
    var level = content.levels[index];
    state.levelIndex = index;
    state.level = level;
    state.palette = level.palette.slice();
    state.board = makeBoard(content.meta.boardCols, content.meta.boardRows, state.palette, createRng(content.meta.seedBase + index * 1013));
    state.queue = [];
    state.rng = createRng(content.meta.seedBase + index * 1013 + 7);
    state.tapsLeft = level.taps;
    state.cleared = 0;
    refillQueue(state.board, state.queue, state.palette, state.rng);
    return state;
  }

  /* 结算一次点击，更新关卡进度 */
  function applyTap(state, index) {
    var result = resolveTap(state, index);
    if (!result.ok) return result;
    state.tapsLeft = Math.max(0, state.tapsLeft - 1);
    state.cleared += result.popped;
    state.score += result.score;
    state.history.push({ level: state.levelIndex, chain: result.chain, popped: result.popped, score: result.score });
    if (result.chain > state.bestChain) {
      state.bestChain = result.chain;
      state.bestChainPops = result.pops.slice();
      state.bestChainStep = state.levelIndex;
    }
    result.levelDone = state.cleared >= state.level.target;
    result.runDone = state.levelIndex >= state.content.levels.length - 1 && result.levelDone;
    result.tapsLeft = state.tapsLeft;
    result.cleared = state.cleared;
    result.target = state.level.target;
    return result;
  }

  var api = {
    QUEUE_LEN: QUEUE_LEN,
    createRng: createRng,
    makeBoard: makeBoard,
    findGroup: findGroup,
    findAllGroups: findAllGroups,
    applyGravity: applyGravity,
    nextQueueColor: nextQueueColor,
    resolveTap: resolveTap,
    createRun: createRun,
    loadLevel: loadLevel,
    previewColors: previewColors,
    applyTap: applyTap
  };

  root.BobaGame = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : global);
