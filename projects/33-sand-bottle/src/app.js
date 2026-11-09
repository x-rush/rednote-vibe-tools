/*
 * 彩沙瓶 · 主逻辑（三期：严格 1:1 复刻 eazo 原版玩法）
 *
 * 状态机与原版一致：cover → pick → craft → result。
 *   cover  教程行「拖动倾倒并倾斜瓶身。一切都无法撤销。」+ Start Pouring
 *   pick   「选择瓶形」五种瓶型（原版 5 种，参数一字不改）
 *   craft  双工具 Pour / Rod，拖动倒沙（按下 18 粒、移动每帧 10 粒），
 *          tilt 由指针横坐标给出，倒满出现「举到光下」提示；Finish 按钮始终可用
 *   result 背光展示（tilt = .08*sin(3t) 摆动）+ 分享/重玩；重玩回到 pick
 * 全程无撤销、无关卡、无评分——原版没有的东西一律不做。
 * 业务文案来自 content.json（zh/en 双语，含原版全部 22 条文案）。
 * 保留的二期视觉项：木桌场景、厚壁玻璃、逐粒沙、封瓶光爆、收藏图鉴、EN/中文切换。
 */
(function (root) {
  'use strict';

  var content = root.CONTENT;
  var game = root.SandGame;
  var renderer = null;
  var audio = root.SandAudio;
  var storage = root.SandStorage;

  var ALBUM_KEY = 'sand-album-v2';
  var ALBUM_MAX = 40;

  var phase = 'cover';       /* cover | pick | craft | result */
  var locale = 'zh';
  var muted = false;
  var shapeId = 'round';
  var engine = null;         /* craft/result 的沙引擎 */
  var demoEngine = null;     /* cover/pick 背景里的展示瓶 */
  var pours = 0;
  var colorIdx = 0;
  var tool = 'pour';
  var pointerDown = false;
  var lastPt = null;
  var lastViewPos = null;
  var lastPourSound = 0;
  var full = false;
  var lastFillShown = -1;
  var resT = 0;              /* 结果页背光摆动的相位 */

  function $(id) { return root.document.getElementById(id); }

  function copy() {
    var set = content.copy[locale];
    return set || content.copy.zh;
  }

  function now() {
    return root.performance && root.performance.now ? root.performance.now() : Date.now();
  }

  function colorName(c) {
    return locale === 'zh' ? (c.nameZh || c.name) : c.name;
  }

  function shapeName(s) {
    return locale === 'zh' ? (s.nameZh || s.name) : s.name;
  }

  /* 图鉴条目按 id 从业务内容取瓶型名（引擎表没有本地化名） */
  function shapeNameById(id) {
    for (var i = 0; i < content.meta.shapes.length; i++) {
      if (content.meta.shapes[i].id === id) return shapeName(content.meta.shapes[i]);
    }
    return id;
  }

  /* ---------- 布局 ---------- */
  function relayout() {
    var viewportH = root.innerHeight || root.document.documentElement.clientHeight;
    if (viewportH > 0) {
      root.document.documentElement.style.setProperty('--app-height', viewportH + 'px');
    }
    renderer.resize();
  }

  /* ---------- 展示瓶（cover/pick 的背景） ---------- */
  function ensureDemoEngine() {
    if (!demoEngine) {
      demoEngine = new game.SandEngine(game.shapeById('round'));
    }
    var w = renderer.getFieldWidth();
    if (w > 0 && demoEngine.W !== w) {
      demoEngine.resize(w, root.SandRender.ENGINE_H);
    }
    if (demoEngine.W > 0 && !demoEngine.grains.length) {
      demoEngine.demoFill();
    }
  }

  /* ---------- 选瓶页卡片 ---------- */
  function drawShapeThumb(canvas, def) {
    var c = canvas.getContext('2d');
    var W = canvas.width;
    var H = canvas.height;
    c.clearRect(0, 0, W, H);
    /* 用真引擎的 bottleX 画轮廓：缩略图与玩法里的瓶型完全同形 */
    var scratch = new game.SandEngine(def);
    scratch.resize(W - 12, H - 12);
    var top = scratch.topY();
    var bottom = scratch.bottomY();
    var pts = [];
    for (var y = top; y <= bottom; y += 2) {
      var pair = scratch.bottleX(y);
      pts.push([pair[0], pair[1], y]);
    }
    var ox = 6;
    var oy = 6;
    c.save();
    c.beginPath();
    c.moveTo(pts[0][0] + ox, pts[0][2] + oy);
    for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0] + ox, pts[i][2] + oy);
    for (var j = pts.length - 1; j >= 0; j--) c.lineTo(pts[j][1] + ox, pts[j][2] + oy);
    c.closePath();
    /* 瓶里一小层淡色沙，示意「装沙的容器」 */
    c.save();
    c.clip();
    var sand = c.createLinearGradient(0, oy + (bottom - top) * 0.62, 0, oy + bottom - top);
    sand.addColorStop(0, 'rgba(245,197,107,0.30)');
    sand.addColorStop(1, 'rgba(215,163,74,0.42)');
    c.fillStyle = sand;
    c.fillRect(0, oy + (bottom - top) * 0.62, W, bottom - top);
    c.restore();
    c.strokeStyle = 'rgba(255,246,224,0.78)';
    c.lineWidth = 2.2;
    c.stroke();
    c.restore();
    /* 瓶口亮线：提醒瓶颈宽窄 */
    var neckPair = scratch.bottleX(top);
    c.strokeStyle = 'rgba(255,232,178,0.95)';
    c.lineWidth = 2.6;
    c.beginPath();
    c.moveTo(neckPair[0] + ox, top + oy + 1);
    c.lineTo(neckPair[1] + ox, top + oy + 1);
    c.stroke();
  }

  function buildShapeCards() {
    var wrap = $('shapeCards');
    wrap.innerHTML = '';
    var list = content.meta.shapes;
    for (var i = 0; i < list.length; i++) {
      var def = list[i];
      var card = root.document.createElement('button');
      card.className = 'shape-card';
      card.type = 'button';
      card.setAttribute('data-shape', def.id);
      card.setAttribute('aria-label', shapeName(def));
      var canvas = root.document.createElement('canvas');
      canvas.width = 40;
      canvas.height = 64;
      canvas.className = 'shape-thumb';
      drawShapeThumb(canvas, def);
      card.appendChild(canvas);
      var name = root.document.createElement('span');
      name.className = 'shape-name';
      name.textContent = shapeName(def);
      card.appendChild(name);
      var en = root.document.createElement('span');
      en.className = 'shape-desc';
      en.textContent = def.name;
      card.appendChild(en);
      card.addEventListener('click', function (e) {
        var id = e.currentTarget.getAttribute('data-shape');
        if (!id) return;
        startCraft(id);
      });
      wrap.appendChild(card);
    }
  }

  /* ---------- 调色板 ---------- */
  function buildPalette() {
    var wrap = $('swatches');
    var html = '';
    for (var i = 0; i < content.meta.colors.length; i++) {
      html += '<button class="swatch" type="button" role="radio" data-color="' + i + '" ' +
        'style="--chip:' + content.meta.colors[i].hex + '" aria-label="' +
        colorName(content.meta.colors[i]) + '"></button>';
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
    colorIdx = index;
    updatePalette();
    audio.playClick();
  }

  function updatePalette() {
    var buttons = $('swatches').querySelectorAll('.swatch');
    for (var i = 0; i < buttons.length; i++) {
      var on = Number(buttons[i].getAttribute('data-color')) === colorIdx;
      buttons[i].className = on ? 'swatch on' : 'swatch';
      buttons[i].setAttribute('aria-checked', on ? 'true' : 'false');
    }
  }

  /* ---------- 工具 ---------- */
  function onPickTool(e) {
    var next = e.currentTarget.getAttribute('data-tool');
    if (!next || next === tool) return;
    tool = next;
    lastPt = null;
    updateTools();
    updateHint();
    audio.playClick();
  }

  function updateTools() {
    var buttons = root.document.querySelectorAll('.tool');
    for (var i = 0; i < buttons.length; i++) {
      var on = buttons[i].getAttribute('data-tool') === tool;
      buttons[i].className = on ? 'tool on' : 'tool';
      buttons[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  /* ---------- HUD ---------- */
  function updateHint() {
    var text;
    if (full) text = copy().fullBottle;
    else text = tool === 'pour' ? copy().hintPour : copy().hintRod;
    $('craftHint').textContent = text;
  }

  function updateChips() {
    if (!engine) return;
    var fill = engine.fillLevel();
    /* 原版节流：变化超过 .005 才写 DOM */
    if (Math.abs(fill - lastFillShown) > 0.005) {
      lastFillShown = fill;
      $('fillValue').textContent = String(Math.round(100 * Math.min(1, fill))) + '%';
    }
    $('poursValue').textContent = String(pours);
    if (engine.isFull() && !full) {
      full = true;
      updateHint();
    }
  }

  /* ---------- 画布交互（原版指针逻辑 1:1） ---------- */
  function enginePos(e) {
    var canvasEl = $('field');
    var rect = canvasEl.getBoundingClientRect();
    /* 原版映射：(clientX - rect.left) / rect.width * engine.W */
    return {
      x: (e.clientX - rect.left) / rect.width * engine.W,
      y: (e.clientY - rect.top) / rect.height * engine.H
    };
  }

  function viewPos(e) {
    var canvasEl = $('field');
    var rect = canvasEl.getBoundingClientRect();
    var scale = renderer.getScale();
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale
    };
  }

  function onPointerDown(e) {
    if (phase !== 'craft' || !engine) return;
    if (e.target.closest && e.target.closest('button, a, input, .panel')) return;
    audio.resume();
    var pos = enginePos(e);
    pointerDown = true;
    lastPt = pos;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (error) { /* 部分内核不支持 pointer capture，忽略 */ }
    if (tool === 'pour' && !engine.isFull()) {
      var added = engine.pour(pos.x, pos.y, content.meta.colors[colorIdx].hex, 18);
      if (added) {
        pours += 1;
        audio.playPour();
        updateChips();
      }
    }
  }

  function onPointerMove(e) {
    var vpos = viewPos(e);
    lastViewPos = vpos;
    renderer.setPointer(vpos.x, vpos.y, true, pointerDown && phase === 'craft');
    if (!pointerDown || phase !== 'craft' || !engine) return;
    var pos = enginePos(e);
    /* 原版：tilt = clamp((x - W/2) / (W/2), -1, 1) */
    engine.tilt = Math.max(-1, Math.min(1, (pos.x - engine.W / 2) / (engine.W / 2)));
    if (tool !== 'pour' || engine.isFull()) {
      /* rod：只在倒沙工具不适用（或已满）时生效——与原版分支一致 */
      if (tool === 'rod' && lastPt) {
        engine.rod(pos.x, pos.y, pos.x - lastPt.x, pos.y - lastPt.y);
        updateChips();
      }
    } else {
      var added = engine.pour(pos.x, pos.y, content.meta.colors[colorIdx].hex, 10);
      var t = now();
      /* 原版节流：有沙倒出且距上次响声 > 90ms 才播 */
      if (added && t - lastPourSound > 90) {
        lastPourSound = t;
        audio.playPour();
      }
      if (added) updateChips();
    }
    lastPt = pos;
  }

  function onPointerUp() {
    if (lastViewPos) {
      renderer.setPointer(lastViewPos.x, lastViewPos.y, true, false);
    }
    if (!pointerDown) return;
    pointerDown = false;
    if (engine) engine.tilt = 0;
    if (tool === 'rod') lastPt = null;
    audio.playRelease();
  }

  /* ---------- 流程 ---------- */
  function showCover() {
    phase = 'cover';
    $('intro').hidden = false;
    $('shapeSelect').hidden = true;
    $('result').hidden = true;
    $('album').hidden = true;
    hideCraftUi(true);
    ensureDemoEngine();
    renderer.clearEffects();
  }

  function showPick() {
    phase = 'pick';
    engine = null;
    root.__sandEngine = null;
    pours = 0;
    full = false;
    lastFillShown = -1;
    $('intro').hidden = true;
    $('result').hidden = true;
    $('album').hidden = true;
    hideCraftUi(true);
    buildShapeCards();
    $('shapeSelect').hidden = false;
    ensureDemoEngine();
    renderer.clearEffects();
    loop();
  }

  function hideCraftUi(hidden) {
    $('hud').hidden = hidden;
    $('palette').hidden = hidden;
    $('tools').hidden = hidden;
  }

  function startCraft(id) {
    shapeId = id;
    engine = new game.SandEngine(game.shapeById(id));
    renderer.setEngine(engine, 'craft');
    engine.resize(renderer.getFieldWidth(), root.SandRender.ENGINE_H);
    /* 原版行为：进入制作页先灌 420 粒三色演示沙，瓶子从来不是空的 */
    engine.demoFill();
    pours = 0;
    colorIdx = 0;
    tool = 'pour';
    full = false;
    lastFillShown = -1;
    lastPt = null;
    pointerDown = false;
    phase = 'craft';
    root.__sandEngine = engine;
    $('shapeSelect').hidden = true;
    $('intro').hidden = true;
    $('result').hidden = true;
    $('album').hidden = true;
    hideCraftUi(false);
    updatePalette();
    updateTools();
    $('fillValue').textContent = '0%';
    $('poursValue').textContent = '0';
    updateHint();
    audio.resume();
    loop();
  }

  function onSeal() {
    if (phase !== 'craft' || !engine) return;
    /* 原版：Finish 按钮任何时候都能按，直接进结果页 */
    saveAlbumEntry();
    audio.playSeal();
    /* 封瓶演出：瓶子发光 + 彩带 + 收藏卡飞入（视觉保留项） */
    renderer.sealBurst(geomForBurst(), content.meta.colors);
    phase = 'result';
    resT = 0;
    root.__sandPhase = phase;
    hideCraftUi(true);
    renderer.clearEffects();
    $('resultTitle').textContent = copy().resultTitle;
    $('resultHint').textContent = copy().resultHint + ' · ' + pours + ' ' + copy().pours;
    $('albumBtn').textContent = copy().albumOpen;
    $('replayBtn').textContent = copy().replayButton;
    $('saveBtn').textContent = copy().shareButton;
    buildShareCard();
    $('result').hidden = false;
    updateChips();
    loop();
  }

  function geomForBurst() {
    /* 结果页光爆的落点：借用引擎几何 */
    var top = engine.topY();
    var bottom = engine.bottomY();
    var cx = engine.W / 2;
    var pair = engine.bottleX(bottom);
    return {
      cx: cx,
      left: pair[0],
      right: pair[1],
      inner: pair[1] - cx,
      top: top,
      bottom: bottom,
      neckTop: top
    };
  }

  /* ---------- 收藏图鉴 ---------- */
  function readAlbum() {
    var list = storage.read(ALBUM_KEY);
    if (!list || !list.length) return [];
    return list;
  }

  function saveAlbumEntry() {
    var list = readAlbum();
    list.push({
      id: Date.now(),
      shape: shapeId,
      pours: pours,
      fill: Math.round(engine.fillLevel() * 100),
      runs: engine.layerRuns()
    });
    /* 只在本机保存结构化层色清单，新的排前面，超出上限丢最旧的 */
    list.sort(function (a, b) { return b.id - a.id; });
    if (list.length > ALBUM_MAX) list = list.slice(0, ALBUM_MAX);
    storage.write(ALBUM_KEY, list);
  }

  /* 用迷你引擎的 bottleX 画玻璃轮廓；沙按「颜色游程」画成堆叠色带 */
  function drawMiniBottle(c, x, y, w, h, entry) {
    var def = game.shapeById(entry.shape);
    var scratch = new game.SandEngine(def);
    scratch.resize(w - 6, h - 6);
    var top = scratch.topY();
    var bottom = scratch.bottomY();
    var pts = [];
    for (var yy = top; yy <= bottom; yy += 2) {
      var pair = scratch.bottleX(yy);
      pts.push([pair[0], pair[1], yy]);
    }
    var ox = x + 3;
    var oy = y + 3;
    c.save();
    c.beginPath();
    c.moveTo(pts[0][0] + ox, pts[0][2] + oy);
    for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0] + ox, pts[i][2] + oy);
    for (var j = pts.length - 1; j >= 0; j--) c.lineTo(pts[j][1] + ox, pts[j][2] + oy);
    c.closePath();
    c.save();
    c.clip();
    /* 沙按游程画：runs[col] 自底向上，每粒占一格高度 */
    var runs = entry.runs || [];
    var innerLeft = pts[0][0];
    var innerRight = pts[pts.length - 1][1];
    var spanW = innerRight - innerLeft;
    var spanH = bottom - top;
    var maxCount = 1;
    for (var col = 0; col < runs.length; col++) {
      var total = 0;
      for (var r = 0; r < runs[col].length; r++) total += runs[col][r][1];
      if (total > maxCount) maxCount = total;
    }
    var unit = spanH / (maxCount * 1.35);
    for (var c2 = 0; c2 < runs.length; c2++) {
      var list = runs[c2];
      var baseY = bottom;
      for (var k = 0; k < list.length; k++) {
        var run = list[k];
        var rh = run[1] * unit;
        c.fillStyle = run[0];
        c.fillRect(
          innerLeft + ox - x + (c2 / runs.length) * spanW,
          baseY - rh + oy - y,
          spanW / runs.length + 0.6,
          rh + 0.6
        );
        baseY -= rh;
      }
    }
    c.restore();
    c.strokeStyle = 'rgba(255,248,230,0.8)';
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.10)';
    c.fill();
    c.restore();
    /* 高光 */
    c.fillStyle = 'rgba(255,255,255,0.3)';
    c.fillRect(x + w * 0.16, y + h * 0.36, 2.2, h * 0.42);
  }

  function buildAlbum() {
    var list = readAlbum();
    var wrap = $('albumList');
    wrap.innerHTML = '';
    $('albumEmpty').hidden = list.length > 0;
    $('albumCount').textContent = copy().albumCount.replace('%d', list.length);
    for (var i = 0; i < list.length; i++) {
      var entry = list[i];
      var item = root.document.createElement('div');
      item.className = 'album-item';
      var canvas = root.document.createElement('canvas');
      canvas.width = 96;
      canvas.height = 128;
      canvas.className = 'album-bottle';
      item.appendChild(canvas);
      var name = root.document.createElement('span');
      name.className = 'album-name';
      name.textContent = shapeNameById(entry.shape);
      item.appendChild(name);
      var metaLine = root.document.createElement('span');
      metaLine.className = 'album-shape';
      metaLine.textContent = copy().albumPours.replace('%d', entry.pours) +
        ' · ' + copy().albumFill.replace('%d', entry.fill);
      item.appendChild(metaLine);
      wrap.appendChild(item);
      drawMiniBottle(canvas.getContext('2d'), 10, 8, 76, 104, entry);
    }
  }

  function openAlbum() {
    buildAlbum();
    $('albumTitle').textContent = copy().albumTitle;
    $('albumClose').textContent = copy().albumClose;
    $('album').hidden = false;
  }

  function closeAlbum() {
    $('album').hidden = true;
  }

  /* ---------- 纪录卡 ---------- */
  function buildShareCard() {
    var canvas = $('shareCard');
    var c = canvas.getContext('2d');
    var W = canvas.width;
    var H = canvas.height;
    var set = copy();

    var grad = c.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#F5ECCF');
    grad.addColorStop(0.55, '#E7D6AC');
    grad.addColorStop(1, '#A5A296');
    c.fillStyle = grad;
    c.fillRect(0, 0, W, H);

    var glow = c.createRadialGradient(W / 2, 300, 20, W / 2, 300, 420);
    glow.addColorStop(0, 'rgba(255,250,232,0.7)');
    glow.addColorStop(1, 'rgba(255,250,232,0)');
    c.fillStyle = glow;
    c.fillRect(0, 0, W, H);

    c.textAlign = 'center';
    c.fillStyle = '#4C3926';
    c.font = '700 54px Georgia,"Times New Roman",serif';
    c.fillText(locale === 'zh' ? content.brand.toolName : content.brand.titleEn, W / 2, 104);
    c.fillStyle = 'rgba(109,101,87,0.9)';
    c.font = '400 26px Georgia,"Times New Roman",serif';
    c.fillText(set.resultHint, W / 2, 146);

    if (engine) {
      var entry = { shape: shapeId, runs: engine.layerRuns() };
      drawMiniBottle(c, (W - 260) / 2, 190, 260, 470, entry);
    }

    c.fillStyle = '#4C3926';
    c.font = '700 40px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(pours + ' ' + set.pours, W / 2, 712);
    c.fillStyle = '#8D5A3B';
    c.font = '400 26px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(set.fillLabel + ' ' + (engine ? Math.round(engine.fillLevel() * 100) : 0) + '%', W / 2, 758);

    c.fillStyle = '#B96C3F';
    c.globalAlpha = 0.6;
    c.fillRect(W / 2 - 90, 800, 180, 3);
    c.globalAlpha = 1;
    c.fillStyle = 'rgba(109,101,87,0.75)';
    c.font = '400 22px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(locale === 'zh' ? '长按图片可保存' : 'Press and hold to save', W / 2, 846);
    c.textAlign = 'left';
  }

  function saveCard() {
    var card = $('shareCard');
    var status = $('saveStatus');
    var api = root.xhs && root.xhs.miniTool;
    if (!api || typeof api.saveImageToPhotosAlbum !== 'function') {
      status.textContent = copy().saveUnavailable;
      return;
    }
    try {
      var dataUrl = card.toDataURL('image/png');
      Promise.resolve(api.saveImageToPhotosAlbum({ filePath: dataUrl })).then(function () {
        status.textContent = copy().saved;
      }).catch(function () {
        status.textContent = copy().saveFailed;
      });
    } catch (error) {
      status.textContent = copy().saveFailed;
    }
  }

  /* ---------- 文案 ---------- */
  function applyTexts() {
    var set = copy();
    root.document.documentElement.setAttribute('lang', locale === 'zh' ? 'zh-CN' : 'en');
    $('subtitle').textContent = content.brand.tagline;
    $('startTitle').textContent = locale === 'zh' ? content.brand.toolName : content.brand.titleEn;
    $('startLines').textContent = set.tutorialLine;
    $('startBtn').textContent = set.startButton;
    $('startTip').textContent = content.brand.tagline;
    $('shapeTitle').textContent = set.chooseBottle;
    $('shapeTip').textContent = set.bottleHint;
    $('toolPour').textContent = set.toolPour;
    $('toolRod').textContent = set.toolRod;
    $('fillLabel').textContent = set.fillLabel;
    $('poursLabel').textContent = set.pours;
    $('sealBtn').textContent = set.finishButton;
    $('craftHint').textContent = full ? set.fullBottle : (tool === 'pour' ? set.hintPour : set.hintRod);
    $('albumBtn').textContent = set.albumOpen;
    $('resultAlbumBtn').textContent = set.albumOpen;
    $('muteBtn').textContent = muted ? set.muteOff : set.muteOn;
    $('langBtn').textContent = locale === 'zh' ? 'EN' : '中文';
    updatePalette();
    if (phase === 'pick') buildShapeCards();
    if (phase === 'result') {
      $('resultTitle').textContent = set.resultTitle;
      $('resultHint').textContent = set.resultHint + ' · ' + pours + ' ' + set.pours;
      $('replayBtn').textContent = set.replayButton;
      $('saveBtn').textContent = set.shareButton;
    }
  }

  /* ---------- 每帧更新 ---------- */
  var raf = 0;
  var lastFrame = 0;

  function frame(stamp) {
    raf = 0;
    if (root.document.hidden) return;
    var nowMs = stamp || now();
    var dt = lastFrame ? Math.min(0.05, (nowMs - lastFrame) / 1000) : 0.016;
    lastFrame = nowMs;
    renderer.updateEffects(dt);
    if (renderer.ensureSize()) relayout();

    var view = null;
    if (phase === 'craft' && engine) {
      engine.step();
      updateChips();
      view = { meta: content.meta, engine: engine, mode: 'craft', tool: tool };
    } else if (phase === 'result' && engine) {
      /* 原版结果页：瓶子以 tilt = .08*sin(3t) 轻轻摆动，背光显示。
         原版相位按帧推进（s.current += .002/帧，60fps 下周期约 17.5 秒），
         不是按秒推进——按秒会快 8 倍，摆动变成明显的晃动。 */
      resT += 0.002;
      engine.tilt = 0.08 * Math.sin(3 * resT);
      engine.step();
      view = { meta: content.meta, engine: engine, mode: 'result', tool: tool };
    } else {
      ensureDemoEngine();
      if (demoEngine) {
        demoEngine.step();
        view = { meta: content.meta, engine: demoEngine, mode: 'cover', tool: 'pour' };
      }
    }
    if (view) {
      renderer.render(nowMs / 1000, view);
    }
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

    $('startBtn').addEventListener('click', showPick);
    $('sealBtn').addEventListener('click', onSeal);
    $('replayBtn').addEventListener('click', showPick);
    $('saveBtn').addEventListener('click', saveCard);
    $('albumBtn').addEventListener('click', openAlbum);
    $('resultAlbumBtn').addEventListener('click', openAlbum);
    $('albumClose').addEventListener('click', closeAlbum);

    $('muteBtn').addEventListener('click', function () {
      muted = !muted;
      audio.setMuted(muted);
      this.textContent = muted ? copy().muteOff : copy().muteOn;
      this.setAttribute('aria-pressed', muted ? 'false' : 'true');
      storage.write('sand-muted', muted ? 1 : 0);
    });

    $('langBtn').addEventListener('click', function () {
      locale = locale === 'zh' ? 'en' : 'zh';
      applyTexts();
      audio.playClick();
    });
  }

  /* ---------- 启动 ---------- */
  function init() {
    renderer = root.SandRender.createRenderer($('field'));
    renderer.resize();
    root.__sandRenderer = renderer;

    applyTexts();
    buildPalette();
    bind();

    showCover();
    loop();

    storage.loaded.then(function () {
      var muteFlag = Number(storage.read('sand-muted')) || 0;
      if (muteFlag) {
        muted = true;
        audio.setMuted(true);
        $('muteBtn').textContent = copy().muteOff;
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
  root.__sandEngine = null;
  root.__sandPhase = 'cover';
  Object.defineProperty(root, '__sandPhase', {
    get: function () { return phase; },
    set: function (v) { phase = v; },
    configurable: true
  });
  root.__sandRefresh = function () {
    if (engine) updateChips();
  };
})(typeof window !== 'undefined' ? window : global);
