/*
 * 沙丘速降 · 主逻辑（eazo 原版 1:1 复刻）
 *
 * 页面状态机照抄原版：cover(封面) / play(游玩) / result(结算)，
 *   对应本文件 phase = intro / run / over；非 play 状态一律 cruise 巡航。
 * 每帧只做原版循环做的事：
 *   dt = min(48, now − last)；p、u、d 由 game.step 计算；
 *   输入是原版橡皮筋：按下记录手指位置，移动更新，抬起松开；
 *   HUD 只有原版两个字段：{米数}m · 🚩{旗门数}；
 *   教程第一次按下后收起（原版 seenHowTo 行为）；
 *   dead > 700ms 后进入结算，结算面板字段照抄原版 resultTitle/米/旗门。
 *
 * 我方在原版之外保留的部分（不改变任何玩法数值）：
 *   · Web Audio 合成音（穿门/错门/被追上/风声/轰鸣）；
 *   · 玻璃 HUD 卡与面板视觉；宿主避让布局改为「画布全屏 + 顶栏/底栏浮层」，
 *     物理几何与原版同为视口坐标（u=屏高×0.66），旗门预判窗口不再被顶栏挤压；
 *   · 结构化最佳纪录（米数+旗门数）与静音偏好；
 *   · 720×960 结算卡的容器保存兜底。
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
  var phase = 'intro';      /* intro=cover · run=play · over=result */
  var muted = false;
  var bestRun = null;
  var raf = 0;
  var lastStamp = 0;
  var seenHowTo = false;    /* 原版：第一次按下后本局不再显示教程 */
  var prevGates = 0;
  var prevDead = 0;
  var canvasRect = null;

  function $(id) { return root.document.getElementById(id); }

  /* ---------- 布局 ---------- */
  function relayout() {
    var viewportH = root.innerHeight || root.document.documentElement.clientHeight;
    if (viewportH > 0) {
      root.document.documentElement.style.setProperty('--app-height', viewportH + 'px');
    }
    renderer.resize();
    canvasRect = $('field').getBoundingClientRect();
  }

  /* ---------- HUD（原版字段：{m}m · 🚩{gates}；原版每帧刷新，这里同样每帧刷新） ---------- */
  function updateHud() {
    if (!state) return;
    var m = String(game.meters(state));
    if ($('distance').textContent !== m) $('distance').textContent = m;
    var g = String(state.gates);
    if ($('flagCount').textContent !== g) $('flagCount').textContent = g;
  }

  /* ---------- 输入（原版橡皮筋：手指位置即拖拽目标） ---------- */
  function isInteractiveTarget(e) {
    var t = e.target;
    return !!(t && t.closest && t.closest('button, a, input, .panel-layer'));
  }

  function onPointerDown(e) {
    if (phase !== 'run' || !state) return;
    if (isInteractiveTarget(e)) return;
    seenHowTo = true;
    $('howto').hidden = true;
    audio.resume();
    game.setDrag(state, e.clientX - canvasRect.left);
    if (e.pointerId !== undefined && this.setPointerCapture) {
      try {
        this.setPointerCapture(e.pointerId);
      } catch (error) {
        /* 某些内核不支持，忽略 */
      }
    }
  }

  function onPointerMove(e) {
    if (phase !== 'run' || !state || !state.drag.on) return;
    game.moveDrag(state, e.clientX - canvasRect.left);
  }

  function onPointerUp(e) {
    if (!state) return;
    game.releaseDrag(state);
    if (e && e.pointerId !== undefined && this.releasePointerCapture) {
      try {
        this.releasePointerCapture(e.pointerId);
      } catch (error) {
        /* 忽略 */
      }
    }
  }

  /* ---------- 音效触发（观测层：不改玩法数值） ---------- */
  function detectAudioCues() {
    if (phase !== 'run') return;
    if (state.gates > prevGates) {
      audio.playGate();
      prevGates = state.gates;
    }
    for (var i = 0; i < state.gateList.length; i++) {
      var g = state.gateList[i];
      if (g.passed === 2 && !g.missSeen) {
        g.missSeen = true;
        audio.playGateMiss();
      }
    }
    if (!prevDead && state.dead) audio.playOver();
    prevDead = state.dead;
  }

  /* ---------- 每帧（照抄原版循环结构） ---------- */
  function frame(stamp) {
    raf = 0;
    if (root.document.hidden) return;
    var now = stamp || 0;
    var dtMs = lastStamp ? now - lastStamp : 0;
    lastStamp = now;
    /* 画布 CSS 尺寸每帧校对：顶栏品牌卡 ↔ HUD 胶囊切换、宿主地址栏伸缩
       都不触发 resize 事件，缓冲不跟上会把整幅画面拉伸变形 */
    if (renderer.ensureSize()) {
      canvasRect = $('field').getBoundingClientRect();
    }
    var mode = phase === 'run' ? 'play' : 'cruise';
    var size = renderer.getSize();
    var view = game.step(state, dtMs, {
      width: size.w,
      height: size.h,
      mode: mode,
      now: now
    });
    detectAudioCues();
    renderer.render({
      state: state,
      palette: content.palette,
      visual: content.meta.visual,
      mode: mode,
      u: view.u,
      d: view.d,
      now: now,
      veil: phase === 'intro'
    });
    audio.setSpeed(view.p);
    audio.setDanger(state.ava);
    if (phase === 'run') updateHud();
    if (phase === 'run' && state.finished) {
      onCaught();
      return;
    }
    raf = root.requestAnimationFrame(frame);
  }

  function loop() {
    if (!raf && !root.document.hidden) raf = root.requestAnimationFrame(frame);
  }

  /* ---------- 流程 ---------- */
  function startRun() {
    var w = renderer.getSize().w;
    state = game.createRun(w);
    game.startRun(state, w);
    root.__duneState = state;
    phase = 'run';
    prevGates = 0;
    prevDead = 0;
    $('hud').hidden = false;
    $('intro').hidden = true;
    $('result').hidden = true;
    $('howto').hidden = seenHowTo;
    root.document.body.className = 'playing';
    updateHud();
    audio.resume();
    loop();
  }

  function onCaught() {
    phase = 'over';
    audio.silence();
    var metersNum = game.meters(state);
    var isNew = !bestRun || metersNum > bestRun.meters;
    if (isNew) {
      bestRun = { meters: metersNum, gates: state.gates };
      storage.write('dune-best-run', bestRun);
    }

    $('resultTitle').textContent = copy.resultTitle;
    $('resultMeters').textContent = String(metersNum);
    $('resultSub').textContent = copy.resultSub;
    $('resultFlags').textContent = state.gates + ' ' + copy.gates;
    $('bestFlag').hidden = !isNew;
    $('shareStatus').textContent = '';
    buildShareCard();
    $('result').hidden = false;
    $('howto').hidden = true;
    root.document.body.className = '';
    updateHud();
    /* 原版结算页背景继续自动巡航滚动：rAF 循环不能停 */
    loop();
  }

  /* ---------- 720×960 结算卡（原版 M() 画法照抄） ---------- */
  function buildShareCard() {
    var canvas = $('shareCard');
    canvas.width = 720;
    canvas.height = 960;
    var c = canvas.getContext('2d');
    if (!c) return;
    c.fillStyle = '#20143a';
    c.fillRect(0, 0, 720, 960);
    var sky = c.createLinearGradient(0, 0, 0, 470);
    sky.addColorStop(0, '#1d1238');
    sky.addColorStop(0.5, '#6b3455');
    sky.addColorStop(1, '#e08b4c');
    c.fillStyle = sky;
    c.fillRect(0, 0, 720, 470);
    var sand = c.createLinearGradient(0, 420, 0, 960);
    sand.addColorStop(0, '#e6a55c');
    sand.addColorStop(0.4, '#c9793a');
    sand.addColorStop(1, '#6d3a1c');
    c.fillStyle = sand;
    c.beginPath();
    c.moveTo(0, 470);
    for (var x = 0; x <= 720; x += 20) c.lineTo(x, 440 + 30 * Math.sin(0.008 * x));
    c.lineTo(720, 960);
    c.lineTo(0, 960);
    c.closePath();
    c.fill();
    c.globalCompositeOperation = 'lighter';
    var sun = c.createRadialGradient(520, 400, 8, 520, 400, 220);
    sun.addColorStop(0, 'rgba(255,220,150,0.6)');
    sun.addColorStop(1, 'rgba(255,190,110,0)');
    c.fillStyle = sun;
    c.beginPath();
    c.arc(520, 400, 220, 0, Math.PI * 2);
    c.fill();
    c.globalCompositeOperation = 'source-over';

    /* 滑降线（原版：起点底部 → 终点顶部，横向 90..630，纵向 500..900） */
    var trail = state.trail;
    if (trail.length > 1) {
      c.strokeStyle = 'rgba(255,246,222,0.9)';
      c.lineWidth = 6;
      c.lineCap = 'round';
      c.beginPath();
      var y0 = trail[0].y || 0;
      var span = Math.max(1, (trail[trail.length - 1].y || 1) - y0);
      for (var i = 0; i < trail.length; i++) {
        var n = (trail[i].y - y0) / span;
        var px = 90 + 540 * trail[i].x;
        var py = 500 + 400 * n;
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.stroke();
    }

    c.textAlign = 'center';
    c.fillStyle = 'rgba(0,0,0,0.42)';
    c.fillRect(0, 50, 720, 190);
    c.fillStyle = '#ffe6c0';
    c.font = '700 130px system-ui';
    c.fillText(String(game.meters(state)), 360, 176);
    c.fillStyle = 'rgba(255,244,226,0.9)';
    c.font = '500 32px system-ui';
    c.fillText(copy.shareCardCaption + ' · ' + state.gates + ' gates', 360, 224);
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.font = '600 28px system-ui';
    c.fillText(copy.shareCardBrand, 360, 930);
    c.textAlign = 'left';
  }

  /* 分享 = 容器保存兜底（原版是发送到 Eazo，本工具无该后端） */
  function saveShareCard() {
    var canvas = $('shareCard');
    var status = $('shareStatus');
    var api = root.xhs && root.xhs.miniTool;
    if (!api || typeof api.saveImageToPhotosAlbum !== 'function') {
      status.textContent = copy.shareWeb;
      return;
    }
    try {
      var dataUrl = canvas.toDataURL('image/png');
      Promise.resolve(api.saveImageToPhotosAlbum({ filePath: dataUrl })).then(function () {
        status.textContent = copy.sharedOk;
      }).catch(function () {
        status.textContent = copy.saveFailed;
      });
    } catch (error) {
      status.textContent = copy.saveFailed;
    }
  }

  /* ---------- 事件 ---------- */
  function bind() {
    var appEl = $('app');
    appEl.addEventListener('pointerdown', onPointerDown);
    appEl.addEventListener('pointermove', onPointerMove);
    appEl.addEventListener('pointerup', onPointerUp);
    appEl.addEventListener('pointercancel', onPointerUp);

    root.addEventListener('resize', relayout);
    root.addEventListener('orientationchange', function () { setTimeout(relayout, 220); });
    root.document.addEventListener('visibilitychange', function () {
      if (!root.document.hidden) {
        lastStamp = 0;
        loop();
      }
    });

    $('startBtn').addEventListener('click', startRun);
    $('againBtn').addEventListener('click', startRun);
    $('shareBtn').addEventListener('click', saveShareCard);
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
    relayout();

    $('title').textContent = content.meta.title;
    $('subtitle').textContent = copy.tagline;
    $('startTitle').textContent = content.brand.toolName;
    $('tagline').textContent = copy.tagline;
    var lines = $('startLines');
    lines.innerHTML = '';
    var howtos = [copy.howto1, copy.howto2];
    for (var i = 0; i < howtos.length; i++) {
      var p = root.document.createElement('p');
      p.textContent = howtos[i];
      lines.appendChild(p);
    }
    $('startBtn').textContent = copy.enter;
    $('againBtn').textContent = copy.replay;
    $('shareBtn').textContent = copy.share;
    $('howtoText').textContent = copy.hint;
    $('bestFlag').textContent = copy.newBest;

    bind();

    /* 封面背景：原版加载时即生成门并开始巡航滚动 */
    state = game.createRun(renderer.getSize().w);
    game.ensureGates(state, 2600, renderer.getSize().w);
    root.__duneState = state;
    loop();

    storage.loaded.then(function () {
      var run = storage.read('dune-best-run');
      bestRun = null;
      if (run) {
        try {
          bestRun = typeof run === 'string' ? JSON.parse(run) : run;
        } catch (error) {
          bestRun = null;
        }
      }
      if (!bestRun || !bestRun.meters) bestRun = null;
      $('bestHint').textContent = bestRun
        ? copy.finalBestLabel + ' ' + bestRun.meters + ' ' + copy.meterLabel
        : '';
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
  root.__dunePhase = function () { return phase; };
  root.__duneStart = startRun;
})(typeof window !== 'undefined' ? window : global);
