/*
 * 毽子连击 · 主程序
 * 负责：动画循环、踢判定编排、UI 流程、输入处理、纪录卡。
 */
(function (root) {
  'use strict';

  var content = root.CONTENT;
  var copy = content.copy;
  var $ = function (id) { return document.getElementById(id); };

  var canvas = $('field');
  var renderer = root.JianziRender.createRenderer(canvas);
  var audio = root.JianziAudio.createAudio();
  var game = root.JianziGame;

  var state = game.createRun(content);
  var phase = 'idle';        /* idle | playing | settling | levelDone | levelFail | over */
  var settleTimer = 0;
  var tier = game.tierOf(content, 0);
  var levelStartScore = 0;
  var muted = false;
  var bestCombo = 0;
  var bestScore = 0;
  var raf = 0;
  var lastFrame = 0;
  var startTime = 0;
  var pendingLevelDone = false;
  var pendingRunDone = false;
  var levelDoneTimer = 0;

  var reducedMotion = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderer.setReducedMotion(reducedMotion);

  /* ---------- 布局 ---------- */
  function relayout() {
    /*
     * app 高度必须取「视口高度」，不能取画布高度，
     * 否则会形成「画布多高 app 就多高」的自缩循环，底部空出一大块死区。
     */
    var viewportH = root.innerHeight || root.document.documentElement.clientHeight;
    if (viewportH > 0) {
      root.document.documentElement.style.setProperty('--app-height', viewportH + 'px');
    }
    renderer.resize();
    game.setFieldWidth(state, renderer.getFieldWidth());
  }

  /* ---------- HUD ---------- */
  function updateHud() {
    $('levelName').textContent = state.level.name;
    $('combo').textContent = String(state.combo);
    $('targetText').textContent = copy.targetLabel.replace('%d', state.caught).replace('%d', state.level.target);
    var pct = Math.min(100, Math.round((state.caught / state.level.target) * 100));
    $('progressFill').style.width = pct + '%';
    $('progressBar').setAttribute('aria-valuenow', String(pct));
    var html = '';
    for (var i = 0; i < (state.level.lives || 3); i++) {
      html += '<i class="' + (i < state.lives ? '' : 'gone') + '"></i>';
    }
    $('livesText').innerHTML = html;
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

  /* ---------- 踢判定 ---------- */
  function onKick(event) {
    if (!event) return;
    var bird = state.bird;
    var groundY = game.GROUND_Y;

    if (event.type === 'whiff') {
      audio.playWhiff();
      renderer.burst(bird.x, bird.y - 10, 'rgba(200,190,205,0.9)', 10, 130);
      renderer.popText(bird.x, bird.y - 34, copy.whiffLabel, '#d8cfe0', 20);
      renderer.addShake(2.5);
      flashBadge(copy.whiffLabel);
      updateHud();
      return;
    }

    if (event.type === 'kick' && event.first) {
      audio.playKick();
      renderer.burst(bird.x, groundY, 'rgba(255,214,170,0.85)', 12, 170);
      renderer.ripple(bird.x, groundY, 'rgba(255,200,140,0.9)', 44);
      renderer.addShake(3);
      updateHud();
      return;
    }

    /* 有效接住 */
    if (event.perfect) {
      audio.playPerfect(event.combo);
      renderer.burst(bird.x, bird.y - 12, '#ffe08a', 22, 260);
      renderer.ripple(bird.x, bird.y - 12, 'rgba(255,224,138,0.95)', 72);
      renderer.popText(bird.x, bird.y - 40, copy.perfectLabel, '#ffe08a', 24);
      flashBadge(copy.perfectLabel);
      renderer.addShake(4.5);
      renderer.addFlash('#ffe9c0', 0.14);
    } else {
      audio.playCatch(event.combo);
      renderer.burst(bird.x, bird.y - 12, '#ffd9a8', 12, 190);
      renderer.ripple(bird.x, bird.y - 12, 'rgba(255,200,150,0.85)', 50);
      renderer.popText(bird.x, bird.y - 38, copy.catchLabel, '#ffd9a8', 20);
    }

    var nextTier = game.tierOf(content, state.combo);
    if (nextTier !== tier) {
      tier = nextTier;
      audio.playTier();
      renderer.addFlash(tier.accent, 0.3);
      renderer.addShake(6);
      hintBadge(tier.name);
    }

    updateHud();

    if (event.type === 'levelClear') {
      pendingLevelDone = true;
      pendingRunDone = state.levelIndex >= content.levels.length - 1;
      levelDoneTimer = 0.85;
      phase = 'settling';
    }
  }

  /* ---------- 落地 ---------- */
  function onLand() {
    audio.playLand();
    var bird = state.bird;
    renderer.burst(bird.x, game.GROUND_Y, 'rgba(220,200,180,0.9)', 20, 210);
    renderer.ripple(bird.x, game.GROUND_Y, 'rgba(210,190,170,0.7)', 60);
    renderer.addShake(7);
    flashBadge(copy.landLabel);
    settleTimer = 0.75;
    phase = 'settling';
  }

  /* ---------- 每帧更新 ---------- */
  function update(dt) {
    if (phase === 'playing') {
      var event = game.step(state, dt);
      if (event && event.type === 'land') onLand();
    } else if (phase === 'settling') {
      if (pendingLevelDone) {
        levelDoneTimer -= dt;
        if (levelDoneTimer <= 0) {
          pendingLevelDone = false;
          if (pendingRunDone) {
            finishRun(true);
          } else {
            finishLevel();
          }
          return;
        }
      } else {
        settleTimer -= dt;
        if (settleTimer <= 0) {
          var r = game.recover(state);
          if (r && r.type === 'levelFail') {
            finishLevelFail();
            return;
          }
          phase = 'playing';
          updateHud();
        }
      }
    }

    if (state.phase === 'flying') renderer.pushTrail(state.bird);
    renderer.updateEffects(dt);
  }

  function frame(stamp) {
    raf = 0;
    if (root.document.hidden) return;
    var now = stamp || performance.now();
    var dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0.016;
    lastFrame = now;
    if (renderer.ensureSize()) {
      game.setFieldWidth(state, renderer.getFieldWidth());
    }
    update(dt);
    renderer.render(now / 1000, {
      tier: tier,
      bird: state.bird,
      catchY: game.catchLineY(state),
      perfectY: game.perfectLineY(state),
      inWindow: game.isCatchWindow(state),
      glow: game.isCatchWindow(state) ? 1 : 0
    });
    raf = requestAnimationFrame(frame);
  }

  function loop() {
    if (!raf && !root.document.hidden) raf = requestAnimationFrame(frame);
  }

  /* ---------- 输入 ---------- */
  function onPointerDown(e) {
    if (phase !== 'playing') return;
    if (e.target.closest && e.target.closest('button, a, input, .panel')) return;
    audio.resume();
    onKick(game.kick(state));
  }

  /* ---------- 流程 ---------- */
  function startRun() {
    state = game.createRun(content);
    tier = game.tierOf(content, 0);
    phase = 'playing';
    settleTimer = 0;
    pendingLevelDone = false;
    pendingRunDone = false;
    levelStartScore = 0;
    renderer.clearEffects();
    $('hud').hidden = false;
    $('intro').hidden = true;
    $('result').hidden = true;
    $('levelPanel').hidden = true;
    updateHud();
    audio.resume();
    loop();
  }

  function finishLevel() {
    phase = 'levelDone';
    renderer.addFlash('#ffe9c4', 0.4);
    audio.playWin();
    var el = $('levelPanel');
    $('levelTitle').textContent = copy.levelClearTitle.replace('%d', state.levelIndex + 1);
    $('levelLines').innerHTML = copy.levelClearLines.map(function (l) { return '<p>' + l + '</p>'; }).join('');
    el.hidden = false;
    $('nextBtn').textContent = copy.nextButton;
  }

  function nextLevel() {
    state.score = levelStartScore;
    game.loadLevel(state, state.levelIndex + 1);
    tier = game.tierOf(content, 0);
    levelStartScore = state.score;
    phase = 'playing';
    pendingLevelDone = false;
    renderer.clearEffects();
    $('levelPanel').hidden = true;
    updateHud();
    loop();
  }

  function finishLevelFail() {
    phase = 'levelFail';
    audio.playLose();
    var el = $('levelPanel');
    $('levelTitle').textContent = copy.levelFailTitle.replace('%d', state.levelIndex + 1);
    $('levelLines').innerHTML = copy.levelFailLines.map(function (l) { return '<p>' + l + '</p>'; }).join('');
    el.hidden = false;
    $('nextBtn').textContent = copy.retryButton;
  }

  function retryLevel() {
    state.score = levelStartScore;
    game.loadLevel(state, state.levelIndex);
    tier = game.tierOf(content, 0);
    phase = 'playing';
    pendingLevelDone = false;
    renderer.clearEffects();
    $('levelPanel').hidden = true;
    updateHud();
    loop();
  }

  function finishRun(won) {
    phase = 'over';
    if (won) {
      renderer.addFlash('#ffe9c4', 0.45);
      audio.playWin();
    } else {
      audio.playLose();
    }
    var newBestCombo = state.bestCombo > bestCombo;
    if (newBestCombo) {
      bestCombo = state.bestCombo;
      root.JianziStorage.write('jianzi-best-combo', String(bestCombo));
    }
    if (state.score > bestScore) {
      bestScore = state.score;
      root.JianziStorage.write('jianzi-best-score', String(bestScore));
    }
    $('resultTitle').textContent = won ? copy.finalTitle : copy.gameOverTitle;
    $('resultScoreLabel').textContent = copy.finalScoreLabel;
    $('resultComboLabel').textContent = copy.finalComboLabel;
    $('resultBestLabel').textContent = copy.finalBestLabel;
    $('resultScore').textContent = copy.finalScore.replace('%d', state.score);
    $('resultCombo').textContent = copy.finalCombo.replace('%d', state.bestCombo);
    $('resultBest').textContent = copy.finalBest.replace('%d', Math.max(bestCombo, state.bestCombo));
    $('bestFlag').hidden = !newBestCombo;
    $('result').hidden = false;
    $('againBtn').textContent = copy.againButton;
    buildShareCard(won);
  }

  /* ---------- 纪录卡 ---------- */
  function drawCardBird(c, x, y, size, birdTier) {
    var n = 7;
    var spread = 0.3;
    var R = size * 1.5;
    var grad = c.createLinearGradient(0, y - R - 18, 0, y + size * 0.3);
    grad.addColorStop(0, birdTier.feathers[0]);
    grad.addColorStop(0.55, birdTier.feathers[1]);
    grad.addColorStop(1, birdTier.feathers[2]);
    c.fillStyle = grad;
    c.beginPath();
    for (var i = 0; i < n; i++) {
      var ang = -Math.PI / 2 + (i - (n - 1) / 2) * spread;
      c.moveTo(x, y - size * 0.3);
      c.arc(x, y - size * 0.3, R, ang - 0.2, ang + 0.2);
    }
    c.closePath();
    c.fill();

    var bell = c.createRadialGradient(x - size * 0.2, y - size * 0.55, 1, x, y - size * 0.4, size * 0.4);
    bell.addColorStop(0, '#fff3bf');
    bell.addColorStop(0.55, '#e8b54a');
    bell.addColorStop(1, '#a97518');
    c.fillStyle = bell;
    c.beginPath();
    c.arc(x, y - size * 0.4, size * 0.38, 0, Math.PI * 2);
    c.fill();

    var cork = c.createRadialGradient(x - size * 0.4, y - size * 0.3, 2, x, y, size * 1.1);
    cork.addColorStop(0, '#f3e3c6');
    cork.addColorStop(0.6, '#d9bf95');
    cork.addColorStop(1, '#8d6a45');
    c.fillStyle = cork;
    c.beginPath();
    c.ellipse(x, y - size * 0.1, size * 0.95, size * 0.55, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(70,44,28,0.85)';
    c.beginPath();
    c.ellipse(x, y + size * 0.24, size * 0.95, size * 0.32, 0, 0, Math.PI * 2);
    c.fill();
  }

  function buildShareCard(won) {
    var card = $('shareCard');
    var c = card.getContext('2d');
    var W = 720, H = 960;
    card.width = W;
    card.height = H;

    var sky = tier.sky;
    var g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, sky[0]);
    g.addColorStop(0.52, sky[1]);
    g.addColorStop(1, sky[2]);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);

    /* 日轮 */
    var sun = c.createRadialGradient(W * 0.78, 96, 0, W * 0.78, 96, 120);
    sun.addColorStop(0, tier.sun);
    sun.addColorStop(0.2, tier.sun);
    sun.addColorStop(1, 'rgba(255,255,255,0)');
    c.globalAlpha = 0.5;
    c.fillStyle = sun;
    c.fillRect(0, 0, W, 260);
    c.globalAlpha = 1;
    c.fillStyle = tier.sun;
    c.beginPath();
    c.arc(W * 0.78, 96, 30, 0, Math.PI * 2);
    c.fill();

    /* 毽子背后的光晕 */
    var halo = c.createRadialGradient(W / 2, 400, 0, W / 2, 400, 270);
    halo.addColorStop(0, tier.accent);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalAlpha = 0.32;
    c.fillStyle = halo;
    c.fillRect(0, 150, W, 500);
    c.globalAlpha = 1;

    /* 影子 */
    c.globalAlpha = 0.22;
    c.fillStyle = '#000000';
    c.beginPath();
    c.ellipse(W / 2, 524, 88, 23, 0, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;

    drawCardBird(c, W / 2, 506, 86, tier);

    c.textAlign = 'center';
    c.fillStyle = '#fff6ea';
    c.font = '800 60px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(content.meta.title, W / 2, 116);
    c.fillStyle = 'rgba(255,240,225,0.78)';
    c.font = '400 26px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(won ? copy.finalTitle : copy.gameOverTitle, W / 2, 164);
    c.fillStyle = tier.accent;
    c.font = '800 32px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(tier.name, W / 2, 214);

    /* 最高连击 */
    c.fillStyle = '#ffd9a8';
    c.font = '800 148px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(String(state.bestCombo), W / 2, 726);
    c.fillStyle = 'rgba(255,240,225,0.82)';
    c.font = '400 30px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(copy.finalComboLabel + ' ' + state.bestCombo, W / 2, 774);

    c.fillStyle = 'rgba(255,240,225,0.66)';
    c.font = '400 26px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(copy.finalScoreLabel + ' ' + state.score, W / 2, 846);
    c.fillText(copy.finalBestLabel + ' ' + Math.max(bestCombo, state.bestCombo), W / 2, 884);

    c.fillStyle = tier.accent;
    c.globalAlpha = 0.5;
    c.fillRect(W / 2 - 90, 912, 180, 3);
    c.globalAlpha = 1;
    c.fillStyle = 'rgba(255,240,225,0.42)';
    c.font = '400 22px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText('长按图片可保存', W / 2, 942);
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
  $('nextBtn').addEventListener('click', function () {
    audio.playUi();
    if (phase === 'levelFail') retryLevel();
    else nextLevel();
  });
  $('againBtn').addEventListener('click', function () { audio.playUi(); startRun(); });
  $('saveBtn').addEventListener('click', function () { audio.playUi(); saveCard(); });
  $('muteBtn').addEventListener('click', function () {
    muted = audio.setMuted(!muted);
    root.JianziStorage.write('jianzi-muted', muted ? 'true' : 'false');
    $('muteBtn').textContent = muted ? copy.muteOff : copy.muteOn;
    $('muteBtn').setAttribute('aria-pressed', String(!muted));
    if (!muted) audio.playUi();
  });

  /* ---------- 初始化 ---------- */
  function loadPreferences() {
    var storedMuted = root.JianziStorage.read('jianzi-muted');
    if (storedMuted === 'true') {
      muted = audio.setMuted(true);
      $('muteBtn').textContent = copy.muteOff;
      $('muteBtn').setAttribute('aria-pressed', 'false');
    }
    var storedCombo = Number(root.JianziStorage.read('jianzi-best-combo')) || 0;
    var storedScore = Number(root.JianziStorage.read('jianzi-best-score')) || 0;
    bestCombo = storedCombo;
    bestScore = storedScore;
    $('bestHint').textContent = storedCombo ? '最高连击 ' + storedCombo : '';
  }

  function init() {
    /* 调试与自检钩子 */
    root.__jianziRenderer = renderer;
    Object.defineProperty(root, '__jianziState', { get: function () { return state; }, configurable: true });
    /* 工具名与 14 字内简介只在 brand 里维护一处 */
    $('title').textContent = content.brand.toolName;
    $('subtitle').textContent = content.brand.tagline;
    $('startLines').innerHTML = copy.startLines.map(function (l) { return '<p>' + l + '</p>'; }).join('');
    $('startBtn').textContent = copy.startButton;
    $('hint').textContent = copy.hintShort;
    $('levelName').textContent = state.level.name;
    relayout();
    updateHud();
    loadPreferences();
    root.JianziStorage.loaded.then(loadPreferences);
    startTime = performance.now();
    loop();
  }

  init();
})(typeof window !== 'undefined' ? window : global);
