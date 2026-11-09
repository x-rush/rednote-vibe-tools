/*
 * 蛋落地 · 主程序（四期：严格 1:1 复刻 eazo 原版）
 * 负责：主循环、反推与落地判定编排、UI 流程、输入处理、空投报告。
 *
 * 流程：intro → playing（准备 0.8s / 下落，点按=一发纯竖直反推）→
 *       settling（评级特效 + 完美贴地慢镜）→ dropResult（单落结算：重试 / 下一关）
 *       → …十二关… → final（空投报告：幸存落数 / 最佳落速 / 剩余反推合计）。
 *
 * 与原版对齐的编排：
 *   - 点按只做 vy -= impulse（纯竖直，不读点击位置），每发伴随推力音（原版 thrust）；
 *   - 撞障碍带（未穿缺口）只折损一发反推并播裂纹音（原版 crack），蛋继续下落；
 *   - 落地结算四档评级；碎裂（broken）播 smash、其余播 soft（原版 soft/smash）。
 *
 * 保留的二期呈现层：玻璃 HUD（画布零文字）、红黄绿落速刻度尺、完美慢镜、连击。
 */
(function (root) {
  'use strict';

  var content = root.CONTENT;
  var copy = content.copy;
  var $ = function (id) { return document.getElementById(id); };

  var canvas = $('field');
  var renderer = root.EggRender.createRenderer(canvas, content);
  var audio = root.EggAudio.createAudio();
  var game = root.EggGame;

  var state = game.createRun(content);
  var phase = 'idle';        /* idle | playing | settling | dropResult | final */
  var settleTimer = 0;
  var pendingEvent = null;
  var muted = false;
  var bestRun = null;
  var raf = 0;
  var lastFrame = 0;
  /* 完美贴地的 0.3 秒慢镜：把时间步长压到 0.35 倍 */
  var slowTimer = 0;
  var warnLevel = 0;
  var fallHintShown = false;

  var reducedMotion = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderer.setReducedMotion(reducedMotion);

  /* ---------- 布局 ---------- */
  function relayout() {
    var viewportH = root.innerHeight || root.document.documentElement.clientHeight;
    if (viewportH > 0) {
      root.document.documentElement.style.setProperty('--app-height', viewportH + 'px');
    }
    renderer.resize();
  }

  /* ---------- HUD ---------- */
  function buildArrows(wind) {
    var out = '';
    var n = Math.max(1, Math.min(3, Math.ceil(Math.abs(wind) / 40)));
    var ch = wind > 0 ? copy.windRight : copy.windLeft;
    for (var i = 0; i < n; i++) out += ch;
    return out;
  }

  function updateHud() {
    var level = state.level;
    $('levelName').textContent = level.zhName || level.name;
    $('streak').textContent = String(state.streak);
    $('dropText').textContent =
      copy.targetLabel.replace('%d', state.levelIndex + 1).replace('%d', content.levels.length);

    var pct = Math.min(100, Math.round((state.levelIndex / content.levels.length) * 100));
    $('progressFill').style.width = pct + '%';
    $('progressBar').setAttribute('aria-valuenow', String(pct));

    /* 剩余反推：核心资源读数 */
    var dots = '';
    for (var i = 0; i < level.pulses; i++) {
      dots += '<i class="' + (i < state.pulses ? '' : 'gone') + '"></i>';
    }
    $('pulseText').innerHTML = dots;

    /* 限速读数（原版 HUD 第 4 字段 Limit） */
    $('limitText').textContent = copy.limitLabel + ' ' + level.maxSpeed;

    /* 风：方向与强度（1～3 个箭头），开落前就能读 */
    var wind = level.wind || 0;
    if (!wind) {
      $('windText').innerHTML = copy.windCalm;
    } else {
      $('windText').innerHTML = copy.windLabel + '<em>' + buildArrows(wind) + '</em>';
    }

    updateSpeed();
  }

  /*
   * 落速刻度尺每帧刷新：它是玩家判断「现在该不该再点一发」的唯一依据。
   * 指针位置 = 当前速度 / (限速 × 1.25)；绿 ≤0.4 完美区 / 黄 ≤0.75 安全区 / 红 裂纹区。
   * 数值读数 = 当前落速（原版 HUD 的 Speed 字段），颜色随区间变化。
   */
  function updateSpeed() {
    var ratio = game.speedRatio(state);
    var gauge = content.meta.gauge || { maxRatio: 1.25, warnRatio: 0.4, dangerRatio: 0.75 };
    var pct = Math.max(0, Math.min(1, ratio / gauge.maxRatio)) * 100;

    var color = '#4fc79a';
    if (ratio > gauge.dangerRatio) color = '#ff8b6b';
    else if (ratio > gauge.warnRatio) color = '#ffd06a';

    var speedText = String(Math.round(game.currentSpeed(state)));
    if ($('speedText').textContent !== speedText) $('speedText').textContent = speedText;
    if ($('speedText').style.color !== color) $('speedText').style.color = color;

    $('gaugeNeedle').style.left = pct.toFixed(1) + '%';
    $('vGaugeNeedle').style.bottom = pct.toFixed(1) + '%';
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
    audio.resume();
    /* 原版点按：不读点击位置，纯竖直 vy -= impulse */
    var event = game.pulse(state);
    if (!event) return;
    if (event.type === 'empty') {
      hintBadge(copy.pulseEmpty);
      audio.playUi();
      updateHud();
      return;
    }
    audio.playThrust();
    var pos = renderer.toScreen(state.egg.x, state.egg.y);
    renderer.jet(pos.x, pos.y + 8, 0, '#ffe6a8');
    renderer.addShake(1.2);
    renderer.addPulse(0.4);
    updateHud();
  }

  /* ---------- 落地结算 ---------- */
  function gradeTitle(grade) {
    if (grade === 'perfect') return copy.gradePerfect;
    if (grade === 'safe') return copy.gradeSafe;
    if (grade === 'cracked') return copy.gradeCracked;
    return copy.gradeBroken;
  }

  function gradeLine(grade) {
    if (grade === 'perfect') return copy.dropLinePerfect;
    if (grade === 'safe') return copy.dropLineSafe;
    if (grade === 'cracked') return copy.dropLineCracked;
    return copy.dropLineBroken;
  }

  function onSettle(event) {
    var egg = state.egg;
    var level = state.level;
    var grade = game.registerResult(state, event);
    var groundPos = renderer.toScreen(egg.x, level.height);

    if (grade === 'perfect') {
      /* 完美贴地：0.3s 慢镜 + 蛋壳光环 + 冲击碎片 */
      slowTimer = 0.3;
      renderer.halo(groundPos.x, groundPos.y - 6, 'rgba(255,214,138,0.95)', 84);
      renderer.halo(groundPos.x, groundPos.y - 6, 'rgba(255,255,255,0.8)', 54);
      renderer.burst(groundPos.x, groundPos.y - 6, '#ffe6a8', 22, 190, 60);
      renderer.shells(groundPos.x, groundPos.y - 10, 8);
      renderer.addPulse(1);
      renderer.addShake(3);
      renderer.addFlash('#fff3c9', 0.14);
      flashBadge(copy.perfectLabel);
      audio.playPerfect(state.streak);
    } else if (grade === 'safe') {
      audio.playLand(false);
      renderer.burst(groundPos.x, groundPos.y, '#cdeedd', 16, 160, 120);
      renderer.ripple(groundPos.x, groundPos.y, 'rgba(140,214,180,0.95)', 54);
      renderer.addShake(2);
      flashBadge(copy.landingLabel);
    } else if (grade === 'cracked') {
      audio.playCrack();
      renderer.burst(groundPos.x, groundPos.y, '#f3e6cf', 18, 220, 320);
      renderer.ripple(groundPos.x, groundPos.y, 'rgba(224,160,60,0.9)', 56);
      renderer.addShake(4);
      flashBadge(copy.crackLabel);
    } else {
      /* 摔碎：超速触地（原版 smash 音，撞带不在此列——撞带只折损脉冲继续下落） */
      audio.playSmash();
      renderer.burst(groundPos.x, groundPos.y, '#f3e6cf', 26, 280, 520);
      renderer.burst(groundPos.x, groundPos.y, '#e0563c', 10, 200, 420);
      renderer.shells(groundPos.x, groundPos.y, 16);
      renderer.ripple(groundPos.x, groundPos.y, 'rgba(224,86,60,0.9)', 60);
      renderer.addShake(8);
      renderer.addFlash('#ffd0c4', 0.2);
      flashBadge(copy.missLabel);
    }

    pendingEvent = event;
    settleTimer = grade === 'perfect' ? 1.05 : 0.85;
    phase = 'settling';
    updateHud();
  }

  function showDropPanel() {
    var event = pendingEvent;
    var level = state.level;
    phase = 'dropResult';
    var title = $('dropGrade');
    title.textContent = gradeTitle(event.grade);
    title.className = 'grade-' + event.grade;
    $('dropSpeed').textContent = Math.round(event.speed) + ' / ' + level.maxSpeed;
    $('dropPulses').textContent = String(event.pulsesLeft);
    $('dropStreak').textContent = String(state.streak);
    $('dropLine').textContent = gradeLine(event.grade);
    $('nextBtn').textContent =
      state.levelIndex >= content.levels.length - 1 ? copy.reportButton : copy.nextButton;
    $('dropPanel').hidden = false;
  }

  /* ---------- 每帧更新 ---------- */
  function update(dt) {
    /* 完美着陆后的慢镜：把这一步的时间压短，画面像被按了慢放 */
    var scale = 1;
    if (slowTimer > 0) {
      slowTimer -= dt;
      scale = 0.35;
    }
    var step = dt * scale;

    if (phase === 'playing') {
      var event = game.step(state, step);
      if (event) {
        if (event.type === 'bandHit') {
          /* 原版：撞带（未穿缺口）只折损一发反推并播裂纹音，蛋继续下落 */
          audio.playCrack();
          renderer.addShake(2.4);
          hintBadge(copy.bandHit);
          updateHud();
        } else {
          onSettle(event);
        }
      }

      if (phase === 'playing') {
        /* 准备期 → 下落的转场提示（原版 ready / falling 状态） */
        if (!fallHintShown && state.phase === 'falling') {
          fallHintShown = true;
          hintBadge(copy.fallingText);
        }

        /* 接近限速时蛋壳出现裂纹预警 */
        var ratio = game.speedRatio(state);
        var target = Math.max(0, Math.min(1, (ratio - 0.75) / 0.3));
        state.egg.crack += (target - state.egg.crack) * Math.min(1, dt * 8);
        if (target > 0.05 && warnLevel <= 0) {
          warnLevel = 1;
          hintBadge(copy.speedDanger);
        }
        if (target <= 0.05) warnLevel = 0;

        /* 落地前：草屑先飞起来 */
        var gap = state.level.height - state.egg.y;
        if (gap < 120 && gap > 0 && state.egg.vy > 60 && Math.random() < dt * 14) {
          var gpos = renderer.toScreen(state.egg.x, state.level.height);
          renderer.grass(gpos.x, gpos.y, 2, 'rgba(168,224,138,0.9)');
        }
      }

      updateSpeed();
    } else if (phase === 'settling') {
      settleTimer -= dt;
      if (settleTimer <= 0) showDropPanel();
    }
    renderer.updateEffects(dt);
  }

  function frame(stamp) {
    raf = 0;
    if (root.document.hidden) return;
    var now = stamp || performance.now();
    var dt = lastFrame ? Math.min(0.033, (now - lastFrame) / 1000) : 0.016;
    lastFrame = now;
    renderer.ensureSize();
    update(dt);
    renderer.render(now / 1000, {
      level: state.level,
      egg: state.egg,
      speedRatio: game.speedRatio(state)
    });
    raf = requestAnimationFrame(frame);
  }

  function loop() {
    if (!raf && !root.document.hidden) raf = requestAnimationFrame(frame);
  }

  /* ---------- 流程 ---------- */
  function hidePanels() {
    $('intro').hidden = true;
    $('dropPanel').hidden = true;
    $('result').hidden = true;
  }

  function beginLevel() {
    renderer.clearEffects();
    renderer.resetCamera({ level: state.level, egg: state.egg });
    warnLevel = 0;
    slowTimer = 0;
    fallHintShown = false;
    phase = 'playing';
    hidePanels();
    $('hud').hidden = false;
    hintBadge(copy.readyText);
    updateHud();
    loop();
  }

  function startRun() {
    state = game.createRun(content);
    beginLevel();
    audio.resume();
  }

  function retryLevel() {
    game.loadLevel(state, state.levelIndex);
    beginLevel();
  }

  function nextLevel() {
    if (state.levelIndex >= content.levels.length - 1) {
      finishRun();
      return;
    }
    game.loadLevel(state, state.levelIndex + 1);
    beginLevel();
  }

  function finishRun() {
    phase = 'final';
    renderer.addFlash('#fff3c9', 0.3);
    audio.playWin();
    var run = state.run;
    var bestSpeed = Number.isFinite(run.bestSpeed) ? Math.round(run.bestSpeed) : null;
    var newBest = !bestRun ||
      run.survived > bestRun.survived ||
      (run.survived === bestRun.survived && run.bestSpeed < bestRun.bestSpeed);
    if (newBest) {
      bestRun = {
        survived: run.survived,
        bestSpeed: Number.isFinite(run.bestSpeed) ? run.bestSpeed : null,
        pulsesLeftOver: run.pulsesLeftOver,
        bestStreak: state.bestStreak
      };
      root.EggStorage.write('egg-best-run', bestRun);
    }
    $('resultTitle').textContent = copy.finalTitle;
    $('resultSurvivedLabel').textContent = copy.finalSurvivedLabel;
    $('resultBestSpeedLabel').textContent = copy.finalBestLabel;
    $('resultPulsesLabel').textContent = copy.finalPulsesLabel;
    $('resultSurvived').textContent = copy.finalSurvived.replace('%d', run.survived);
    $('resultBestSpeed').textContent = bestSpeed === null ? '—' : copy.finalBest.replace('%d', bestSpeed);
    $('resultPulses').textContent = copy.finalPulses.replace('%d', run.pulsesLeftOver);
    $('resultStreakLine').textContent =
      copy.finalStreakLabel + ' ×' + state.bestStreak + ' · ' + copy.gradePerfect + ' ×' + state.perfects;
    $('bestFlag').hidden = !newBest;
    $('againBtn').textContent = copy.againButton;
    $('result').hidden = false;
    updateHud();
    buildShareCard();
  }

  /* ---------- 纪录卡 ---------- */
  function drawCardEgg(c, x, y, r, cracked) {
    var meta = content.meta;
    var body = c.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.08, x, y, r * 1.5);
    body.addColorStop(0, meta.egg.shell[0]);
    body.addColorStop(0.62, meta.egg.shell[1]);
    body.addColorStop(1, meta.egg.shell[2]);
    c.fillStyle = body;
    c.beginPath();
    c.ellipse(x, y, r * 0.82, r * 1.04, 0, 0, Math.PI * 2);
    c.fill();
    var bounce = c.createLinearGradient(0, y + r * 0.1, 0, y + r * 1.04);
    bounce.addColorStop(0, 'rgba(255,217,160,0)');
    bounce.addColorStop(1, 'rgba(255,217,160,0.45)');
    c.fillStyle = bounce;
    c.beginPath();
    c.ellipse(x, y, r * 0.82, r * 1.04, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.beginPath();
    c.ellipse(x - r * 0.3, y - r * 0.42, r * 0.2, r * 0.3, -0.35, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(186,156,116,0.5)';
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

  function buildShareCard() {
    var card = $('shareCard');
    var c = card.getContext('2d');
    var meta = content.meta;
    var run = state.run;
    var W = 720, H = 960;
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

    /* 远山剪影 */
    c.fillStyle = 'rgba(47,111,104,0.28)';
    c.beginPath();
    c.moveTo(0, 470);
    for (var x = 0; x <= W; x += 20) {
      c.lineTo(x, 400 - Math.sin(x * 0.009) * 30 - Math.sin(x * 0.021) * 12);
    }
    c.lineTo(W, 470);
    c.closePath();
    c.fill();

    /* 草坡地面 */
    c.fillStyle = 'rgba(63,154,112,0.28)';
    c.fillRect(0, 486, W, 60);
    c.strokeStyle = 'rgba(255,255,255,0.42)';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(0, 486);
    c.lineTo(W, 486);
    c.stroke();

    drawCardEgg(c, W / 2, 424, 128, run.survived < content.levels.length);

    c.textAlign = 'center';
    c.fillStyle = '#1f5a49';
    c.font = '800 62px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(content.meta.title, W / 2, 120);
    c.fillStyle = 'rgba(31,90,73,0.72)';
    c.font = '400 26px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(copy.finalTitle, W / 2, 168);

    c.fillStyle = '#2f8f6a';
    c.font = '800 150px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(String(run.survived), W / 2, 700);
    c.fillStyle = 'rgba(31,90,73,0.72)';
    c.font = '400 30px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(copy.finalSurvivedLabel + ' ' + copy.finalSurvived.replace('%d', run.survived), W / 2, 748);

    var bestText = Number.isFinite(run.bestSpeed) ? String(Math.round(run.bestSpeed)) : '—';
    c.font = '400 26px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(copy.finalBestLabel + ' ' + bestText, W / 2, 800);
    c.fillText(copy.finalPulsesLabel + ' ' + run.pulsesLeftOver, W / 2, 840);
    c.fillText(copy.finalStreakLabel + ' ×' + state.bestStreak, W / 2, 878);

    c.fillStyle = '#2f8f6a';
    c.globalAlpha = 0.5;
    c.fillRect(W / 2 - 90, 908, 180, 3);
    c.globalAlpha = 1;
    c.fillStyle = 'rgba(31,90,73,0.44)';
    c.font = '400 22px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText('长按图片可保存', W / 2, 938);
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
  $('retryBtn').addEventListener('click', function () { audio.playUi(); retryLevel(); });
  $('nextBtn').addEventListener('click', function () { audio.playUi(); nextLevel(); });
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
    /* 兼容两种落盘形态：容器 Storage API 存的是字符串 'true'，
       早期版本在 localStorage 里存过裸值 true（解析后是布尔） */
    if (storedMuted === true || storedMuted === 'true') {
      muted = audio.setMuted(true);
      $('muteBtn').textContent = copy.muteOff;
      $('muteBtn').setAttribute('aria-pressed', 'false');
    }
    var storedBest = root.EggStorage.read('egg-best-run');
    if (storedBest && typeof storedBest === 'object' && Number(storedBest.survived) > 0) {
      bestRun = storedBest;
      $('bestHint').textContent = '最佳幸存 ' + bestRun.survived + '/12';
    }
  }

  function init() {
    root.__eggRenderer = renderer;
    Object.defineProperty(root, '__eggState', { get: function () { return state; }, configurable: true });
    $('title').textContent = content.brand.toolName;
    $('subtitle').textContent = content.brand.tagline;
    $('startLines').innerHTML = copy.startLines.map(function (l) { return '<p>' + l + '</p>'; }).join('');
    $('startBtn').textContent = copy.startButton;
    $('hint').textContent = copy.hintShort;
    $('speedLabel').textContent = copy.speedLabel;
    $('streakLabel').textContent = copy.streakLabel;
    $('levelName').textContent = state.level.name;
    relayout();
    updateHud();
    loadPreferences();
    root.EggStorage.loaded.then(loadPreferences);
    loop();
  }

  init();
})(typeof window !== 'undefined' ? window : global);
