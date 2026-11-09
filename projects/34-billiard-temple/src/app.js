/*
 * 弹珠神殿（玉球金殿）· 主逻辑 —— 三期严格 1:1 复刻
 *
 * 流程与原版一致（除保留的壳层 UI）：
 *   · 封面/结算背后是演示模式（区域 0.07/0.44，玉球自动滚动，静默收宝石，收齐重撒）；
 *   · 玩法中：弹弓按住玉球向后拖 → 松手发射；球在滚动中也允许补杆；
 *   · 一殿结束（收齐或杆尽滑停）直接进下一殿，没有中转面板；第 8 殿结束进结算；
 *   · HUD 字段与原版一致：{殿}/8 · 🎯杆数 · 💠宝石；
 *   · 提示 chip（标题/标语/howto1）与底部手势提示只在第一杆前显示（原版 b 标志）；
 *   · 结算：你的神来一杆 / 宝石数 / 颗宝石 + 分享（保存技巧卡）+ 再玩一次。
 *
 * 保留的二期能力：演出体系（爆闪/环波/新生光环/慢镜/横幅）、五声音阶音效、
 * 图鉴体系、结构化本地存档（图鉴 + 静音偏好）、输入 bug 修复（见 game.js 头注）。
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
  var phase = 'intro';      /* intro | play | result */
  /* 弹弓输入状态机：按住拖动绝不发射，松手那一刻才结算（详见 game.createAimInput） */
  var aim = null;
  var comboCount = 0;       /* 本杆连锁计数：音阶递进与演出强度用 */
  var codex = [];
  var muted = false;
  var raf = 0;
  var lastFrame = 0;
  var slowMo = 0;           /* 慢镜剩余秒数：大连锁的高光时刻 */
  var shotsUsedInRoom = 0;  /* 本殿已用杆数（一杆清空演出判定） */
  var gemsAtRoomStart = 0;  /* 本殿开始时已收宝石总数 */
  var firstPointerDone = false; /* 原版 b 标志：第一杆前的提示 chip */

  function nowMs() {
    return root.performance && root.performance.now ? root.performance.now() : Date.now();
  }

  function pointerIdOf(e) {
    return e && e.pointerId !== undefined ? e.pointerId : 1;
  }

  function $(id) { return root.document.getElementById(id); }

  /* ---------- 布局 ---------- */
  function relayout() {
    var viewportH = root.innerHeight || root.document.documentElement.clientHeight;
    if (viewportH > 0) {
      root.document.documentElement.style.setProperty('--app-height', viewportH + 'px');
    }
    if (renderer.resize() && state) {
      var size = renderer.getSize();
      game.setViewport(state, size.w, size.h);
    }
  }

  function roomDef(index) {
    var rooms = content.meta.rooms;
    var i = Math.max(0, Math.min(rooms.length - 1, index));
    return rooms[i];
  }

  function themeOf(index) {
    return content.meta.themes[roomDef(index).theme] || content.meta.themes.gold;
  }

  function gemStyleOf(index) {
    var rooms = content.meta.rooms;
    var gemIndex = rooms[Math.max(0, Math.min(rooms.length - 1, index))].gem;
    return content.meta.gems[gemIndex] || content.meta.gems[0];
  }

  function feedback() {
    return content.meta.feedback || {};
  }

  /* ---------- HUD ---------- */
  function buildRibbon() {
    var wrap = $('codexRibbon');
    if (!wrap) return;
    wrap.innerHTML = '';
    for (var i = 0; i < content.meta.gems.length; i++) {
      var cell = root.document.createElement('span');
      cell.className = 'codex-slot';
      cell.setAttribute('data-index', String(i));
      wrap.appendChild(cell);
    }
  }

  function updateRibbon() {
    var wrap = $('codexRibbon');
    if (!wrap) return;
    var slots = wrap.getElementsByTagName('span');
    for (var i = 0; i < slots.length; i++) {
      var on = codex.indexOf(i) >= 0;
      var cell = slots[i];
      if (on) cell.className = 'codex-slot on';
      else cell.className = 'codex-slot';
      cell.style.background = on ? content.meta.gems[i].color : '';
      cell.style.boxShadow = on ? '0 0 10px ' + content.meta.gems[i].glow : '';
    }
  }

  function updateHud() {
    if (!state) return;
    $('chamberRoom').textContent = state.room + '/8';
    $('chamberName').textContent = roomDef(state.room - 1).name;
    $('shotsLeft').textContent = String(state.shots);
    $('gemCount').textContent = String(state.gems);
    var pct = Math.round((state.room / game.ROOM_COUNT) * 100);
    $('progressFill').style.width = pct + '%';
    $('progressBar').setAttribute('aria-valuenow', String(pct));
    /* 外壳也跟着换色：整块屏幕属于同一座殿堂 */
    var theme = themeOf(state.room - 1);
    var rootStyle = root.document.documentElement.style;
    rootStyle.setProperty('--shell-top', theme.top);
    rootStyle.setProperty('--shell-mid', theme.bottom);
    rootStyle.setProperty('--shell-bottom', theme.floor);
    updateRibbon();
  }

  function setHints(visible) {
    var chip = $('hintChip');
    var gesture = $('gestureHint');
    if (chip) chip.hidden = !visible;
    if (gesture) gesture.hidden = !visible;
  }

  /* ---------- 瞄准（弹弓：向后拖，松手才发射） ---------- */
  function canAim() {
    return phase === 'play' && state && state.mode === 'play' && state.shots > 0;
  }

  function onPointerDown(e) {
    if (!canAim()) return;
    if (e.target.closest && e.target.closest('button, a, input, .panel')) return;
    var p = renderer.toArena(e.clientX, e.clientY);
    /* 状态机拒收第二根手指；已在瞄准时重复按下也不会重置瞄准 */
    if (!aim.down(pointerIdOf(e), p.x, p.y, state.ball.x, state.ball.y, nowMs())) return;
    /* 原版 b 标志：第一次按下就收起提示 chip 与手势提示 */
    if (!firstPointerDone) {
      firstPointerDone = true;
      setHints(false);
    }
    audio.resume();
    /* 抓住指针：拖到画面外再松手，这一杆照样打出去 */
    if (e.pointerId !== undefined && this.setPointerCapture) {
      try {
        this.setPointerCapture(e.pointerId);
      } catch (error) {
        /* 某些内核不支持，忽略即可 */
      }
    }
  }

  function onPointerMove(e) {
    if (!state || !aim) return;
    var p = renderer.toArena(e.clientX, e.clientY);
    aim.move(pointerIdOf(e), p.x, p.y, state.ball.x, state.ball.y);
  }

  function onPointerUp(e) {
    if (!aim) return;
    var pid = pointerIdOf(e);
    var result = aim.up(pid, nowMs());
    if (e && e.pointerId !== undefined && this.releasePointerCapture) {
      try {
        this.releasePointerCapture(e.pointerId);
      } catch (error) {
        /* 忽略 */
      }
    }
    if (!result.fired) return;
    fireShot(result);
  }

  /*
   * pointercancel = 手势被浏览器 / 系统接管（滚动、来电、多任务手势）。
   * 它不是「松手」：必须中止瞄准且绝不发射——这正是真机上「还没松手就发射」的根因。
   * （保留的输入修复；原版把 cancel 当作发射处理，属原版缺陷，此处不照抄——见回执。）
   */
  function onPointerCancel(e) {
    if (!aim) return;
    aim.cancel(pointerIdOf(e));
    if (e && e.pointerId !== undefined && this.releasePointerCapture) {
      try {
        this.releasePointerCapture(e.pointerId);
      } catch (error) {
        /* 忽略 */
      }
    }
  }

  /* 原版 D：替换当前速度（允许滚动中补杆），扣 1 杆 */
  function fireShot(aimResult) {
    if (!canAim()) return;
    var fired = game.launchFromAim(state, aimResult);
    if (!fired) return;
    comboCount = 0;
    shotsUsedInRoom += 1;
    audio.playShoot(aimResult.power / game.LAUNCH_MAX);
    updateHud();
  }

  /* ---------- 每帧 ---------- */
  function update(dt) {
    if (!state) return;
    renderer.updateEffects(dt);
    game.frame(state, dt * 1000);
    consumeEvents();
  }

  /*
   * 连锁事件：每颗宝石被撞到都会变身成新的连锁球。
   * 演出：爆闪 + 环波 + 新生光环（复用宝石特效体系）；音阶按连锁进度递进；
   * 连锁到里程碑（3 / 6 颗）时慢镜 + 屏震 + 横幅，连锁越大演出越强。
   */
  function consumeEvents() {
    var events = game.takeEvents(state);
    var fb = feedback();
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      if (ev.t === 'fire') {
        comboCount = 0;
      } else if (ev.t === 'bounce') {
        audio.playBounce(1);
        renderer.ring(ev.x, ev.y, 'rgba(255,255,255,0.4)', 24, 0.3);
      } else if (ev.t === 'gem') {
        comboCount += 1;
        var style = gemStyleOf(state.room - 1);
        renderer.convertFx(ev.x, ev.y, style.color, style.glow, fb.gemRing);
        audio.playGem(state.room - 1, comboCount - 1);
        var milestone = fb.chainMilestone || 3;
        var bigMilestone = fb.chainBigMilestone || 6;
        if (comboCount === milestone) {
          renderer.shake(0.3);
          slowMo = Math.max(slowMo, fb.chainPulseTime || 0.42);
          showFlash(copy.comboLabel.replace('%d', comboCount));
        } else if (comboCount >= bigMilestone && (comboCount - bigMilestone) % 3 === 0) {
          renderer.shake(0.5);
          renderer.flash(fb.chainShowScale || 0.4, style.glow);
          slowMo = Math.max(slowMo, fb.chainShowTime || 0.85);
          showFlash(copy.comboLabel.replace('%d', comboCount));
        }
      } else if (ev.t === 'room') {
        onRoomAdvanced(ev);
      } else if (ev.t === 'finish') {
        onRunFinished(ev.gems);
      }
    }
  }

  /* 一杆清空一殿：全屏光爆 + 慢镜（本款的高光时刻，演出保留） */
  function maybeOneShotFx() {
    var prevRoom = Math.max(1, state.room - 1);
    var roomGems = game.gemsForRoom(Math.min(prevRoom, game.ROOM_COUNT));
    var swept = state.gems - gemsAtRoomStart;
    if (shotsUsedInRoom === 1 && swept >= roomGems) {
      var fb = feedback();
      renderer.flash(fb.clearFlash || 0.85, '#fff3c4');
      renderer.shake(0.55);
      renderer.ring(state.ball.x, state.ball.y, '#fff3c4', 120, 0.9);
      slowMo = fb.clearSlowMoTime || 1.15;
      audio.playOneShotClear();
      showFlash(copy.oneShotFlash || '一杆清空！');
    }
  }

  /* 殿堂推进（原版无中转面板，直接进下一殿）：图鉴点亮 + 演出 */
  function onRoomAdvanced(ev) {
    var cleared = typeof ev.cleared === 'number' ? ev.cleared : ev.room - 1;
    if (codex.indexOf(cleared) < 0) {
      codex.push(cleared);
      storage.write('temple-codex', codex);
    }
    maybeOneShotFx();
    shotsUsedInRoom = 0;
    gemsAtRoomStart = state.gems;
    updateHud();
  }

  /* 屏幕上的提示条（DOM，不是画布文字） */
  function showFlash(text) {
    var el = $('flash');
    if (!el) return;
    el.textContent = text;
    el.className = 'show';
    root.setTimeout(function () {
      el.className = '';
    }, 1400);
  }

  function frame(stamp) {
    raf = 0;
    if (root.document.hidden) return;
    var now = stamp || performance.now();
    var dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0.016;
    lastFrame = now;
    if (slowMo > 0) {
      slowMo -= dt;
      dt *= feedback().clearSlowMo || 0.32;
    }
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
    var roomIndex = Math.max(0, state.room - 1);
    var theme = themeOf(roomIndex);
    var style = gemStyleOf(roomIndex);
    var gems = [];
    for (var j = 0; j < state.gemList.length; j++) {
      gems.push({
        x: state.gemList[j].x,
        y: state.gemList[j].y,
        got: state.gemList[j].got,
        ph: state.gemList[j].ph,
        style: style
      });
    }
    var chains = [];
    for (var b = 0; b < state.chains.length; b++) {
      chains.push({ x: state.chains[b].x, y: state.chains[b].y });
    }
    var aimState = aim ? aim.getAim() : { active: false, angle: 0, dist: 0, power: 0 };
    var charge = 0;
    if (aimState.active && phase === 'play') {
      charge = (aimState.power || 0) / (game.LAUNCH_MAX || 0.62);
      if (charge < 0) charge = 0;
      if (charge > 1) charge = 1;
    }
    var view = {
      theme: theme,
      area: state.area,
      ball: { x: state.ball.x, y: state.ball.y },
      ballStyle: content.meta.ball,
      chains: chains,
      chainStyle: style,
      gems: gems,
      trail: state.trail,
      particles: state.particles,
      charge: charge,
      aim: null
    };
    if (aimState.active && phase === 'play' && state.mode === 'play') {
      view.aim = { active: true, angle: aimState.angle, dist: aimState.dist, power: aimState.power };
    }
    return view;
  }

  /* ---------- 流程 ---------- */
  function startRun() {
    if (!state) return;
    game.setMode(state, 'play');
    game.restart(state);
    phase = 'play';
    comboCount = 0;
    slowMo = 0;
    shotsUsedInRoom = 0;
    gemsAtRoomStart = 0;
    firstPointerDone = false;
    if (aim) aim.reset();
    renderer.clearEffects();
    $('hud').hidden = false;
    $('intro').hidden = true;
    $('result').hidden = true;
    setHints(true);
    updateHud();
    audio.resume();
    loop();
  }

  /* 结算（原版 U：你的神来一杆 / 宝石数 / 颗宝石） */
  function onRunFinished(totalGems) {
    phase = 'result';
    audio.playSuccess();
    if (codex.indexOf(game.ROOM_COUNT - 1) < 0) {
      codex.push(game.ROOM_COUNT - 1);
      storage.write('temple-codex', codex);
    }
    $('resultTitle').textContent = copy.resultTitle;
    $('resultGems').textContent = String(totalGems);
    $('resultSub').textContent = copy.resultSub;
    $('againBtn').textContent = copy.againButton;
    $('saveBtn').textContent = copy.saveButton;
    $('shelfLabel').textContent = copy.codexLabel;
    buildCodex();
    buildTrickCard(totalGems);
    $('hud').hidden = true;
    setHints(false);
    $('result').hidden = false;
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

  /* ---------- 技巧卡（原版 z：720×960 金殿 + 最佳单殿路径 + 宝石数） ---------- */
  function buildTrickCard(totalGems) {
    var canvas = $('shareCard');
    var c = canvas.getContext('2d');
    var W = canvas.width;   /* 720 */
    var H = canvas.height;  /* 960 */

    /* 背景（原版配色） */
    var grad = c.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1b1206');
    grad.addColorStop(0.5, '#33220b');
    grad.addColorStop(1, '#140d05');
    c.fillStyle = grad;
    c.fillRect(0, 0, W, H);

    /* 中央金光 */
    c.globalCompositeOperation = 'lighter';
    var glow = c.createRadialGradient(360, 520, 20, 360, 520, 420);
    glow.addColorStop(0, 'rgba(255,208,110,0.2)');
    glow.addColorStop(1, 'rgba(255,180,70,0)');
    c.fillStyle = glow;
    c.beginPath();
    c.arc(360, 520, 420, 0, Math.PI * 2);
    c.fill();
    c.globalCompositeOperation = 'source-over';

    /* 金殿边框与立柱（原版布局） */
    c.strokeStyle = '#d8ab54';
    c.lineWidth = 8;
    c.strokeRect(70, 300, 580, 480);
    c.lineWidth = 2;
    c.strokeRect(86, 316, 548, 448);
    var pillarX = [70, 650];
    for (var p = 0; p < pillarX.length; p++) {
      var px = pillarX[p];
      c.fillStyle = '#c99b45';
      c.fillRect(px - 14, 300, 28, 480);
      c.fillStyle = 'rgba(255,230,170,0.35)';
      c.fillRect(px - 14, 300, 8, 480);
    }

    /* 最佳单殿路径（原版映射：86+548*x / 316+448*y） */
    var path = state && state.bestPath ? state.bestPath : [];
    if (path.length > 1) {
      c.strokeStyle = 'rgba(150,255,215,0.85)';
      c.lineWidth = 4;
      c.beginPath();
      for (var i = 0; i < path.length; i++) {
        var mx = 86 + 548 * (path[i].x || 0);
        var my = 316 + 448 * (path[i].y || 0);
        if (i === 0) c.moveTo(mx, my);
        else c.lineTo(mx, my);
      }
      c.stroke();
      c.globalCompositeOperation = 'lighter';
      for (var d = 0; d < path.length; d += 3) {
        var dx = 86 + 548 * (path[d].x || 0);
        var dy = 316 + 448 * (path[d].y || 0);
        var dot = c.createRadialGradient(dx, dy, 0, dx, dy, 22);
        dot.addColorStop(0, 'rgba(150,255,215,0.5)');
        dot.addColorStop(1, 'rgba(150,255,215,0)');
        c.fillStyle = dot;
        c.beginPath();
        c.arc(dx, dy, 26, 0, Math.PI * 2);
        c.fill();
      }
      c.globalCompositeOperation = 'source-over';
    }

    /* 标题数字与文案（原版：大数字 + gems swept · N chambers + Billiard Temple） */
    c.textAlign = 'center';
    c.fillStyle = 'rgba(0,0,0,0.4)';
    c.fillRect(0, 60, 720, 200);
    c.fillStyle = '#ffd98d';
    c.font = '700 130px system-ui, -apple-system, "PingFang SC", sans-serif';
    c.fillText(String(totalGems), 360, 190);
    c.fillStyle = 'rgba(255,240,214,0.9)';
    c.font = '500 32px system-ui, -apple-system, "PingFang SC", sans-serif';
    c.fillText(copy.shareCanvasSub + ' \u00b7 ' + game.ROOM_COUNT + ' chambers', 360, 240);
    c.fillStyle = 'rgba(255,255,255,0.5)';
    c.font = '600 28px system-ui, -apple-system, "PingFang SC", sans-serif';
    c.fillText(copy.shareCanvasFooter, 360, 918);
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
    /* 手势被系统接管时绝不当作「松手」：中止瞄准，不发射 */
    canvasEl.addEventListener('pointercancel', onPointerCancel);

    root.addEventListener('resize', relayout);
    root.addEventListener('orientationchange', function () { setTimeout(relayout, 220); });
    root.document.addEventListener('visibilitychange', function () {
      if (root.document.hidden) {
        /* 切走时若有未完成的瞄准，作废它：回来后不残留半截手势 */
        if (aim) aim.reset();
      } else {
        loop();
      }
    });

    $('startBtn').addEventListener('click', startRun);
    $('againBtn').addEventListener('click', startRun);
    $('saveBtn').addEventListener('click', saveCard);

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
    aim = game.createAimInput({
      minDrag: game.AIM_MIN_DRAG,
      minHoldMs: game.AIM_MIN_HOLD_MS
    });

    var size = renderer.getSize();
    state = game.createRun(content, Math.max(1, size.w), Math.max(1, size.h));
    root.__templeState = state;

    $('subtitle').textContent = content.brand.tagline;
    $('title').textContent = content.brand.toolName;
    $('startTitle').textContent = content.brand.toolName;
    var lines = $('startLines');
    lines.innerHTML = '';
    for (var i = 0; i < copy.startLines.length; i++) {
      var p = root.document.createElement('p');
      p.textContent = copy.startLines[i];
      lines.appendChild(p);
    }
    $('startBtn').textContent = copy.startButton;
    $('hintTitle').textContent = copy.title;
    $('hintTagline').textContent = copy.tagline;
    $('hintHowto').textContent = copy.howto1;
    $('gestureText').textContent = copy.hint;
    $('shotsLabel').textContent = '🎯';
    $('gemLabel').textContent = '💠';
    buildRibbon();

    bind();

    storage.loaded.then(function () {
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
      updateRibbon();
      var muteFlag = Number(storage.read('temple-muted')) || 0;
      if (muteFlag) {
        muted = true;
        audio.setMuted(true);
        $('muteBtn').textContent = copy.muteOff;
        $('muteBtn').setAttribute('aria-pressed', 'false');
      }
    });

    loop();
  }

  if (root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* 自检钩子 */
  root.__templePhase = function () { return phase; };
  /*
   * QA 快进：暂停 rAF，按 16.7ms 分片推进玩法帧，再交还循环。
   * 原版语义下「有剩余杆数时主球永不停」，所以快进时周期性补杆（等同玩家操作）。
   */
  root.__templeFastForward = function (ms) {
    if (!state) return;
    if (raf) {
      root.cancelAnimationFrame(raf);
      raf = 0;
    }
    var left = ms || 0;
    var steps = 0;
    while (left > 0 && !state.finished) {
      var step = left > 16.7 ? 16.7 : left;
      if (state.mode === 'play' && state.shots > 0 && (!state.ball.moving || steps % 300 === 0)) {
        game.launchFromAim(state, { fired: true, angle: (steps % 628) / 100, power: 0.5, dist: 120 });
      }
      game.frame(state, step);
      left -= step;
      steps += 1;
      /* 快进期间 rAF 停着，事件队列会溢出（只留 240 条）：
         周期性消化，只处理殿堂推进 / 结算，跳过演出与音效 */
      if (steps % 250 === 0) {
        var drained = game.takeEvents(state);
        for (var i = 0; i < drained.length; i++) {
          if (drained[i].t === 'room') onRoomAdvanced(drained[i]);
        }
      }
    }
    consumeEvents();
    updateHud();
    if (state.finished && phase === 'play') onRunFinished(state.gems);
    loop();
  };
})(typeof window !== 'undefined' ? window : global);
