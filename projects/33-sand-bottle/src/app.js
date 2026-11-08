/*
 * 彩沙瓶 · 主逻辑
 * 负责界面状态、调色板与工具栏、指针交互、HUD、关卡推进、收藏架与纪录卡。
 * 业务内容全部来自 src/content/content.json，玩法状态在 src/game.js。
 */
(function (root) {
  'use strict';

  var content = root.CONTENT;
  var copy = content.copy;
  var game = root.SandGame;
  var renderer = null;
  var audio = root.SandAudio;
  var storage = root.SandStorage;

  var CELL_H = root.SandRender.CELL_H;
  var state = null;
  var phase = 'intro';
  var dragCol = -1;
  var bestScore = 0;
  var muted = false;

  function $(id) { return root.document.getElementById(id); }

  /* ---------- 布局 ---------- */
  function relayout() {
    var viewportH = root.innerHeight || root.document.documentElement.clientHeight;
    if (viewportH > 0) {
      root.document.documentElement.style.setProperty('--app-height', viewportH + 'px');
    }
    renderer.resize();
  }

  /* ---------- 调色板 ---------- */
  function buildPalette() {
    var wrap = $('swatches');
    var html = '';
    for (var i = 0; i < content.meta.palette.length; i++) {
      html += '<button class="swatch" type="button" role="radio" data-color="' + i + '" ' +
        'style="background:' + content.meta.palette[i] + '" title="' +
        content.meta.paletteNames[i] + '" aria-label="' + content.meta.paletteNames[i] + '"></button>';
    }
    wrap.innerHTML = html;
    var buttons = wrap.querySelectorAll('.swatch');
    for (var j = 0; j < buttons.length; j++) {
      buttons[j].addEventListener('click', onPickColor);
    }
  }

  function onPickColor(e) {
    var index = Number(e.currentTarget.getAttribute('data-color'));
    if (isNaN(index)) return;
    state.palette = index;
    updatePalette();
    audio.resume();
  }

  function updatePalette() {
    var buttons = $('swatches').querySelectorAll('.swatch');
    for (var i = 0; i < buttons.length; i++) {
      var on = Number(buttons[i].getAttribute('data-color')) === state.palette;
      buttons[i].className = on ? 'swatch on' : 'swatch';
      buttons[i].setAttribute('aria-checked', on ? 'true' : 'false');
    }
  }

  /* ---------- 工具 ---------- */
  function onPickTool(e) {
    var tool = e.currentTarget.getAttribute('data-tool');
    if (!tool) return;
    state.tool = tool;
    updateTools();
    audio.resume();
  }

  function updateTools() {
    var buttons = root.document.querySelectorAll('.tool');
    for (var i = 0; i < buttons.length; i++) {
      var on = buttons[i].getAttribute('data-tool') === state.tool;
      buttons[i].className = on ? 'tool on' : 'tool';
      buttons[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  /* ---------- HUD ---------- */
  function updateHud() {
    $('levelName').textContent = state.level.name;
    $('levelHint').textContent = state.level.hint || '';
    $('score').textContent = String(state.score);
    var pct = Math.round((state.levelIndex / content.levels.length) * 100);
    $('progressFill').style.width = pct + '%';
    $('progressBar').setAttribute('aria-valuenow', String(pct));

    var left = Math.max(0, state.budget - state.used);
    $('budgetText').textContent = copy.budgetLabel + ' ' + left;

    var result = game.evaluate(state);
    var ratio = Math.min(1, result.ratio);
    $('matchFill').style.width = Math.round(ratio * 100) + '%';
    $('matchText').textContent = Math.round(result.ratio * 100) + '%';
    $('sealBtn').disabled = !result.passed;
    /* 按钮上直接写清楚差在哪一条：颜色、沙量、平整度还是山的高度 */
    if (!result.passed) $('sealBtn').textContent = result.reason || copy.sealHint;
    else $('sealBtn').textContent = copy.sealButton;
  }

  /* ---------- 反馈徽章 ---------- */
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

  function flashBadge(text) {
    var el = $('flash');
    setBadge(el, text, 'flash-badge');
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }

  function hintBadge(text) {
    var el = $('hint');
    setBadge(el, text, 'hint-badge');
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  /* ---------- 画布交互 ---------- */
  function pointerCol(e) {
    var rect = $('field').getBoundingClientRect();
    var x = (e.clientX - rect.left) * ($('field').clientWidth / rect.width);
    return renderer.colAt(x);
  }

  function onPointerDown(e) {
    if (phase !== 'building') return;
    if (e.target.closest && e.target.closest('button, a, input, .panel')) return;
    audio.resume();
    var col = pointerCol(e);
    if (col < 0) return;
    if (state.tool === 'pour') doPour(col);
    else if (state.tool === 'scoop') doScoop(col);
    else dragCol = col;
  }

  function onPointerMove(e) {
    if (phase !== 'building' || state.tool !== 'shape' || dragCol < 0) return;
    var col = pointerCol(e);
    if (col < 0 || col === dragCol) return;
    var res = game.shape(state, dragCol, col);
    if (!res || res.type === 'empty' || res.type === 'overflow') return;
    dragCol = col;
    audio.playShape();
    updateHud();
  }

  function onPointerUp() {
    dragCol = -1;
  }

  function doPour(col) {
    var res = game.pour(state, col);
    if (!res) return;
    if (res.type === 'full') {
      hintBadge(copy.budgetLabel + '用完了');
      return;
    }
    if (res.type === 'overflow') {
      hintBadge('这一列已经满了');
      return;
    }
    audio.playPour();
    var geom = renderer.getGeom();
    var x = geom.cx - geom.inner + col * geom.cellW;
    var targetY = geom.bottom - state.cols[col].length * CELL_H;
    renderer.dropGrain(x, geom.neckTop + 24, content.meta.palette[res.color], targetY);
    updateHud();
  }

  function doScoop(col) {
    var res = game.scoop(state, col);
    if (!res || res.type === 'empty') {
      hintBadge('这里没有沙');
      return;
    }
    audio.playScoop();
    updateHud();
  }

  /* ---------- 流程 ---------- */
  function startRun() {
    state = game.createRun(content);
    root.__sandState = state;
    phase = 'building';
    renderer.clearEffects();
    $('hud').hidden = false;
    $('palette').hidden = false;
    $('tools').hidden = false;
    $('intro').hidden = true;
    $('levelPanel').hidden = true;
    $('result').hidden = true;
    updatePalette();
    updateTools();
    updateHud();
    audio.resume();
    loop();
  }

  function onSeal() {
    if (phase !== 'building') return;
    var result = game.evaluate(state);
    if (!result.passed) {
      hintBadge(copy.sealHint);
      return;
    }
    var bottle = game.seal(state);
    if (!bottle) {
      hintBadge(copy.sealHint);
      return;
    }
    audio.playSeal();
    state.score += 500 + Math.round(result.ratio * 100) * 12;
    phase = 'sealed';
    $('levelTitle').textContent = copy.levelClearTitle.replace('%d', state.levelIndex + 1);
    var lines = $('levelLines');
    lines.innerHTML = '';
    for (var i = 0; i < copy.levelClearLines.length; i++) {
      var p = root.document.createElement('p');
      p.textContent = copy.levelClearLines[i];
      lines.appendChild(p);
    }
    $('nextBtn').textContent = copy.nextButton;
    $('levelPanel').hidden = false;
    updateHud();
  }

  function nextLevel() {
    $('levelPanel').hidden = true;
    if (state.levelIndex >= content.levels.length - 1) {
      finishRun();
      return;
    }
    game.loadLevel(state, state.levelIndex + 1);
    phase = 'building';
    renderer.clearEffects();
    updatePalette();
    updateTools();
    updateHud();
  }

  function finishRun() {
    phase = 'done';
    audio.playSuccess();
    storage.write('sand-best-score', state.score);
    storage.write('sand-bottles', state.bottles);
    var best = Math.max(bestScore, state.score);
    var isNew = state.score > bestScore;
    $('resultTitle').textContent = copy.finalTitle;
    $('resultScoreLabel').textContent = copy.finalScoreLabel;
    $('resultBottlesLabel').textContent = copy.finalBottlesLabel;
    $('resultBestLabel').textContent = copy.finalBestLabel;
    $('resultScore').textContent = copy.finalScore.replace('%d', state.score);
    $('resultBottles').textContent = String(state.sealed);
    $('resultBest').textContent = copy.finalBest.replace('%d', best);
    $('bestFlag').hidden = !isNew;
    $('againBtn').textContent = copy.againButton;
    $('shelfLabel').textContent = copy.finalShelfLabel;
    buildShareCard();
    buildShelf();
    $('result').hidden = false;
    updateHud();
  }

  /* ---------- 收藏架 ---------- */
  function drawMiniBottle(c, x, y, w, h, layers, palette) {
    var cols = layers.length;
    var cellW = w / cols;
    var maxH = 0;
    for (var i = 0; i < cols; i++) {
      if (layers[i].length > maxH) maxH = layers[i].length;
    }
    for (var c2 = 0; c2 < cols; c2++) {
      for (var r = 0; r < layers[c2].length; r++) {
        var cellH = h / 24;
        c.fillStyle = palette[layers[c2][r]] || '#cccccc';
        c.fillRect(x + c2 * cellW, y + h - (r + 1) * cellH, cellW + 0.4, cellH + 0.4);
      }
    }
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 3;
    c.strokeRect(x, y, w, h);
  }

  function buildShelf() {
    var canvas = $('shelf');
    var c = canvas.getContext('2d');
    var W = canvas.width;
    var H = canvas.height;
    c.clearRect(0, 0, W, H);
    if (!state.bottles.length) {
      c.fillStyle = 'rgba(58,42,32,0.45)';
      c.font = '400 24px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
      c.textAlign = 'center';
      c.fillText(copy.finalShelfEmpty, W / 2, H / 2 + 8);
      c.textAlign = 'left';
      return;
    }
    var count = state.bottles.length;
    var slotW = W / count;
    var bw = Math.min(58, slotW - 10);
    var bh = 96;
    for (var i = 0; i < count; i++) {
      var bottle = state.bottles[i];
      var bx = slotW * i + (slotW - bw) / 2;
      var by = H / 2 - bh / 2;
      drawMiniBottle(c, bx, by, bw, bh, bottle.colors, content.meta.palette);
    }
  }

  /* ---------- 纪录卡 ---------- */
  function buildShareCard() {
    var canvas = $('shareCard');
    var c = canvas.getContext('2d');
    var W = canvas.width;
    var H = canvas.height;
    var palette = content.meta.palette;

    var grad = c.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#f7ead3');
    grad.addColorStop(0.55, '#eed7b2');
    grad.addColorStop(1, '#d9b98c');
    c.fillStyle = grad;
    c.fillRect(0, 0, W, H);

    c.textAlign = 'center';
    c.fillStyle = '#4a3020';
    c.font = '800 62px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(content.meta.title, W / 2, 120);
    c.fillStyle = 'rgba(74,48,32,0.62)';
    c.font = '400 28px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(copy.finalTitle, W / 2, 170);

    /* 最后一个瓶子 */
    var last = state.bottles.length ? state.bottles[state.bottles.length - 1] : null;
    if (last) {
      var bw = 300;
      var bh = 430;
      var bx = (W - bw) / 2;
      var by = 220;
      var layers = last.colors;
      var cols = layers.length;
      var cellW = bw / cols;
      var cellH = 11;
      for (var col = 0; col < cols; col++) {
        for (var r = 0; r < layers[col].length; r++) {
          c.fillStyle = palette[layers[col][r]] || '#cccccc';
          c.fillRect(bx + col * cellW, by + bh - (r + 1) * cellH, cellW + 0.5, cellH + 0.5);
        }
      }
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.lineWidth = 10;
      c.strokeRect(bx, by, bw, bh);
    }

    c.fillStyle = '#4a3020';
    c.font = '800 84px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(String(state.score), W / 2, 760);
    c.fillStyle = 'rgba(74,48,32,0.6)';
    c.font = '400 26px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(copy.finalScoreLabel + ' ' + state.score, W / 2, 826);
    c.fillText(copy.finalBestLabel + ' ' + Math.max(bestScore, state.score), W / 2, 864);

    c.fillStyle = '#c86b4a';
    c.globalAlpha = 0.5;
    c.fillRect(W / 2 - 90, 898, 180, 3);
    c.globalAlpha = 1;
    c.fillStyle = 'rgba(74,48,32,0.4)';
    c.font = '400 22px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText('长按图片可保存', W / 2, 930);
    c.textAlign = 'left';
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

  /* ---------- 每帧更新 ---------- */
  function update(dt) {
    renderer.updateEffects(dt);
  }

  var raf = 0;
  var lastFrame = 0;

  function frame(stamp) {
    raf = 0;
    if (root.document.hidden) return;
    var now = stamp || performance.now();
    var dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0.016;
    lastFrame = now;
    if (renderer.ensureSize()) relayout();
    update(dt);
    renderer.render(now / 1000, {
      meta: content.meta,
      level: state.level,
      cols: state.cols,
      palette: state.palette,
      tool: state.tool,
      target: state.target
    });
    raf = requestAnimationFrame(frame);
  }

  function loop() {
    if (!raf && !root.document.hidden) raf = requestAnimationFrame(frame);
  }

  /* ---------- 事件绑定 ---------- */
  function bind() {
    var canvasEl = $('field');
    canvasEl.addEventListener('pointerdown', onPointerDown);
    canvasEl.addEventListener('pointermove', onPointerMove);
    canvasEl.addEventListener('pointerup', onPointerUp);
    canvasEl.addEventListener('pointercancel', onPointerUp);
    canvasEl.addEventListener('pointerleave', onPointerUp);

    root.addEventListener('resize', relayout);
    root.addEventListener('orientationchange', function () { setTimeout(relayout, 220); });
    root.document.addEventListener('visibilitychange', function () {
      if (!root.document.hidden) loop();
    });

    var tools = root.document.querySelectorAll('.tool');
    for (var i = 0; i < tools.length; i++) {
      tools[i].addEventListener('click', onPickTool);
    }

    $('startBtn').addEventListener('click', startRun);
    $('nextBtn').addEventListener('click', nextLevel);
    $('sealBtn').addEventListener('click', onSeal);
    $('againBtn').addEventListener('click', startRun);
    $('saveBtn').addEventListener('click', saveCard);

    $('muteBtn').addEventListener('click', function () {
      muted = !muted;
      audio.setMuted(muted);
      this.textContent = muted ? copy.muteOff : copy.muteOn;
      this.setAttribute('aria-pressed', muted ? 'false' : 'true');
      storage.write('sand-muted', muted ? 1 : 0);
    });
  }

  /* ---------- 启动 ---------- */
  function init() {
    renderer = root.SandRender.createRenderer($('field'));
    renderer.resize();
    root.__sandRenderer = renderer;

    $('subtitle').textContent = content.brand.tagline;
    $('startTitle').textContent = content.brand.toolName;
    var lines = $('startLines');
    lines.innerHTML = '';
    for (var i = 0; i < copy.startLines.length; i++) {
      var p = root.document.createElement('p');
      p.textContent = copy.startLines[i];
      lines.appendChild(p);
    }
    $('startBtn').textContent = copy.startButton;

    buildPalette();
    bind();

    storage.loaded.then(function () {
      var best = Number(storage.read('sand-best-score')) || 0;
      bestScore = best;
      $('bestHint').textContent = best ? copy.finalBestLabel + ' ' + best : '';
      var muteFlag = Number(storage.read('sand-muted')) || 0;
      if (muteFlag) {
        muted = true;
        audio.setMuted(true);
        $('muteBtn').textContent = copy.muteOff;
        $('muteBtn').setAttribute('aria-pressed', 'false');
      }
    });
  }

  if (root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* 自检钩子 */
  root.__sandState = null;
})(typeof window !== 'undefined' ? window : global);
