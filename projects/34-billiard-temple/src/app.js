/*
 * 弹珠神殿 · 主逻辑
 * 负责瞄准交互、击球推进、HUD、殿堂推进、宝石图鉴与技巧卡。
 * 业务内容全部来自 src/content/content.json，玩法状态在 src/game.js。
 */
(function (root) {
  'use strict';

  var content = root.CONTENT;
  var copy = content.copy;
  var game = root.BilliardGame;
  var renderer = null;
  var audio = root.BilliardAudio;
  var storage = root.BilliardStorage;

  var state = null;
  var phase = 'intro';
  var aiming = false;
  var aimAngle = 0;
  var aimPower = 0;
  var aimDist = 0;
  var bestScore = 0;
  var codex = [];
  var muted = false;
  var raf = 0;
  var lastFrame = 0;

  /* 最小拖拽距离（虚拟殿堂像素）：低于这个值当作误触，不扣杆数 */
  var MIN_DRAG = 14;

  function $(id) { return root.document.getElementById(id); }

  /* ---------- 布局 ---------- */
  function relayout() {
    var viewportH = root.innerHeight || root.document.documentElement.clientHeight;
    if (viewportH > 0) {
      root.document.documentElement.style.setProperty('--app-height', viewportH + 'px');
    }
    renderer.resize();
  }

  function themeOf(level) {
    return content.meta.themes[level.theme] || content.meta.themes.gold;
  }

  function gemStyle(index) {
    return content.meta.gems[index] || content.meta.gems[0];
  }

  /* ---------- HUD ---------- */
  function updateHud() {
    $('chamberName').textContent = state.level.name;
    $('levelHint').textContent = state.level.hint || '';
    $('score').textContent = String(state.score);
    $('shotsLeft').textContent = String(state.shotsLeft);
    $('gemCount').textContent = state.gemsLeft + '/' + state.level.gems.length;
    var pct = Math.round((state.levelIndex / content.levels.length) * 100);
    $('progressFill').style.width = pct + '%';
    $('progressBar').setAttribute('aria-valuenow', String(pct));
    $('shotBtn').disabled = state.phase !== 'aim' || state.shotsLeft <= 0;
  }

  /* ---------- 瞄准 ---------- */
  function onPointerDown(e) {
    if (phase !== 'play' || !state || state.phase !== 'aim') return;
    if (e.target.closest && e.target.closest('button, a, input, .panel')) return;
    audio.resume();
    aiming = true;
    aimDist = 0;
    aimPower = 0;
    /* 抓住指针：拖到画面外再松手，这一杆照样打出去 */
    if (e.pointerId !== undefined && this.setPointerCapture) {
      try {
        this.setPointerCapture(e.pointerId);
      } catch (error) {
        /* 某些内核不支持，忽略即可 */
      }
    }
    updateAim(e);
  }

  function onPointerMove(e) {
    if (!aiming) return;
    updateAim(e);
  }

  function onPointerUp(e) {
    if (!aiming) return;
    aiming = false;
    if (e && e.pointerId !== undefined && this.releasePointerCapture) {
      try {
        this.releasePointerCapture(e.pointerId);
      } catch (error) {
        /* 忽略 */
      }
    }
    if (aimDist < MIN_DRAG) return;
    fireShot();
  }

  function updateAim(e) {
    var p = renderer.toArena(e.clientX, e.clientY);
    var dx = p.x - state.ball.x;
    var dy = p.y - state.ball.y;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;
    aimDist = len;
    aimAngle = game.aimAngle(dx, dy);
    aimPower = game.dragSpeed(len);
  }

  function fireShot() {
    var shot = game.launch(state, aimAngle, aimPower);
    if (!shot) return;
    aimPower = 0;
    aimDist = 0;
    audio.playShoot(1);
    updateHud();
  }

  /* ---------- 每帧 ---------- */
  function update(dt) {
    if (!state) return;
    state.time += dt;
    renderer.updateEffects(dt);

    if (state.phase === 'roll' && state.shot) {
      var before = state.shot.bounces;
      var beforeGems = state.shot.collected.length;
      game.advanceShot(state, state.shot, dt);
      if (state.shot.bounces > before) audio.playBounce(state.shot.bounces);
      if (state.shot.collected.length > beforeGems) {
        for (var i = beforeGems; i < state.shot.collected.length; i++) {
          var gem = state.gems[state.shot.collected[i]];
          var style = gemStyle(state.levelIndex);
          renderer.burst(gem.x, gem.y, style.glow);
          audio.playGem(state.levelIndex);
        }
        updateHud();
      }
      if (state.shot.done) {
        game.settle(state);
        if (state.phase === 'cleared') onChamberClear();
        else if (state.phase === 'out') onChamberFail();
        else updateHud();
      }
    }
  }

  function frame(stamp) {
    raf = 0;
    if (root.document.hidden) return;
    var now = stamp || performance.now();
    var dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0.016;
    lastFrame = now;
    if (renderer.ensureSize()) relayout();
    update(dt);
    renderer.render(now / 1000, buildView());
    raf = requestAnimationFrame(frame);
  }

  function loop() {
    if (!raf && !root.document.hidden) raf = requestAnimationFrame(frame);
  }

  /* ---------- 渲染数据 ---------- */
  function buildView() {
    var theme = themeOf(state.level);
    var style = gemStyle(state.levelIndex);
    var rects = game.levelRects(state, state.shot ? state.shot.t : state.time);
    var blocks = state.level.blocks || [];
    var props = [];
    for (var i = 0; i < rects.length; i++) {
      if (i < blocks.length) continue;
      props.push(rects[i]);
    }
    var gems = [];
    for (var j = 0; j < state.gems.length; j++) {
      gems.push({
        x: state.gems[j].x,
        y: state.gems[j].y,
        taken: state.gems[j].taken,
        color: style.color,
        glow: style.glow
      });
    }
    var view = {
      theme: theme,
      ball: state.ball,
      ballColor: content.meta.ball.color,
      ballCore: content.meta.ball.core,
      blocks: blocks,
      props: props,
      gems: gems,
      gemColor: style.glow,
      trail: state.shot ? state.shot.path : null
    };
    if (aiming && state.phase === 'aim') {
      view.aim = { hits: game.raycast(state, aimAngle), power: aimPower };
    }
    return view;
  }

  /* ---------- 流程 ---------- */
  function startRun() {
    state = game.createRun(content);
    game.loadChamber(state, 0);
    root.__templeState = state;
    phase = 'play';
    renderer.clearEffects();
    $('hud').hidden = false;
    $('tools').hidden = false;
    $('intro').hidden = true;
    $('levelPanel').hidden = true;
    $('result').hidden = true;
    updateHud();
    audio.resume();
    loop();
  }

  function onChamberClear() {
    phase = 'clear';
    audio.playSuccess();
    if (codex.indexOf(state.levelIndex) < 0) codex.push(state.levelIndex);
    storage.write('temple-codex', codex);
    $('levelTitle').textContent = copy.chamberClearTitle.replace('%d', state.levelIndex + 1);
    var lines = $('levelLines');
    lines.innerHTML = '';
    var texts = copy.chamberClearLines.slice();
    if (state.shotsUsed === 1) texts.unshift(copy.oneShotBonus + '！');
    for (var i = 0; i < texts.length; i++) {
      var p = root.document.createElement('p');
      p.textContent = texts[i];
      lines.appendChild(p);
    }
    $('nextBtn').textContent = copy.nextButton;
    $('levelPanel').hidden = false;
    updateHud();
  }

  function onChamberFail() {
    phase = 'fail';
    audio.playFail();
    $('levelTitle').textContent = copy.chamberFailTitle;
    var lines = $('levelLines');
    lines.innerHTML = '';
    for (var i = 0; i < copy.chamberFailLines.length; i++) {
      var p = root.document.createElement('p');
      p.textContent = copy.chamberFailLines[i];
      lines.appendChild(p);
    }
    $('nextBtn').textContent = copy.retryButton;
    $('levelPanel').hidden = false;
    updateHud();
  }

  function nextLevel() {
    $('levelPanel').hidden = true;
    if (state.levelIndex >= content.levels.length - 1) {
      finishRun();
      return;
    }
    game.loadChamber(state, state.levelIndex + 1);
    phase = 'play';
    renderer.clearEffects();
    updateHud();
  }

  function retryLevel() {
    $('levelPanel').hidden = true;
    game.loadChamber(state, state.levelIndex);
    phase = 'play';
    renderer.clearEffects();
    updateHud();
  }

  function finishRun() {
    phase = 'done';
    storage.write('temple-best-score', state.score);
    var best = Math.max(bestScore, state.score);
    var isNew = state.score > bestScore;
    $('resultTitle').textContent = copy.finalTitle;
    $('resultScore').textContent = copy.finalScore.replace('%d', state.score);
    $('resultBest').textContent = copy.finalBest.replace('%d', best);
    $('resultGems').textContent = String(codex.length);
    $('bestFlag').hidden = !isNew;
    $('againBtn').textContent = copy.againButton;
    $('shelfLabel').textContent = copy.finalCodexLabel;
    buildCodex();
    buildTrickCard();
    $('result').hidden = false;
    updateHud();
  }

  /* ---------- 宝石图鉴 ---------- */
  function buildCodex() {
    var wrap = $('codex');
    wrap.innerHTML = '';
    for (var i = 0; i < content.meta.gems.length; i++) {
      var style = content.meta.gems[i];
      var got = codex.indexOf(i) >= 0;
      var cell = root.document.createElement('div');
      cell.className = got ? 'codex-cell on' : 'codex-cell';
      var gem = root.document.createElement('span');
      gem.className = 'codex-gem';
      gem.style.background = got ? style.color : 'rgba(255,255,255,0.12)';
      var name = root.document.createElement('small');
      name.textContent = got ? style.name : copy.codexLocked;
      cell.appendChild(gem);
      cell.appendChild(name);
      wrap.appendChild(cell);
    }
  }

  /* ---------- 技巧卡 ---------- */
  function buildTrickCard() {
    var canvas = $('shareCard');
    var c = canvas.getContext('2d');
    var W = canvas.width;
    var H = canvas.height;
    var theme = themeOf(content.levels[content.levels.length - 1]);

    var grad = c.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, theme.top);
    grad.addColorStop(0.55, theme.bottom);
    grad.addColorStop(1, theme.floor);
    c.fillStyle = grad;
    c.fillRect(0, 0, W, H);

    c.textAlign = 'center';
    c.fillStyle = theme.wall;
    c.font = '800 62px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(content.meta.title, W / 2, 108);
    c.fillStyle = 'rgba(255,255,255,0.62)';
    c.font = '400 26px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(copy.finalTitle, W / 2, 152);

    /* 最佳一杆的轨迹 */
    var path = state.best ? state.best.path : null;
    var boxW = 470;
    var boxH = 600;
    var boxX = (W - boxW) / 2;
    var boxY = 190;
    c.strokeStyle = 'rgba(255,255,255,0.18)';
    c.lineWidth = 2;
    c.strokeRect(boxX, boxY, boxW, boxH);

    if (path && path.length > 1) {
      var sx = boxW / game.ARENA_W;
      var sy = boxH / game.ARENA_H;
      c.save();
      c.beginPath();
      c.rect(boxX, boxY, boxW, boxH);
      c.clip();
      c.strokeStyle = 'rgba(255,233,184,0.9)';
      c.lineWidth = 5;
      c.lineJoin = 'round';
      c.beginPath();
      for (var i = 0; i < path.length; i++) {
        var px = boxX + path[i].x * sx;
        var py = boxY + path[i].y * sy;
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.stroke();
      c.restore();
      c.fillStyle = 'rgba(255,255,255,0.72)';
      c.font = '600 24px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
      c.fillText(
        copy.finalTrickHint.replace('%d', state.best.wallBounces),
        W / 2,
        boxY + boxH + 42
      );
    } else {
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.font = '400 26px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
      c.fillText(copy.finalTrickEmpty, W / 2, boxY + boxH / 2);
    }

    c.fillStyle = theme.wall;
    c.font = '800 76px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(String(state.score), W / 2, 880);
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.font = '400 24px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(copy.finalScoreLabel + ' ' + state.score, W / 2, 916);
    c.fillText('长按图片可保存', W / 2, 944);
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

  /* ---------- 事件 ---------- */
  function bind() {
    var canvasEl = $('field');
    canvasEl.addEventListener('pointerdown', onPointerDown);
    canvasEl.addEventListener('pointermove', onPointerMove);
    canvasEl.addEventListener('pointerup', onPointerUp);
    canvasEl.addEventListener('pointercancel', onPointerUp);

    root.addEventListener('resize', relayout);
    root.addEventListener('orientationchange', function () { setTimeout(relayout, 220); });
    root.document.addEventListener('visibilitychange', function () {
      if (!root.document.hidden) loop();
    });

    $('startBtn').addEventListener('click', startRun);
    $('nextBtn').addEventListener('click', function () {
      if (phase === 'fail') retryLevel();
      else nextLevel();
    });
    $('againBtn').addEventListener('click', startRun);
    $('saveBtn').addEventListener('click', saveCard);
    $('shotBtn').addEventListener('click', function () {
      /* 键盘/无障碍兜底：直接用当前瞄准角度打一杆 */
      if (state && state.phase === 'aim' && state.shotsLeft > 0) {
        audio.resume();
        if (aimPower < 40) aimPower = game.MAX_SPEED * 0.7;
        fireShot();
      }
    });

    $('muteBtn').addEventListener('click', function () {
      muted = !muted;
      audio.setMuted(muted);
      this.textContent = muted ? copy.muteOff : copy.muteOn;
      this.setAttribute('aria-pressed', muted ? 'false' : 'true');
      storage.write('temple-muted', muted ? 1 : 0);
    });
  }

  /* ---------- 启动 ---------- */
  function init() {
    renderer = root.BilliardRender.createRenderer($('field'));
    renderer.resize();
    root.__templeRenderer = renderer;

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
    $('shotsLabel').textContent = copy.budgetLabel;
    $('gemLabel').textContent = copy.gemLabel;

    bind();

    storage.loaded.then(function () {
      bestScore = Number(storage.read('temple-best-score')) || 0;
      var saved = storage.read('temple-codex');
      codex = [];
      if (saved) {
        try {
          var list = typeof saved === 'string' ? JSON.parse(saved) : saved;
          if (list && list.length) codex = list.slice();
        } catch (error) {
          codex = [];
        }
      }
      $('bestHint').textContent = bestScore ? copy.finalBestLabel + ' ' + bestScore : '';
      var muteFlag = Number(storage.read('temple-muted')) || 0;
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
  root.__templeState = null;
  root.__templePhase = function () { return phase; };
})(typeof window !== 'undefined' ? window : global);
