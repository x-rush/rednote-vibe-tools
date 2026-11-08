/*
 * 沙丘速降 · 主逻辑
 * 负责单指切弯、HUD、危险提示、结算与「山脊线」纪录卡。
 * 玩法状态在 src/game.js，业务内容在 src/content/content.json。
 */
(function (root) {
  'use strict';

  var content = root.CONTENT;
  var copy = content.copy;
  var game = root.DuneGame;
  var renderer = null;
  var audio = root.DuneAudio;
  var storage = root.DuneStorage;

  var state = null;
  var phase = 'intro';
  var muted = false;
  var bestScore = 0;
  var bestRun = null;
  var raf = 0;
  var lastFrame = 0;
  var hudTimer = 0;
  var dragging = false;
  var grabOffset = 0;
  var flashTimer = 0;

  function $(id) { return root.document.getElementById(id); }

  /* ---------- 布局 ---------- */
  function relayout() {
    var viewportH = root.innerHeight || root.document.documentElement.clientHeight;
    if (viewportH > 0) {
      root.document.documentElement.style.setProperty('--app-height', viewportH + 'px');
    }
    renderer.resize();
  }

  function bandOf(index) {
    var stage = content.stages[index] || content.stages[0];
    return content.meta.bands[stage.band] || content.meta.bands.dusk;
  }

  /* ---------- HUD ---------- */
  function updateHud() {
    if (!state) return;
    $('distance').textContent = String(game.meters(state));
    $('flagCount').textContent = String(state.flags);
    $('speedValue').textContent = String(game.topKmh(state));
    $('carveCount').textContent = String(state.carves);
    $('stageName').textContent = (content.stages[state.stageIndex] || content.stages[0]).name;
    $('score').textContent = String(Math.floor(state.score + state.bonus));

    /* 雪崩距离条 */
    var ratio = Math.max(0, Math.min(1, state.gap / game.GAP_MAX));
    var fill = $('gapFill');
    fill.style.width = (ratio * 100).toFixed(1) + '%';
    $('gapBar').className = ratio < 0.2 ? 'gap-bar danger' : ratio < 0.45 ? 'gap-bar warn' : 'gap-bar';
  }

  function flash(text, kind) {
    var el = $('flash');
    el.textContent = text;
    el.className = 'flash show ' + (kind || '');
    flashTimer = 0.9;
  }

  /* ---------- 输入 ---------- */
  function clientToWorld(clientX) {
    var rect = $('field').getBoundingClientRect();
    var off = renderer.getOffset();
    return (clientX - rect.left - off.x) / renderer.getScale();
  }

  function onPointerDown(e) {
    if (phase !== 'run' || !state) return;
    if (e.target.closest && e.target.closest('button, a, input, .panel')) return;
    audio.resume();
    dragging = true;
    /* 抓住手指相对玩家的偏移：按下时玩家不会瞬移 */
    grabOffset = clientToWorld(e.clientX) - state.x;
    if (e.pointerId !== undefined && this.setPointerCapture) {
      try {
        this.setPointerCapture(e.pointerId);
      } catch (error) {
        /* 某些内核不支持，忽略 */
      }
    }
  }

  function onPointerMove(e) {
    if (!dragging || !state) return;
    game.setTarget(state, clientToWorld(e.clientX) - grabOffset);
  }

  function onPointerUp(e) {
    if (!dragging) return;
    dragging = false;
    if (e && e.pointerId !== undefined && this.releasePointerCapture) {
      try {
        this.releasePointerCapture(e.pointerId);
      } catch (error) {
        /* 忽略 */
      }
    }
  }

  function onKeyDown(e) {
    if (phase !== 'run' || !state) return;
    if (e.key === 'ArrowLeft' || e.key === 'a') {
      game.setTarget(state, state.x - 26);
      e.preventDefault();
    } else if (e.key === 'ArrowRight' || e.key === 'd') {
      game.setTarget(state, state.x + 26);
      e.preventDefault();
    }
  }

  /* ---------- 每帧 ---------- */
  function handleEvents() {
    if (!state || !state.events.length) return;
    for (var i = 0; i < state.events.length; i++) {
      var e = state.events[i];
      if (e.type === 'gate') {
        audio.playGate();
        flash('旗门 +' + game.GATE_SCORE, 'good');
      } else if (e.type === 'gateMiss') {
        audio.playGateMiss();
      } else if (e.type === 'crash') {
        audio.playCrash();
        flash('撞到岩脊！', 'bad');
      } else if (e.type === 'jump') {
        audio.playJump();
        flash('腾空！', 'good');
      } else if (e.type === 'land') {
        audio.playLand();
      } else if (e.type === 'carve') {
        audio.playCarve(e.power);
        flash('甩尾！', 'good');
      } else if (e.type === 'caught') {
        audio.playOver();
      }
    }
    state.events.length = 0;
  }

  function update(dt) {
    if (!state) return;
    if (phase === 'run') {
      game.update(state, dt);
      handleEvents();
      if (state.phase === 'over') {
        onCaught();
        return;
      }
      /* 沙土飞溅 */
      if (state.speed > 220 && Math.random() < dt * 34) {
        var r = renderer.getScale();
        renderer.spray(
          renderer.sx(state.x) - 8 * r,
          renderer.getPlayerY() + 2,
          -state.vx * 0.4 - 40,
          -30,
          content.meta.bands[(content.stages[state.stageIndex] || content.stages[0]).band].dust,
          2.2
        );
      }
    }
    renderer.updateEffects(dt);
    /* HUD 每 100ms 刷一次，别每帧去动 DOM */
    hudTimer -= dt;
    if (hudTimer <= 0) {
      hudTimer = 0.1;
      updateHud();
    }
    if (flashTimer > 0) {
      flashTimer -= dt;
      if (flashTimer <= 0) $('flash').className = 'flash';
    }
  }

  function buildView() {
    var band = bandOf(state ? state.stageIndex : 0);
    return {
      band: band,
      s: state ? state.s : 0,
      speed: state ? state.speed : 0,
      x: state ? state.x : game.WIDTH / 2,
      vx: state ? state.vx : 0,
      airHeight: state ? state.air : 0,
      gap: state ? state.gap : game.GAP_START,
      features: state ? state.features : [],
      fallX: game.fallLine(state ? state.s : 0),
      risk: state ? state.gap < game.CARVE_RISK_GAP : false
    };
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
    if (phase === 'run' && state) {
      audio.setSpeed(state.speed);
      audio.setDanger(1 - Math.max(0, Math.min(1, state.gap / 460)));
    }
    raf = requestAnimationFrame(frame);
  }

  function loop() {
    if (!raf && !root.document.hidden) raf = requestAnimationFrame(frame);
  }

  /* ---------- 流程 ---------- */
  function startRun() {
    state = game.createRun(content, Math.floor(Math.random() * 100000));
    game.startRun(state);
    root.__duneState = state;
    phase = 'run';
    renderer.clearEffects();
    $('hud').hidden = false;
    $('intro').hidden = true;
    $('result').hidden = true;
    $('flash').className = 'flash';
    updateHud();
    audio.resume();
    loop();
  }

  function onCaught() {
    phase = 'over';
    game.finish(state);
    audio.silence();
    var isNew = state.score > bestScore;
    if (isNew) {
      bestScore = state.score;
      storage.write('dune-best-score', bestScore);
    }
    bestRun = {
      score: state.score,
      meters: game.meters(state),
      flags: state.flags,
      carves: state.carves,
      topSpeed: game.topKmh(state),
      stage: state.stageIndex
    };
    storage.write('dune-best-run', bestRun);

    $('resultTitle').textContent = copy.overTitle;
    $('resultScore').textContent = String(state.score);
    $('resultDistance').textContent = String(game.meters(state));
    $('resultFlags').textContent = String(state.flags);
    $('resultCarves').textContent = String(state.carves);
    $('resultSpeed').textContent = String(game.topKmh(state));
    $('bestFlag').hidden = !isNew;
    $('resultBest').textContent = String(Math.max(bestScore, state.score));
    $('againBtn').textContent = copy.againButton;
    buildTraceCard();
    $('result').hidden = false;
    updateHud();
  }

  /* ---------- 山脊线纪录卡 ---------- */
  function buildTraceCard() {
    var canvas = $('shareCard');
    var c = canvas.getContext('2d');
    var W = canvas.width;
    var H = canvas.height;
    var band = bandOf(state.stageIndex);

    var grad = c.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, band.skyTop);
    grad.addColorStop(0.42, band.skyBottom);
    grad.addColorStop(0.44, band.sand);
    grad.addColorStop(1, band.sandDark);
    c.fillStyle = grad;
    c.fillRect(0, 0, W, H);

    c.textAlign = 'center';
    c.fillStyle = band.flag;
    c.font = '800 62px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(content.meta.title, W / 2, 106);
    c.fillStyle = 'rgba(255,255,255,0.66)';
    c.font = '400 26px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(copy.finalTitle, W / 2, 150);

    /* 山脊线：横向位置随距离变化的剖面 */
    var boxW = 470;
    var boxH = 560;
    var boxX = (W - boxW) / 2;
    var boxY = 190;
    c.strokeStyle = 'rgba(255,255,255,0.2)';
    c.lineWidth = 2;
    c.strokeRect(boxX, boxY, boxW, boxH);

    var trail = state.trail || [];
    if (trail.length > 1) {
      var maxS = state.s || 1;
      c.save();
      c.beginPath();
      c.rect(boxX, boxY, boxW, boxH);
      c.clip();
      for (var i = 1; i < trail.length; i++) {
        var px = boxX + (trail[i].x / game.WIDTH) * boxW;
        var py = boxY + boxH - (trail[i].s / maxS) * boxH;
        var risk = trail[i].gap < game.CARVE_RISK_GAP;
        c.strokeStyle = risk ? 'rgba(255,120,80,0.95)' : 'rgba(255,236,200,0.9)';
        c.lineWidth = risk ? 6 : 4;
        c.lineJoin = 'round';
        c.beginPath();
        if (i === 1) c.moveTo(px, py);
        else c.lineTo(px, py);
        c.stroke();
      }
      /* 起点 */
      c.fillStyle = band.sun;
      c.beginPath();
      c.arc(
        boxX + (trail[0].x / game.WIDTH) * boxW,
        boxY + boxH - (trail[0].s / maxS) * boxH,
        8,
        0,
        Math.PI * 2
      );
      c.fill();
      c.restore();
    } else {
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.font = '400 26px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
      c.fillText(copy.finalTraceEmpty, W / 2, boxY + boxH / 2);
    }

    c.fillStyle = band.flag;
    c.font = '800 84px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(String(state.score), W / 2, 838);
    c.fillStyle = 'rgba(255,255,255,0.72)';
    c.font = '600 26px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(
      copy.finalDistanceLabel + ' ' + game.meters(state) + copy.meterLabel +
      '  ·  ' + copy.finalFlagLabel + ' ' + state.flags +
      '  ·  ' + copy.finalCarveLabel + ' ' + state.carves,
      W / 2,
      880
    );
    c.font = '400 24px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(copy.finalSpeedLabel + ' ' + game.topKmh(state) + ' km/h', W / 2, 916);
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
    root.addEventListener('keydown', onKeyDown);
    root.document.addEventListener('visibilitychange', function () {
      if (!root.document.hidden) loop();
    });

    $('startBtn').addEventListener('click', startRun);
    $('againBtn').addEventListener('click', startRun);
    $('saveBtn').addEventListener('click', saveCard);
    $('muteBtn').addEventListener('click', function () {
      muted = !muted;
      audio.setMuted(muted);
      this.textContent = muted ? copy.muteOff : copy.muteOn;
      this.setAttribute('aria-pressed', muted ? 'false' : 'true');
      storage.write('dune-muted', muted ? 1 : 0);
    });
  }

  /* ---------- 启动 ---------- */
  function init() {
    renderer = root.DuneRender.createRenderer($('field'));
    renderer.resize();
    root.__duneRenderer = renderer;

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
    $('distanceLabel').textContent = copy.distanceLabel;
    $('flagLabel').textContent = copy.flagLabel;
    $('speedLabel').textContent = copy.speedLabel;
    $('carveLabel').textContent = copy.carveLabel;

    bind();

    storage.loaded.then(function () {
      bestScore = Number(storage.read('dune-best-score')) || 0;
      var run = storage.read('dune-best-run');
      bestRun = null;
      if (run) {
        try {
          bestRun = typeof run === 'string' ? JSON.parse(run) : run;
        } catch (error) {
          bestRun = null;
        }
      }
      $('bestHint').textContent = bestScore ? copy.finalBestLabel + ' ' + bestScore : '';
      var muteFlag = Number(storage.read('dune-muted')) || 0;
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
  root.__duneState = null;
  root.__dunePhase = function () { return phase; };
  root.__duneStart = startRun;
})(typeof window !== 'undefined' ? window : global);
