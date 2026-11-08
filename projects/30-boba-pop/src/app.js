/*
 * 珍珠消消乐 · 主程序
 * 负责：动画状态机、连锁编排、UI 流程、输入处理。
 */
(function (root) {
  'use strict';

  var content = root.CONTENT;
  var copy = content.copy;
  var $ = function (id) { return document.getElementById(id); };

  var canvas = $('board');
  var renderer = root.BobaRender.createRenderer(canvas);
  var audio = root.BobaAudio.createAudio();
  var game = root.BobaGame;

  var state = game.createRun(content);
  var pearls = [];
  var pearlById = {};
  var phase = 'idle';        /* idle | popping | falling | levelDone | over */
  var queue = [];            /* 待播放的动画步骤 */
  var stepTimer = 0;
  var raf = 0;
  var lastFrame = 0;
  var muted = false;
  var bestScore = 0;
  var highlightSet = {};
  var highlightLevel = 0;
  var chainBannerTimer = 0;
  var pendingLevelDone = false;
  var pendingRunDone = false;
  var activePointer = null;

  var reducedMotion = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderer.setReducedMotion(reducedMotion);

  renderer.setFlavorList(content.flavors);
  renderer.setGrid(content.meta.boardCols, content.meta.boardRows);

  /* ---------- 珍珠视图同步 ---------- */
  function syncPearls() {
    var next = [];
    var byId = {};
    var board = state.board;
    for (var i = 0; i < board.cells.length; i++) {
      var cell = board.cells[i];
      if (!cell) continue;
      var row = Math.floor(i / board.cols);
      var col = i % board.cols;
      var existing = pearlById[cell.id];
      var p;
      if (existing) {
        p = existing;
        p.row = row;
        p.col = col;
        p.colorId = cell.color;
      } else {
        p = {
          id: cell.id,
          colorId: cell.color,
          row: row,
          col: col,
          x: renderer.cellCenter(col),
          y: renderer.cellCenterY(row),
          scale: 1,
          alpha: 1,
          state: 'idle',
          shadow: 1,
          highlight: 0
        };
      }
      p.targetX = renderer.cellCenter(col);
      p.targetY = renderer.cellCenterY(row);
      byId[cell.id] = p;
      next.push(p);
    }
    pearls = next;
    pearlById = byId;
    renderer.setPearls(pearls);
  }

  /* ---------- 布局 ---------- */
  function relayout() {
    /*
     * app 高度必须取「视口高度」，不能取画布高度。
     * 画布高度是由 app 高度推导出来的，若把画布高度写回 --app-height，
     * 就形成「画布多高 app 就多高」的自缩循环，底部会空出一大块死区。
     */
    var viewportH = root.innerHeight || root.document.documentElement.clientHeight;
    if (viewportH > 0) {
      root.document.documentElement.style.setProperty('--app-height', viewportH + 'px');
    }
    renderer.resize();
    relayoutPearls();
    drawPreview();
  }

  /* 补充队列会就地改写部分珍珠的颜色，这里同步视图层的色值 */
  function syncColors() {
    var cells = state.board.cells;
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      if (!cell) continue;
      var p = pearlById[cell.id];
      if (p) p.colorId = cell.color;
    }
  }

  /* 布局变化后重新对齐所有珍珠的坐标 */
  function relayoutPearls() {
    syncPearls();
    for (var i = 0; i < pearls.length; i++) {
      pearls[i].x = pearls[i].targetX;
      pearls[i].y = pearls[i].targetY;
    }
  }

  /* ---------- 预览条：即将补充的颜色 ---------- */
  function drawPreview() {
    var wrap = $('preview');
    var colors = game.previewColors(state, 6);
    var html = '';
    for (var i = 0; i < colors.length; i++) {
      var f = flavorOf(colors[i]);
      html += '<i style="background:' + f.body + ';box-shadow:inset 0 2px 3px ' + f.accent + ',inset 0 -3px 5px ' + f.dark + '"></i>';
    }
    wrap.innerHTML = html;
  }

  function flavorOf(colorId) {
    for (var i = 0; i < content.flavors.length; i++) {
      if (content.flavors[i].id === colorId) return content.flavors[i];
    }
    return content.flavors[0];
  }

  /* ---------- HUD ---------- */
  function updateHud() {
    $('levelName').textContent = state.level.name;
    $('score').textContent = String(state.score);
    /* 进度按目标封顶，避免出现「目标 75 / 56」这种超出目标的读数 */
    var shown = Math.min(state.cleared, state.level.target);
    $('targetText').textContent = copy.targetLabel.replace('%d', shown).replace('%d', state.level.target);
    $('tapText').textContent = copy.tapLabel.replace('%d', state.tapsLeft);
    var pct = Math.min(100, Math.round((state.cleared / state.level.target) * 100));
    $('progressFill').style.width = pct + '%';
    $('progressBar').setAttribute('aria-valuenow', String(pct));
    drawPreview();
  }

  /* ---------- 浮层徽章 ---------- */
  /*
   * 连锁横幅与提示语都浮在棋盘上，会盖住珍珠。
   * 统一套一层带底衬的徽章，读起来像刻意设计的提示，而不是误挡。
   */
  function setBadge(el, text, className) {
    var badge = el.firstChild;
    if (!badge || badge.tagName !== 'SPAN') {
      badge = root.document.createElement('span');
      badge.className = className;
      el.innerHTML = '';
      el.appendChild(badge);
    }
    badge.textContent = text;
  }

  /* ---------- 连锁横幅 ---------- */
  function showChain(chain) {
    if (chain < 2) return;
    var el = $('chain');
    var words = content.meta.chainWords || [];
    var word = words.length ? words[Math.min(chain - 2, words.length - 1)] : '';
    setBadge(el, copy.chainLabel.replace('%d', chain) + (word ? ' ' + word : ''), 'chain-badge');
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
    chainBannerTimer = 1.1;
  }

  /* ---------- 一次点击的完整动画编排 ---------- */
  function playTimeline(result) {
    queue = result.timeline.slice();
    stepTimer = 0;
    phase = 'popping';
    audio.playPop(1);
  }

  function processStep(dt) {
    if (!queue.length) {
      if (phase === 'popping') {
        phase = 'idle';
        if (pendingRunDone) { finishRun(true); return; }
        if (pendingLevelDone) { finishLevel(); return; }
        if (state.tapsLeft <= 0 && state.cleared < state.level.target) { finishRun(false); return; }
      }
      return;
    }
    stepTimer -= dt;
    if (stepTimer > 0) return;

    var step = queue.shift();
    var i;
    var chain = step.chain;

    /* 1. 消除 */
    for (i = 0; i < step.groups.length; i++) {
      var group = step.groups[i];
      var colorIndex = group[0].color;
      for (var g = 0; g < group.length; g++) {
        var item = group[g];
        var p = pearlById[item.id];
        if (!p) continue;
        p.state = 'popping';
        p.popAge = 0;
        p.popFrom = p.scale;
        p.popColor = item.color;
        p.x = renderer.cellCenter(item.col);
        p.y = renderer.cellCenterY(item.row);
        renderer.burst(p.x, p.y, item.color, 5 + chain * 2, 0.7 + chain * 0.16);
        renderer.ripple(p.x, p.y, flavorOf(item.color).accent, 34 + chain * 12);
      }
    }
    if (chain >= 2) {
      renderer.addShake(3 + chain * 2.4);
      renderer.addFlash('#fff0d8', 0.16 + chain * 0.05);
      renderer.setSugar(0.4 + chain * 0.12);
      showChain(chain);
      audio.playChain(chain);
    } else {
      renderer.addShake(2.2);
    }

    /* 2. 下落 + 补充 */
    for (i = 0; i < step.falls.length; i++) {
      var fall = step.falls[i];
      var fp = pearlById[fall.id];
      if (!fp) continue;
      fp.state = 'falling';
      fp.row = Math.floor(fall.to / state.board.cols);
      fp.col = fall.to % state.board.cols;
      fp.targetX = renderer.cellCenter(fp.col);
      fp.targetY = renderer.cellCenterY(fp.row);
      fp.fallFrom = fp.y;
      fp.fallTo = fp.targetY;
      fp.fallAge = 0;
      fp.fallDur = Math.min(0.42, 0.16 + fall.distance * 0.055);
      fp.x = renderer.cellCenter(fp.col);
    }
    for (i = 0; i < step.spawns.length; i++) {
      var sp = step.spawns[i];
      var np = {
        id: sp.id,
        colorId: sp.color,
        row: sp.row,
        col: sp.col,
        x: renderer.cellCenter(sp.col),
        y: renderer.cellCenterY(sp.row) - 140,
        targetX: renderer.cellCenter(sp.col),
        targetY: renderer.cellCenterY(sp.row),
        scale: 1,
        alpha: 1,
        state: 'falling',
        shadow: 1,
        highlight: 0,
        fallFrom: renderer.cellCenterY(sp.row) - 140,
        fallTo: renderer.cellCenterY(sp.row),
        fallAge: 0,
        fallDur: 0.3
      };
      pearls.push(np);
      pearlById[sp.id] = np;
    }
    renderer.setPearls(pearls);
    syncColors();
    if (step.falls.length) audio.playLand(step.falls.length);

    stepTimer = 0.28 + (step.spawns.length ? 0.16 : 0);
  }

  /* ---------- 每帧更新 ---------- */
  function update(dt) {
    processStep(dt);

    var i;
    for (i = pearls.length - 1; i >= 0; i--) {
      var p = pearls[i];
      if (p.state === 'popping') {
        p.popAge = (p.popAge || 0) + dt;
        var k = Math.min(1, p.popAge / 0.26);
        p.scale = p.popFrom * (1 + 0.28 * Math.sin(k * Math.PI) - k * k);
        p.alpha = 1 - k * k;
        if (k >= 1) {
          pearls.splice(i, 1);
          delete pearlById[p.id];
        }
      } else if (p.state === 'falling') {
        p.fallAge = (p.fallAge || 0) + dt;
        var t = Math.min(1, p.fallAge / p.fallDur);
        var e = 1 - Math.pow(1 - t, 3);
        p.y = p.fallFrom + (p.fallTo - p.fallFrom) * e;
        var squash = Math.max(0, 1 - t) * 0.18 * Math.sin(t * Math.PI);
        p.scale = 1 + squash;
        if (t >= 1) {
          p.y = p.fallTo;
          p.scale = 1;
          p.state = 'idle';
        }
      } else {
        p.x += (p.targetX - p.x) * Math.min(1, dt * 14);
        p.y += (p.targetY - p.y) * Math.min(1, dt * 14);
        p.scale += (1 - p.scale) * Math.min(1, dt * 10);
        p.alpha += (1 - p.alpha) * Math.min(1, dt * 10);
      }
    }
    renderer.setPearls(pearls);

    if (highlightLevel > 0) {
      highlightLevel = Math.max(0, highlightLevel - dt * 1.6);
      for (i = 0; i < pearls.length; i++) {
        pearls[i].highlight = highlightSet[pearls[i].id] ? highlightLevel : 0;
      }
    }
    if (chainBannerTimer > 0) {
      chainBannerTimer -= dt;
      if (chainBannerTimer <= 0) $('chain').classList.remove('pop');
    }
    renderer.updateEffects(dt);
  }

  function frame(stamp) {
    raf = 0;
    if (root.document.hidden) return;
    var now = stamp || performance.now();
    var dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0.016;
    lastFrame = now;
    /* HUD 显隐等布局变化会改变画布 CSS 尺寸，这里同步内部缓冲避免拉伸 */
    if (renderer.ensureSize()) relayoutPearls();
    update(dt);
    renderer.render(now / 1000);
    raf = requestAnimationFrame(frame);
  }

  function loop() {
    if (!raf && !root.document.hidden) raf = requestAnimationFrame(frame);
  }

  /* ---------- 输入 ---------- */
  function pointerToCell(e) {
    var rect = canvas.getBoundingClientRect();
    var x = (e.clientX - rect.left) * (canvas.clientWidth / rect.width);
    var y = (e.clientY - rect.top) * (canvas.clientHeight / rect.height);
    return renderer.hitTest(x, y);
  }

  function onPointerDown(e) {
    if (phase !== 'idle') return;
    if (e.target.closest && e.target.closest('button, a, input, .panel')) return;
    var hit = pointerToCell(e);
    if (!hit) return;
    activePointer = e.pointerId;
    var index = hit.row * state.board.cols + hit.col;
    var group = game.findGroup(state.board, index);
    if (group.length < 3) {
      highlightSet = {};
      for (var i = 0; i < group.length; i++) highlightSet[state.board.cells[group[i]].id] = true;
      highlightLevel = 1;
      audio.playTap();
      flashHint(copy.hintTooFew);
      return;
    }
    audio.resume();
    var result = game.applyTap(state, index);
    if (!result.ok) return;
    highlightSet = {};
    highlightLevel = 0;
    pendingLevelDone = result.levelDone;
    pendingRunDone = result.runDone;
    updateHud();
    playTimeline(result);
    if (result.chain >= 2) {
      renderer.addFlash('#ffffff', 0.1);
    }
  }

  function onPointerMove(e) {
    if (phase !== 'idle' || !e.isPrimary) return;
    var hit = pointerToCell(e);
    if (!hit) { highlightSet = {}; highlightLevel = 0; return; }
    var index = hit.row * state.board.cols + hit.col;
    var group = game.findGroup(state.board, index);
    if (group.length < 3) { highlightSet = {}; highlightLevel = 0; return; }
    var next = {};
    for (var i = 0; i < group.length; i++) next[state.board.cells[group[i]].id] = true;
    var changed = Object.keys(next).length !== Object.keys(highlightSet).length;
    if (!changed) {
      for (var k in next) { if (!highlightSet[k]) { changed = true; break; } }
    }
    if (changed) { highlightSet = next; highlightLevel = 1; }
  }

  function flashHint(text) {
    var el = $('hint');
    setBadge(el, text, 'hint-badge');
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  /* ---------- 流程 ---------- */
  function startRun() {
    state = game.createRun(content);
    pearls = [];
    pearlById = {};
    queue = [];
    phase = 'idle';
    pendingLevelDone = false;
    pendingRunDone = false;
    renderer.clearEffects();
    syncPearls();
    updateHud();
    $('hud').hidden = false;
    $('intro').hidden = true;
    $('result').hidden = true;
    $('boardWrap').hidden = false;
    $('levelName').textContent = state.level.name;
    audio.resume();
    loop();
  }

  function finishLevel() {
    phase = 'levelDone';
    renderer.addFlash('#ffe9c4', 0.4);
    renderer.setSugar(0.9);
    audio.playWin();
    var el = $('levelPanel');
    $('levelTitle').textContent = copy.levelClearTitle.replace('%d', state.levelIndex + 1);
    $('levelLines').innerHTML = copy.levelClearLines.map(function (l) { return '<p>' + l + '</p>'; }).join('');
    el.hidden = false;
    $('nextBtn').textContent = copy.nextButton;
  }

  function nextLevel() {
    game.loadLevel(state, state.levelIndex + 1);
    pearls = [];
    pearlById = {};
    queue = [];
    phase = 'idle';
    pendingLevelDone = false;
    pendingRunDone = false;
    renderer.clearEffects();
    syncPearls();
    updateHud();
    $('levelPanel').hidden = true;
    loop();
  }

  function finishRun(won) {
    phase = 'over';
    if (won) { renderer.addFlash('#ffe9c4', 0.45); audio.playWin(); }
    else { audio.playLose(); }
    var newBest = state.score > bestScore;
    if (newBest) {
      bestScore = state.score;
      root.BobaStorage.write('boba-best-score', String(bestScore));
    }
    $('resultTitle').textContent = won ? copy.finalTitle : copy.gameOverTitle;
    $('resultScoreLabel').textContent = copy.finalScoreLabel;
    $('resultChainLabel').textContent = copy.finalChainLabel;
    $('resultBestLabel').textContent = copy.finalBestLabel;
    $('resultChain').textContent = copy.finalChain.replace('%d', state.bestChain);
    $('resultScore').textContent = copy.finalScore.replace('%d', state.score);
    $('resultBest').textContent = copy.finalBest.replace('%d', Math.max(bestScore, state.score));
    $('bestFlag').hidden = !newBest;
    $('result').hidden = false;
    $('againBtn').textContent = copy.againButton;
    buildShareCard(won);
  }

  /* ---------- 成绩卡 ---------- */
  function buildShareCard(won) {
    var card = $('shareCard');
    var c = card.getContext('2d');
    var W = 720, H = 960;
    card.width = W;
    card.height = H;
    var g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2a1610');
    g.addColorStop(0.6, '#462117');
    g.addColorStop(1, '#1d0f0b');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    var halo = c.createRadialGradient(W / 2, 180, 0, W / 2, 180, 460);
    halo.addColorStop(0, 'rgba(255,186,122,0.34)');
    halo.addColorStop(1, 'rgba(255,186,122,0)');
    c.fillStyle = halo;
    c.fillRect(0, 0, W, H);

    /* 珍珠装饰 */
    var cell = 74;
    var cols = 6;
    var rows = 5;
    var gw = cols * cell;
    var gh = rows * cell;
    var ox = (W - gw) / 2;
    var oy = 300;
    var seed = state.bestChain * 31 + state.score;
    for (var r = 0; r < rows; r++) {
      for (var i = 0; i < cols; i++) {
        seed = (seed * 9301 + 49297) % 233280;
        var f = content.flavors[Math.floor((seed / 233280) * content.flavors.length) % content.flavors.length];
        var x = ox + i * cell + cell / 2;
        var y = oy + r * cell + cell / 2;
        var rad = cell * 0.4;
        var bg = c.createRadialGradient(x - rad * 0.3, y - rad * 0.34, rad * 0.05, x, y, rad);
        bg.addColorStop(0, f.accent);
        bg.addColorStop(0.35, f.light);
        bg.addColorStop(0.75, f.body);
        bg.addColorStop(1, f.dark);
        c.fillStyle = bg;
        c.beginPath();
        c.arc(x, y, rad, 0, Math.PI * 2);
        c.fill();
        var hl = c.createRadialGradient(x - rad * 0.32, y - rad * 0.38, 0, x - rad * 0.32, y - rad * 0.38, rad * 0.5);
        hl.addColorStop(0, 'rgba(255,255,255,0.9)');
        hl.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = hl;
        c.beginPath();
        c.ellipse(x - rad * 0.3, y - rad * 0.36, rad * 0.42, rad * 0.3, -0.5, 0, Math.PI * 2);
        c.fill();
      }
    }

    c.textAlign = 'center';
    c.fillStyle = '#fff3e0';
    c.font = '800 64px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(content.meta.title, W / 2, 140);
    c.fillStyle = 'rgba(255,225,190,0.75)';
    c.font = '400 26px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(won ? copy.finalTitle : copy.gameOverTitle, W / 2, 196);

    c.fillStyle = '#ffd9a8';
    c.font = '800 84px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(String(state.score), W / 2, H - 190);
    c.fillStyle = 'rgba(255,225,190,0.8)';
    c.font = '400 30px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(copy.finalChainLabel + ' ×' + state.bestChain, W / 2, H - 128);
    c.fillStyle = 'rgba(255,225,190,0.55)';
    c.font = '400 24px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(copy.finalBestLabel + ' ' + Math.max(bestScore, state.score), W / 2, H - 86);
  }

  function saveCard() {
    var card = $('shareCard');
    var status = $('saveStatus');
    var api = root.xhs && root.xhs.miniTool;
    if (!api || typeof api.saveImageToPhotosAlbum !== 'function') {
      status.textContent = copy.saveUnavailable;
      return;
    }
    try {
      var dataUrl = card.toDataURL('image/png');
      Promise.resolve(api.saveImageToPhotosAlbum({ filePath: dataUrl })).then(function () {
        status.textContent = copy.saved;
      }).catch(function () {
        status.textContent = copy.saveFailed;
      });
    } catch (error) {
      status.textContent = copy.saveFailed;
    }
  }

  /* ---------- 事件绑定 ---------- */
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', function () { highlightSet = {}; highlightLevel = 0; });
  root.addEventListener('resize', relayout);
  root.addEventListener('orientationchange', function () { setTimeout(relayout, 220); });
  root.document.addEventListener('visibilitychange', function () {
    if (root.document.hidden) {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    } else {
      lastFrame = 0;
      loop();
    }
  });

  $('startBtn').addEventListener('click', function () { audio.resume(); audio.playUi(); startRun(); });
  $('nextBtn').addEventListener('click', function () { audio.playUi(); nextLevel(); });
  $('againBtn').addEventListener('click', function () { audio.playUi(); startRun(); });
  $('saveBtn').addEventListener('click', function () { audio.playUi(); saveCard(); });
  $('muteBtn').addEventListener('click', function () {
    muted = audio.setMuted(!muted);
    root.BobaStorage.write('boba-muted', muted ? 'true' : 'false');
    $('muteBtn').textContent = muted ? copy.muteOff : copy.muteOn;
    $('muteBtn').setAttribute('aria-pressed', String(!muted));
    if (!muted) audio.playUi();
  });

  /* ---------- 初始化 ---------- */
  function loadPreferences() {
    var storedMuted = root.BobaStorage.read('boba-muted');
    if (storedMuted === 'true') {
      muted = audio.setMuted(true);
      $('muteBtn').textContent = copy.muteOff;
      $('muteBtn').setAttribute('aria-pressed', 'false');
    }
    var storedBest = Number(root.BobaStorage.read('boba-best-score')) || 0;
    bestScore = storedBest;
    $('bestHint').textContent = storedBest ? '历史最佳 ' + storedBest : '';
  }

  function init() {
    /* 调试与自检钩子：供自动化检查定位格子坐标 */
    root.__bobaRenderer = renderer;
    Object.defineProperty(root, '__bobaState', { get: function () { return state; }, configurable: true });
    $('title').textContent = copy.startTitle;
    $('subtitle').textContent = copy.subtitle;
    $('startLines').innerHTML = copy.startLines.map(function (l) { return '<p>' + l + '</p>'; }).join('');
    $('startBtn').textContent = copy.startButton;
    $('hint').textContent = copy.hintShort;
    $('levelName').textContent = state.level.name;
    relayout();
    updateHud();
    loadPreferences();
    root.BobaStorage.loaded.then(loadPreferences);
    /* 首页也播放背景珍珠，视觉不留空 */
    syncPearls();
    loop();
  }

  init();
})(typeof window !== 'undefined' ? window : global);
