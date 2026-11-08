/*
 * 蛋落地 · 主程序
 * 负责：主循环、喷气与落地判定编排、UI 流程、输入处理、纪录卡。
 */
(function (root) {
  'use strict';

  var content = root.CONTENT;
  var copy = content.copy;
  var $ = function (id) { return document.getElementById(id); };

  var canvas = $('field');
  var renderer = root.EggRender.createRenderer(canvas);
  var audio = root.EggAudio.createAudio();
  var game = root.EggGame;

  var state = game.createRun(content);
  var phase = 'idle';        /* idle | playing | settling | levelDone | levelFail | over */
  var settleTimer = 0;
  var levelStartScore = 0;
  var muted = false;
  var bestScore = 0;
  var bestSoft = 0;
  var raf = 0;
  var lastFrame = 0;
  var pendingLevelDone = false;
  var pendingRunDone = false;
  var levelDoneTimer = 0;
  var warnLevel = 0;

  var reducedMotion = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderer.setReducedMotion(reducedMotion);

  /* ---------- 布局 ---------- */
  function relayout() {
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
    $('score').textContent = String(state.score);
    $('dropText').textContent =
      copy.targetLabel.replace('%d', state.levelIndex + 1).replace('%d', content.levels.length) +
      ' · ' + copy.livesLabel + '×' + state.lives;
    var pct = Math.min(100, Math.round((state.levelIndex / content.levels.length) * 100));
    $('progressFill').style.width = pct + '%';
    $('progressBar').setAttribute('aria-valuenow', String(pct));

    var html = '<em>' + copy.gasLabel + '</em>';
    for (var i = 0; i < (state.level.gas || 5); i++) {
      html += '<i class="' + (i < state.gas ? '' : 'gone') + '"></i>';
    }
    $('gasText').innerHTML = html;

    var ratio = game.speedRatio(state);
    $('speedFill').style.width = Math.min(100, Math.round(ratio * 62)) + '%';
    var label = copy.speedSafe;
    var color = '#4f9a76';
    if (ratio > 0.85) { label = copy.speedDanger; color = '#d4573c'; }
    else if (ratio > 0.6) { label = copy.speedWarn; color = '#e8a83c'; }
    $('speedText').textContent = label;
    $('speedText').style.color = color;
  }

  /* 速度指示必须每帧刷新：它就是玩家判断「现在该不该喷气」的唯一依据 */
  function updateSpeed() {
    var ratio = game.speedRatio(state);
    $('speedFill').style.width = Math.min(100, Math.round(ratio * 62)) + '%';
    var label = copy.speedSafe;
    var color = '#4f9a76';
    if (ratio > 0.85) { label = copy.speedDanger; color = '#d4573c'; }
    else if (ratio > 0.6) { label = copy.speedWarn; color = '#e8a83c'; }
    if ($('speedText').textContent !== label) $('speedText').textContent = label;
    if ($('speedText').style.color !== color) $('speedText').style.color = color;
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

  /* ---------- 输入 ---------- */
  function onPointerDown(e) {
    if (phase !== 'playing') return;
    if (e.target.closest && e.target.closest('button, a, input, .panel')) return;
    var rect = canvas.getBoundingClientRect();
    var x = (e.clientX - rect.left) * (canvas.clientWidth / rect.width);
    audio.resume();
    var event = game.thrust(state, x);
    if (!event) return;
    if (event.type === 'empty') {
      hintBadge(copy.gasEmpty);
      audio.playUi();
      updateHud();
      return;
    }
    audio.playThrust();
    renderer.jet(state.egg.x, state.egg.y + 8, event.dir, '#ffe6a8');
    renderer.addShake(1.6);
    updateHud();
  }

  /* ---------- 落地 / 碎裂 ---------- */
  function onLand(event) {
    var egg = state.egg;
    var perfect = event.safe && event.impact <= state.level.safe * 0.42;
    if (event.safe) {
      state.softLandings += 1;
      if (perfect) state.perfects += 1;
      var gain = 100 + Math.round((state.level.safe - event.impact) * 1.6) + (perfect ? 120 : 0);
      state.score += gain;
      audio.playLand(perfect);
      renderer.burst(egg.x, state.level.padY, '#cdeedd', 16, 160, 120);
      renderer.ripple(egg.x, state.level.padY, 'rgba(140,214,180,0.95)', 54);
      renderer.popText(egg.x, egg.y - 26, perfect ? copy.perfectLabel : copy.landingLabel, perfect ? '#e8a83c' : '#2f6b52', perfect ? 24 : 21);
      flashBadge(perfect ? copy.perfectLabel : copy.landingLabel);
      renderer.addShake(perfect ? 5 : 3);
      if (perfect) renderer.addFlash('#fff6d2', 0.16);
      updateHud();
      pendingLevelDone = true;
      pendingRunDone = state.levelIndex >= content.levels.length - 1;
      levelDoneTimer = 0.9;
      phase = 'settling';
    } else {
      state.lives -= 1;
      audio.playCrack();
      renderer.burst(egg.x, egg.y, '#f3e6cf', 26, 280, 520);
      renderer.burst(egg.x, egg.y, '#d4573c', 10, 200, 420);
      renderer.ripple(egg.x, state.level.padY, 'rgba(212,87,60,0.9)', 60);
      renderer.popText(egg.x, egg.y - 26, copy.crackLabel, '#d4573c', 24);
      flashBadge(copy.crackLabel);
      renderer.addShake(8);
      renderer.addFlash('#ffd0c4', 0.2);
      updateHud();
      settleTimer = 0.85;
      phase = 'settling';
    }
  }

  function onMiss() {
    state.lives -= 1;
    audio.playMiss();
    renderer.popText(state.egg.x, state.egg.y - 20, copy.missLabel, '#d4573c', 22);
    flashBadge(copy.missLabel);
    renderer.addShake(5);
    updateHud();
    settleTimer = 0.8;
    phase = 'settling';
  }

  /* ---------- 每帧更新 ---------- */
  function update(dt) {
    if (phase === 'playing') {
      var event = game.step(state, dt);
      if (event && event.type === 'land') onLand(event);
      else if (event && event.type === 'miss') onMiss();

      /* 接近安全线时蛋壳出现裂纹预警 */
      var ratio = game.speedRatio(state);
      var target = Math.max(0, Math.min(1, (ratio - 0.55) / 0.45));
      state.egg.crack += (target - state.egg.crack) * Math.min(1, dt * 8);
      if (target > 0.05 && warnLevel <= 0) {
        warnLevel = 1;
        hintBadge(copy.speedWarn);
      }
      if (target <= 0.05) warnLevel = 0;
      updateSpeed();
    } else if (phase === 'settling') {
      if (pendingLevelDone) {
        levelDoneTimer -= dt;
        if (levelDoneTimer <= 0) {
          pendingLevelDone = false;
          if (pendingRunDone) finishRun(true);
          else finishLevel();
          return;
        }
      } else {
        settleTimer -= dt;
        if (settleTimer <= 0) {
          if (state.lives <= 0) {
            finishLevelFail();
            return;
          }
          game.resetDrop(state);
          phase = 'playing';
          updateHud();
        }
      }
    }
    renderer.updateEffects(dt);
  }

  function frame(stamp) {
    raf = 0;
    if (root.document.hidden) return;
    var now = stamp || performance.now();
    var dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0.016;
    lastFrame = now;
    if (renderer.ensureSize()) game.setFieldWidth(state, renderer.getFieldWidth());
    update(dt);
    renderer.render(now / 1000, {
      meta: content.meta,
      level: state.level,
      egg: state.egg,
      padX: state.padX,
      speedRatio: game.speedRatio(state)
    });
    raf = requestAnimationFrame(frame);
  }

  function loop() {
    if (!raf && !root.document.hidden) raf = requestAnimationFrame(frame);
  }

  /* ---------- 流程 ---------- */
  function startRun() {
    state = game.createRun(content);
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
    renderer.addFlash('#fff6d2', 0.32);
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
      renderer.addFlash('#fff6d2', 0.36);
      audio.playWin();
    } else {
      audio.playLose();
    }
    var newBest = state.score > bestScore;
    if (newBest) {
      bestScore = state.score;
      root.EggStorage.write('egg-best-score', String(bestScore));
    }
    if (state.softLandings > bestSoft) {
      bestSoft = state.softLandings;
      root.EggStorage.write('egg-best-soft', String(bestSoft));
    }
    $('resultTitle').textContent = won ? copy.finalTitle : copy.gameOverTitle;
    $('resultScoreLabel').textContent = copy.finalScoreLabel;
    $('resultSoftLabel').textContent = copy.finalSoftLabel;
    $('resultBestLabel').textContent = copy.finalBestLabel;
    $('resultScore').textContent = copy.finalScore.replace('%d', state.score);
    $('resultSoft').textContent = copy.finalSoft.replace('%d', state.softLandings);
    $('resultBest').textContent = copy.finalBest.replace('%d', Math.max(bestScore, state.score));
    $('bestFlag').hidden = !newBest;
    $('result').hidden = false;
    $('againBtn').textContent = copy.againButton;
    buildShareCard(won);
  }

  /* ---------- 纪录卡 ---------- */
  function drawCardEgg(c, x, y, r, meta, cracked) {
    var body = c.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.08, x, y, r * 1.5);
    body.addColorStop(0, '#fffdf6');
    body.addColorStop(0.62, '#f6ead4');
    body.addColorStop(1, '#d9c3a1');
    c.fillStyle = body;
    c.beginPath();
    c.ellipse(x, y, r * 0.86, r * 1.1, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(190,160,120,0.5)';
    var spots = [[-0.3, -0.36, 0.12], [0.28, -0.1, 0.1], [-0.14, 0.32, 0.09], [0.36, 0.42, 0.08], [-0.42, 0.18, 0.07]];
    for (var i = 0; i < spots.length; i++) {
      c.beginPath();
      c.arc(x + spots[i][0] * r, y + spots[i][1] * r, spots[i][2] * r, 0, Math.PI * 2);
      c.fill();
    }
    if (cracked) {
      c.strokeStyle = 'rgba(190,90,60,0.75)';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(x - r * 0.46, y - r * 0.56);
      c.lineTo(x - r * 0.1, y - r * 0.1);
      c.lineTo(x - r * 0.4, y + r * 0.2);
      c.moveTo(x - r * 0.1, y - r * 0.1);
      c.lineTo(x + r * 0.38, y - r * 0.38);
      c.stroke();
    }
  }

  function buildShareCard(won) {
    var card = $('shareCard');
    var c = card.getContext('2d');
    var W = 720, H = 960;
    var meta = content.meta;
    card.width = W;
    card.height = H;

    var g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, meta.sky[0]);
    g.addColorStop(0.52, meta.sky[1]);
    g.addColorStop(1, meta.sky[2]);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);

    var sun = c.createRadialGradient(W * 0.2, 96, 0, W * 0.2, 96, 130);
    sun.addColorStop(0, meta.sun);
    sun.addColorStop(0.22, meta.sun);
    sun.addColorStop(1, 'rgba(255,255,255,0)');
    c.globalAlpha = 0.55;
    c.fillStyle = sun;
    c.fillRect(0, 0, W, 280);
    c.globalAlpha = 1;
    c.fillStyle = meta.sun;
    c.beginPath();
    c.arc(W * 0.2, 96, 32, 0, Math.PI * 2);
    c.fill();

    /* 叶子：尖椭圆，中间上凸，蛋坐在叶子上 */
    c.fillStyle = 'rgba(120,190,150,0.22)';
    c.beginPath();
    c.moveTo(W / 2 - 170, 486);
    c.quadraticCurveTo(W / 2, 486 - 78, W / 2 + 170, 486);
    c.quadraticCurveTo(W / 2, 486 + 46, W / 2 - 170, 486);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.42)';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(W / 2 - 170, 486);
    c.quadraticCurveTo(W / 2, 486 - 78, W / 2 + 170, 486);
    c.stroke();

    drawCardEgg(c, W / 2, 430, 120, meta, !won);

    c.textAlign = 'center';
    c.fillStyle = '#1f3a31';
    c.font = '800 62px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(content.meta.title, W / 2, 120);
    c.fillStyle = 'rgba(31,58,49,0.72)';
    c.font = '400 26px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(won ? copy.finalTitle : copy.gameOverTitle, W / 2, 168);

    c.fillStyle = '#2f6b52';
    c.font = '800 150px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(String(state.softLandings), W / 2, 700);
    c.fillStyle = 'rgba(31,58,49,0.72)';
    c.font = '400 30px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(copy.finalSoftLabel + ' ' + state.softLandings, W / 2, 748);

    c.fillStyle = 'rgba(31,58,49,0.6)';
    c.font = '400 26px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(copy.finalScoreLabel + ' ' + state.score, W / 2, 826);
    c.fillText(copy.finalBestLabel + ' ' + Math.max(bestScore, state.score), W / 2, 864);

    c.fillStyle = '#4f9a76';
    c.globalAlpha = 0.5;
    c.fillRect(W / 2 - 90, 898, 180, 3);
    c.globalAlpha = 1;
    c.fillStyle = 'rgba(31,58,49,0.4)';
    c.font = '400 22px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText('长按图片可保存', W / 2, 930);
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
    root.EggStorage.write('egg-muted', muted ? 'true' : 'false');
    $('muteBtn').textContent = muted ? copy.muteOff : copy.muteOn;
    $('muteBtn').setAttribute('aria-pressed', String(!muted));
    if (!muted) audio.playUi();
  });

  /* ---------- 初始化 ---------- */
  function loadPreferences() {
    var storedMuted = root.EggStorage.read('egg-muted');
    if (storedMuted === 'true') {
      muted = audio.setMuted(true);
      $('muteBtn').textContent = copy.muteOff;
      $('muteBtn').setAttribute('aria-pressed', 'false');
    }
    bestScore = Number(root.EggStorage.read('egg-best-score')) || 0;
    bestSoft = Number(root.EggStorage.read('egg-best-soft')) || 0;
    $('bestHint').textContent = bestSoft ? '最佳软着陆 ' + bestSoft : '';
  }

  function init() {
    root.__eggRenderer = renderer;
    Object.defineProperty(root, '__eggState', { get: function () { return state; }, configurable: true });
    $('title').textContent = content.brand.toolName;
    $('subtitle').textContent = content.brand.tagline;
    $('startLines').innerHTML = copy.startLines.map(function (l) { return '<p>' + l + '</p>'; }).join('');
    $('startBtn').textContent = copy.startButton;
    $('hint').textContent = copy.hintShort;
    $('levelName').textContent = state.level.name;
    relayout();
    updateHud();
    loadPreferences();
    root.EggStorage.loaded.then(loadPreferences);
    loop();
  }

  init();
})(typeof window !== 'undefined' ? window : global);
