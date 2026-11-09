/*
 * 彩沙瓶 · 自动倒沙（只给 QA 用，不进打包产物）
 *
 * 三期原版是逐粒沙物理 + 双工具，没有「塑形到目标轮廓」的玩法，
 * 自动化助手改为「像真人一样驱动原版 SandEngine 接口」：
 *   pourAt      —— 一次 pour（与真人按下画布同一接口）
 *   dragPour    —— 沿一条线边拖边倒（pointermove 的 10 粒节奏）
 *   rodDrag     —— 沿一条线推杆（pointermove 的 rod 位移）
 *   fillTo      —— 分批倒沙 + 步进物理，堆到指定粒数（模拟倒满一瓶）
 *   layerPour   —— 按色分层扫倒（模拟真人做分层）
 *   settle      —— 步进到整堆静止
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.SandAuto = factory();
  }
})(typeof window !== 'undefined' ? window : global, function () {
  'use strict';

  function createEngine(game, shapeId, w, h) {
    var engine = new game.SandEngine(game.shapeById(shapeId || 'round'));
    engine.resize(w || 390, h || 430);
    return engine;
  }

  function pourAt(engine, x, y, hex, count) {
    return engine.pour(x, y, hex, count || 18);
  }

  /* 从 (x0,y0) 到 (x1,y1) 拖动倒沙：每步先 pour(…,10) 再步进一帧（与真人节奏一致） */
  function dragPour(engine, x0, y0, x1, y1, steps, hex) {
    var moved = 0;
    var tiltBefore;
    for (var i = 0; i <= steps; i++) {
      var t = steps === 0 ? 1 : i / steps;
      var x = x0 + (x1 - x0) * t;
      var y = y0 + (y1 - y0) * t;
      tiltBefore = engine.tilt;
      engine.tilt = Math.max(-1, Math.min(1, (x - engine.W / 2) / (engine.W / 2)));
      if (!engine.isFull()) moved += engine.pour(x, y, hex, 10);
      engine.step();
    }
    engine.tilt = tiltBefore;
    return moved;
  }

  /* 推杆沿一条线拖动（rod 的 dx/dy 来自相邻两步的位移） */
  function rodDrag(engine, x0, y0, x1, y1, steps) {
    var prevX = x0;
    var prevY = y0;
    for (var i = 1; i <= steps; i++) {
      var t = i / steps;
      var x = x0 + (x1 - x0) * t;
      var y = y0 + (y1 - y0) * t;
      engine.rod(x, y, x - prevX, y - prevY);
      engine.step();
      prevX = x;
      prevY = y;
    }
  }

  /* 分批倒到指定粒数：一批 pour + 一批 step，模拟真人倒停交替 */
  function fillTo(engine, colors, target, maxLoops) {
    var loops = 0;
    var limit = maxLoops || 600;
    while (engine.grains.length < target && !engine.isFull() && loops < limit) {
      var hex = colors[loops % colors.length].hex;
      var x = engine.W / 2 + (engine.rng() - 0.5) * engine.W * 0.3;
      var y = engine.bottomY() - engine.H * 0.3;
      engine.pour(x, y, hex, 30);
      for (var i = 0; i < 30; i++) engine.step();
      loops++;
    }
    return engine.grains.length;
  }

  /* 分层扫倒：每种颜色从左到右扫一遍，色带之间步进落定 */
  function layerPour(engine, colors, perLayer) {
    var total = 0;
    for (var k = 0; k < colors.length; k++) {
      var left = engine.W / 2 - engine.W * 0.2;
      var right = engine.W / 2 + engine.W * 0.2;
      var y = engine.bottomY() - engine.H * 0.28;
      for (var i = 0; i <= 8; i++) {
        var x = left + (right - left) * (i / 8);
        if (!engine.isFull()) total += engine.pour(x, y, colors[k].hex, perLayer || 6);
        for (var s = 0; s < 6; s++) engine.step();
      }
    }
    return total;
  }

  /* 步进到不再有粒子移动（或步数耗尽） */
  function settle(engine, maxSteps) {
    var n = 0;
    var limit = maxSteps || 700;
    while (n < limit) {
      engine.step();
      n++;
      if (!engine.dirty) break;
    }
    engine.dirty = false;
    return n;
  }

  return {
    createEngine: createEngine,
    pourAt: pourAt,
    dragPour: dragPour,
    rodDrag: rodDrag,
    fillTo: fillTo,
    layerPour: layerPour,
    settle: settle
  };
});
