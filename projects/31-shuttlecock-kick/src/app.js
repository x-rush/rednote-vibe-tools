/*
 * 毽子连击 · 主程序（三期：严格 1:1 复刻 eazo 原版玩法 + 保留二期视觉演出）
 *
 * 负责：动画循环、甜区带判定编排、庭院/踢法解锁编排、UI 流程、输入处理、纪录卡。
 *
 * 与原版对齐的编排语义：
 *  - HUD：rally 主数值、best、已使用踢法 unlocked/12、场地 id、风力 4 格
 *    （P = round(windStrength / 0.05)，逐格点亮）。
 *  - toast：「解锁场地 {n}」「解锁「{kick}」踢法」「新纪录连击！」。
 *  - 结算卡：「回合结束」「羽毛球落地了。」「你的场地成绩」+
 *    best / highest(px) / courtyard #/12 / kickTypes x/12（另附最高连击与风力）。
 *  - 坐标换算：引擎在 CSS 像素空间（与原版一致），渲染层是 380 高虚拟空间，
 *    k = 380 / cssH，把毽子/带/特效换算后交给渲染层。
 */
(function (root) {
  'use strict';

  var content = root.CONTENT;
  var copy = content.copy;
  var $ = function (id) { return document.getElementById(id); };

  var canvas = $('field');
  var renderer = root.JianziRender.createRenderer(canvas, content);
  var audio = root.JianziAudio.createAudio();
  var game = root.JianziGame;

  var state = null;
  var phase = 'idle';        /* idle | playing | settling | over */
  var settleTimer = 0;
  var tier = game.tierOf(content, 1);
  var palette = content.meta.courtyards[0];
  var muted = false;
  var bestRally = 0;
  var bestCombo = 0;
  var bestScore = 0;
  var kicksEver = [];
  var raf = 0;
  var lastFrame = 0;
  var bestToasted = false;

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
    if (state) {
      var layout = renderer.getLayout();
      game.setFieldWidth(state, layout.cssWidth, layout.cssHeight);
    }
  }

  /* 切换羽色档位：HUD、毽子与顶部色晕一起换（纯视觉） */
  function applyTier(next) {
    tier = next;
    root.document.documentElement.style.setProperty('--tint', tier.appTint || 'rgba(255,176,122,0.24)');
  }

  /* 应用庭院：换景（画布 palette） */
  function applyCourtyard(index) {
    palette = content.meta.courtyards[index] || content.meta.courtyards[0];
  }

  /* 引擎 CSS 像素 → 渲染层虚拟空间的换算系数（380 / cssH） */
  function invScale() {
    if (!state) return 1;
    return game.VIEW_SCALE(state);
  }

  /* 引擎布局换算成渲染层的 metric（玩法几何，虚拟空间） */
  function buildMetric() {
    var k = invScale();
    return {
      k: k,
      playTop: game.PLAY_TOP(state) * k,
      playHeight: game.PLAY_HEIGHT(state) * k,
      groundY: game.GROUND_Y(state) * k
    };
  }

  /* 原版渲染循环选带逻辑：已解锁中 multiplier 最高者（同倍率取表序靠前） */
  function topUnlockedKick(rally) {
    var unlocked = game.unlockedKicks(content, rally);
    var best = null;
    for (var i = 0; i < unlocked.length; i++) {
      if (!best || unlocked[i].multiplier > best.multiplier) best = unlocked[i];
    }
    return best;
  }

  /* ---------- HUD ---------- */
  function updateHud() {
    var yard = content.meta.courtyards[state.courtyardIndex] || palette;
    $('yardName').textContent = '#' + yard.id + ' ' + yard.nameZh;
    $('rally').textContent = String(state.rally);
    $('combo').textContent = copy.hudComboLabel.replace('%d', state.combo);
    $('kickCount').textContent = copy.kickCountLabel
      .replace('%d', state.unlockedCount)
      .replace('%d', content.meta.kicks.length);
    var pct = Math.min(100, Math.round((state.unlockedCount / content.meta.kicks.length) * 100));
    $('kickFill').style.width = pct + '%';
    $('kickBar').setAttribute('aria-valuenow', String(pct));
    $('tierName').textContent = tier.name;
    /* 原版风力格：P = round(windStrength / 0.05)，4 格逐格点亮 */
    var pips = Math.round((yard.windStrength || 0) / 0.05);
    if (pips < 0) pips = 0;
    if (pips > 4) pips = 4;
    var dots = $('windPips').getElementsByTagName('i');
    for (var i = 0; i < dots.length; i++) {
      if (i < pips) dots[i].classList.add('lit');
      else dots[i].classList.remove('lit');
    }
  }

  function updateLastKick(kick) {
    $('lastKick').textContent = copy.kickLabel.replace('%s', kick.label + ' ×' + kick.multiplier.toFixed(1));
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
    var shuttle = state.shuttle;
    var k = invScale();
    var groundV = game.GROUND_Y(state) * k;

    if (event.type === 'whiff') {
      audio.playWhiff();
      /* 原版 whiff 只出弱粒子 + 清 combo，毽子不受任何影响 */
      renderer.burst(shuttle.x * k, shuttle.y * k - 6, 'rgba(200,190,205,0.9)', 8, 110);
      renderer.addShake(2);
      renderer.addParallax(0.4);
      flashBadge(copy.whiffLabel);
      updateHud();
      return;
    }

    var kick = event.kick;
    var strength = event.strength;

    /* 踢法命中：效果随强度分级（演出层，不改变判定） */
    audio.playKickType(kick.multiplier, strength);
    renderer.burst(shuttle.x * k, shuttle.y * k - 8, kick.colorCore || '#ffe9c4', Math.round(10 + 16 * strength), 150 + 140 * strength);
    renderer.ring(shuttle.x * k, shuttle.y * k - 8, kick.color || '#ffd9a8', 40 + 26 * strength, 2 + 1.6 * strength);
    renderer.ripple(shuttle.x * k, groundV, kick.color || '#ffd9a8', 40 + 20 * strength);
    renderer.addShake(2 + 3 * strength);
    renderer.addParallax(0.7 + 1.2 * strength);
    if (strength >= 0.55) {
      renderer.addFlash('#ffe9c0', 0.1 + 0.08 * strength);
      renderer.addPulse(0.6 + 0.8 * strength);
    } else {
      renderer.addPulse(0.5);
    }
    /* 原版画布浮字 +N 的 DOM 等价物（画布零文字约束） */
    flashBadge('+' + event.gain);
    updateLastKick(kick);

    /* 羽色档位：已解锁踢法数跨档（纯视觉） */
    var nextTier = game.tierOf(content, event.unlockedCount);
    if (nextTier !== tier) {
      applyTier(nextTier);
      audio.playTier();
      renderer.addFlash(tier.accent, 0.3);
      renderer.addShake(6);
      renderer.addPulse(1.2);
      renderer.addParallax(1.6);
      hintBadge(tier.name);
    }

    /* 新踢法解锁：原版 toast「{kick} kick unlocked」zh=解锁「{kick}」踢法 */
    if (event.unlockedKick) {
      audio.playUnlockKick();
      hintBadge(copy.kickUnlockToast.replace('%s', event.unlockedKick.label));
      renderer.ring(shuttle.x * k, shuttle.y * k - 8, event.unlockedKick.color || '#ffffff', 70, 2.6);
    }

    /* 新庭院解锁：换景 + 原版 toast「Courtyard {n} unlocked」zh=解锁场地 {n} */
    if (event.unlockedYard >= 0) {
      applyCourtyard(event.unlockedYard);
      audio.playCourtyard();
      var yard = content.meta.courtyards[event.unlockedYard];
      hintBadge(copy.yardUnlockToast.replace('%d', yard.id));
      renderer.addFlash(yard.accentTint || '#ffe9c4', 0.34);
      renderer.addShake(5);
      renderer.addPulse(1.1);
      renderer.addParallax(1.5);
    }

    /* 新纪录：本局 rally 首次超过历史最佳 */
    if (!bestToasted && bestRally > 0 && state.rally > bestRally) {
      bestToasted = true;
      audio.playBest();
      hintBadge(copy.bestToast);
      renderer.addFlash('#fff3c4', 0.3);
    }

    updateHud();
  }

  /* ---------- 落地 ---------- */
  function onLand() {
    audio.playLand();
    var shuttle = state.shuttle;
    var k = invScale();
    var groundV = game.GROUND_Y(state) * k;
    renderer.dust(shuttle.x * k, groundV, 11, 'rgba(228,206,178,0.75)');
    renderer.burst(shuttle.x * k, groundV, 'rgba(220,200,180,0.9)', 16, 200);
    renderer.ripple(shuttle.x * k, groundV, 'rgba(210,190,170,0.7)', 52);
    renderer.addShake(7);
    renderer.addParallax(1.6);
    flashBadge(copy.landLabel);
    settleTimer = 0.95;
    phase = 'settling';
  }

  /* ---------- 每帧更新 ---------- */
  function update(dt) {
    if (phase === 'playing') {
      var event = game.step(state, dt);
      if (event && event.type === 'land') onLand();
    } else if (phase === 'settling') {
      settleTimer -= dt;
      if (settleTimer <= 0) {
        finishRun();
        return;
      }
    }

    if (state && state.phase === 'playing' && phase === 'playing') {
      var k = invScale();
      renderer.pushTrail({ x: state.shuttle.x * k, y: state.shuttle.y * k });
    }
    renderer.updateEffects(dt);
  }

  function frame(stamp) {
    raf = 0;
    if (root.document.hidden) return;
    var now = stamp || performance.now();
    var dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0.016;
    lastFrame = now;
    if (renderer.ensureSize()) {
      if (state) {
        var layout = renderer.getLayout();
        game.setFieldWidth(state, layout.cssWidth, layout.cssHeight);
      }
    }
    update(dt);

    var view = null;
    if (state) {
      var k = invScale();
      var resolved = game.resolveKick(state);
      var engineTime = state.time;
      view = {
        palette: palette,
        tier: tier,
        shuttle: {
          x: state.shuttle.x * k,
          y: state.shuttle.y * k,
          spin: state.shuttle.spin,
          angle: state.shuttle.angle
        },
        metric: buildMetric(),
        bandKick: topUnlockedKick(state.rally),
        bandJitter: state.bandJitter,
        bandActive: !!resolved,
        breath: (Math.sin(4 * engineTime) + 1) / 2,
        glowBreath: (Math.sin(8 * engineTime) + 1) / 2,
        glow: resolved ? resolved.strength : 0,
        wind: game.windNorm(state),
        landed: state.phase !== 'playing'
      };
    } else {
      view = {
        palette: palette,
        tier: tier,
        shuttle: null,
        bandKick: null,
        bandJitter: 1,
        bandActive: false,
        breath: 0.5,
        glowBreath: 0.5,
        glow: 0,
        wind: 0,
        landed: true
      };
    }
    renderer.render(now / 1000, view);
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
    var layout = renderer.getLayout();
    state = game.createRun(content, layout.cssWidth, layout.cssHeight);
    applyTier(game.tierOf(content, state.unlockedCount));
    applyCourtyard(0);
    phase = 'playing';
    settleTimer = 0;
    bestToasted = false;
    renderer.clearEffects();
    $('hud').hidden = false;
    $('intro').hidden = true;
    $('result').hidden = true;
    updateHud();
    audio.resume();
    loop();
  }

  /* 风力格数（原版 P = round(windStrength / 0.05)，封顶 4） */
  function windPips(yard) {
    var pips = Math.round((yard.windStrength || 0) / 0.05);
    if (pips < 0) pips = 0;
    if (pips > 4) pips = 4;
    return pips;
  }

  function finishRun() {
    phase = 'over';
    renderer.addFlash('#ffe9c4', 0.4);
    audio.playWin();
    var newBestRally = state.rally > bestRally;
    if (newBestRally) {
      bestRally = state.rally;
      root.JianziStorage.write('jianzi-best-rally', String(bestRally));
    }
    if (state.bestCombo > bestCombo) {
      bestCombo = state.bestCombo;
      root.JianziStorage.write('jianzi-best-combo', String(bestCombo));
    }
    if (state.score > bestScore) {
      bestScore = state.score;
      root.JianziStorage.write('jianzi-best-score', String(bestScore));
    }
    /* 解锁进度持久化：庭院纪录 + 踢法图鉴 */
    var yard = content.meta.courtyards[state.courtyardIndex];
    var yardId = yard.id;
    var bestYard = Number(root.JianziStorage.read('jianzi-best-courtyard')) || 0;
    if (yardId > bestYard) {
      root.JianziStorage.write('jianzi-best-courtyard', String(yardId));
    }
    var merged = kicksEver.slice();
    for (var i = 0; i < state.kickIdsUsed.length; i++) {
      if (merged.indexOf(state.kickIdsUsed[i]) < 0) merged.push(state.kickIdsUsed[i]);
    }
    kicksEver = merged;
    root.JianziStorage.write('jianzi-kicks-ever', kicksEver);

    /* 原版结算卡字段：best / highest(px) / courtyard #/12 / kickTypes x/12 */
    $('resultTitle').textContent = copy.resultTitle;
    $('landedLine').textContent = copy.landedLine;
    $('resultSubtitle').textContent = copy.resultSubtitle;
    $('resultRallyLabel').textContent = copy.resultRallyLabel;
    $('resultComboLabel').textContent = copy.resultComboLabel;
    $('resultBestLabel').textContent = copy.resultBestLabel;
    $('resultHighestLabel').textContent = copy.resultHighestLabel;
    $('resultKickTypesLabel').textContent = copy.resultKickTypesLabel;
    $('resultCourtyardLabel').textContent = copy.resultCourtyardLabel;
    $('resultWindLabel').textContent = copy.resultWindLabel;
    $('resultRally').textContent = copy.resultRally.replace('%d', state.rally);
    $('resultBest').textContent = copy.resultBest.replace('%d', Math.max(bestRally, state.rally));
    $('resultHighest').textContent = copy.resultHighest.replace('%d', Math.round(state.highestKickPx));
    $('resultKickTypes').textContent = copy.resultKickTypes
      .replace('%d', state.kickIdsUsed.length)
      .replace('%d', content.meta.kicks.length);
    $('resultCourtyard').textContent = copy.resultCourtyard.replace('%d', yardId);
    $('resultCombo').textContent = copy.resultCombo.replace('%d', state.bestCombo);
    $('resultWind').textContent = copy.resultWind.replace('%d', windPips(yard));
    $('resultDetail').textContent = copy.resultDetail
      .replace('%d', state.kickIdsUsed.length)
      .replace('%d', content.meta.kicks.length)
      .replace('%d', yardId)
      .replace('%d', content.meta.courtyards.length);
    /* 原版踢法 chips：本局用过的踢法逐个出标签 */
    var chips = $('resultChips');
    chips.innerHTML = '';
    for (var c = 0; c < state.kickIdsUsed.length; c++) {
      var chip = root.document.createElement('span');
      chip.textContent = kickLabelOf(state.kickIdsUsed[c]);
      chips.appendChild(chip);
    }
    $('bestFlag').textContent = copy.bestToast;
    $('bestFlag').hidden = !newBestRally;
    $('result').hidden = false;
    $('againBtn').textContent = copy.againButton;
    $('bestHint').textContent = bestRally ? copy.bestHint.replace('%d', bestRally) : '';
    buildShareCard(newBestRally);
  }

  function kickLabelOf(id) {
    var kicks = content.meta.kicks;
    for (var i = 0; i < kicks.length; i++) {
      if (kicks[i].id === id) return kicks[i].label;
    }
    return id;
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

  function buildShareCard() {
    var card = $('shareCard');
    var c = card.getContext('2d');
    var W = 720, H = 960;
    card.width = W;
    card.height = H;

    var sky = palette.sky;
    var g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, sky[0]);
    g.addColorStop(0.52, sky[1]);
    g.addColorStop(1, sky[2]);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);

    /* 日轮 */
    var sun = c.createRadialGradient(W * 0.78, 96, 0, W * 0.78, 96, 120);
    sun.addColorStop(0, palette.sun);
    sun.addColorStop(0.2, palette.sun);
    sun.addColorStop(1, 'rgba(255,255,255,0)');
    c.globalAlpha = 0.5;
    c.fillStyle = sun;
    c.fillRect(0, 0, W, 260);
    c.globalAlpha = 1;
    c.fillStyle = palette.sun;
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

    var yard = content.meta.courtyards[state.courtyardIndex];
    c.textAlign = 'center';
    c.fillStyle = '#fff6ea';
    c.font = '800 60px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(content.meta.title, W / 2, 116);
    c.fillStyle = 'rgba(255,240,225,0.78)';
    c.font = '400 26px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(copy.cardSubtitle, W / 2, 164);
    c.fillStyle = tier.accent;
    c.font = '800 32px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(yard.nameZh, W / 2, 214);

    /* 本局连踢 */
    c.fillStyle = '#ffd9a8';
    c.font = '800 148px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(String(state.rally), W / 2, 726);
    c.fillStyle = 'rgba(255,240,225,0.82)';
    c.font = '400 30px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(copy.cardRallyLabel + ' ' + state.rally, W / 2, 774);

    c.fillStyle = 'rgba(255,240,225,0.66)';
    c.font = '400 26px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(copy.cardKicksLabel
      .replace('%d', state.kickIdsUsed.length)
      .replace('%d', content.meta.kicks.length), W / 2, 826);
    c.fillText(copy.cardYardLabel.replace('%d', yard.id), W / 2, 864);
    c.fillText(copy.cardComboLabel.replace('%d', state.bestCombo), W / 2, 902);

    c.fillStyle = tier.accent;
    c.globalAlpha = 0.5;
    c.fillRect(W / 2 - 90, 912, 180, 3);
    c.globalAlpha = 1;
    c.fillStyle = 'rgba(255,240,225,0.42)';
    c.font = '400 22px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(copy.cardBestLabel.replace('%d', bestRally), W / 2, 942);
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
    /* 兼容两种落盘形态：容器 Storage API 存的是字符串 'true'，
       早期版本在 localStorage 里存过裸值 true（解析后是布尔） */
    if (storedMuted === true || storedMuted === 'true') {
      muted = audio.setMuted(true);
      $('muteBtn').textContent = copy.muteOff;
      $('muteBtn').setAttribute('aria-pressed', 'false');
    }
    bestRally = Number(root.JianziStorage.read('jianzi-best-rally')) || 0;
    bestCombo = Number(root.JianziStorage.read('jianzi-best-combo')) || 0;
    bestScore = Number(root.JianziStorage.read('jianzi-best-score')) || 0;
    var storedKicks = root.JianziStorage.read('jianzi-kicks-ever');
    kicksEver = Object.prototype.toString.call(storedKicks) === '[object Array]' ? storedKicks : [];
    var bestYard = Number(root.JianziStorage.read('jianzi-best-courtyard')) || 0;
    $('bestHint').textContent = bestRally
      ? copy.bestHint.replace('%d', bestRally) + (bestYard ? ' · 场地#' + bestYard : '')
      : '';
  }

  function init() {
    /* 调试与自检钩子 */
    root.__jianziRenderer = renderer;
    Object.defineProperty(root, '__jianziState', { get: function () { return state; }, configurable: true });
    root.__jianziApplyCourtyard = applyCourtyard;
    /* 工具名与 14 字内简介只在 brand 里维护一处 */
    $('title').textContent = content.brand.toolName;
    $('subtitle').textContent = content.brand.tagline;
    $('startLines').innerHTML = copy.startLines.map(function (l) { return '<p>' + l + '</p>'; }).join('');
    $('startBtn').textContent = copy.startButton;
    $('hint').textContent = copy.hintShort;
    $('hudRallyLabel').textContent = copy.hudRallyLabel;
    $('hudWindLabel').textContent = copy.hudWindLabel;
    $('hudTierLabel').textContent = copy.hudTierLabel;
    applyTier(tier);
    applyCourtyard(0);
    relayout();
    loadPreferences();
    root.JianziStorage.loaded.then(loadPreferences);
    loop();
  }

  init();
})(typeof window !== 'undefined' ? window : global);
