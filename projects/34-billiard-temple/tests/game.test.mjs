/*
 * 弹珠神殿 · 玩法单测
 * 只测纯逻辑：球的减速与反弹、宝石收取、石条移动、瞄准预测、关卡与判定。
 */
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const content = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/content/content.json'), 'utf8').replace(/^\uFEFF/, '')
);
createRequire(import.meta.url)(path.join(ROOT, 'src/game.js'));
const game = global.BilliardGame;

function newRun(levelIndex) {
  const state = game.createRun(content);
  if (levelIndex !== undefined) game.loadChamber(state, levelIndex);
  return state;
}

test('初始状态落在第一殿，杆数与宝石数按关卡来', () => {
  const state = newRun();
  assert.strictEqual(state.levelIndex, 0);
  assert.strictEqual(state.phase, 'aim');
  assert.strictEqual(state.gemsLeft, content.levels[0].gems.length);
  assert.strictEqual(state.shotsLeft, content.levels[0].budget);
  assert.strictEqual(state.ball.x, content.levels[0].ball[0]);
  assert.strictEqual(state.ball.y, content.levels[0].ball[1]);
});

test('球会匀减速停下来：飞过的距离由初速决定', () => {
  const state = newRun();
  /* 放在左侧平射，这一杆不会撞墙，净位移就是停止距离 */
  state.ball.x = 20;
  state.ball.y = 240;
  const sim = game.simulate(state, 0, 400);
  const path = sim.path;
  assert.ok(path.length > 50, '球应该飞一段距离');
  const dx = path[path.length - 1].x - path[0].x;
  /* v² = 2·a·d */
  const expected = (400 * 400) / (2 * game.FRICTION);
  assert.ok(Math.abs(dx - expected) < 12, '停止距离应符合匀减速（' + dx.toFixed(1) + ' vs ' + expected.toFixed(1) + '）');
});

test('撞墙会按恢复系数反弹，方向变成镜像', () => {
  const state = newRun();
  state.ball.x = 20;
  state.ball.y = 240;
  const sim = game.simulate(state, 0, 700);
  assert.ok(sim.bounces >= 1, '应该至少撞一次墙');
  const first = sim.path[0];
  assert.strictEqual(first.x, 20);
  /* 反弹后 x 不再单调增加 */
  let maxX = first.x;
  let decreased = false;
  for (const p of sim.path) {
    if (p.x < maxX - 0.5) decreased = true;
    if (p.x > maxX) maxX = p.x;
  }
  assert.ok(decreased, '撞右墙后 x 应该往回走');
});

test('宝石碰到就被收走', () => {
  const state = newRun();
  state.gems = [{ x: 120, y: 300, taken: false, order: 0 }];
  state.gemsLeft = 1;
  const sim = game.simulate(state, Math.atan2(300 - state.ball.y, 120 - state.ball.x), 500);
  assert.strictEqual(sim.collected.length, 1);
});

test('石条会随时间移动，扫掠区覆盖整条行程', () => {
  const prop = { type: 'slide', x: 100, y: 200, w: 60, h: 12, axis: 'x', range: 30, speed: 1.0, phase: 0 };
  const a = game.propRect(prop, 0);
  const b = game.propRect(prop, 1.2);
  assert.notStrictEqual(a.x, b.x, '石条应该移动');
  const swept = game.propSwept(prop);
  assert.ok(swept.x <= Math.min(a.x, b.x) - game.BALL_R, '扫掠区要盖住两端');
  assert.ok(swept.x + swept.w >= Math.max(a.x, b.x) + prop.w + game.BALL_R, '扫掠区要盖住两端');
});

test('瞄准预测能算出第一次反弹落点', () => {
  const state = newRun();
  state.ball.x = 40;
  state.ball.y = 240;
  const hits = game.raycast(state, 0);
  assert.ok(hits.length >= 1);
  assert.ok(Math.abs(hits[0].x - (game.ARENA_W - game.BALL_R)) < 0.6, '第一次反弹应落在右墙');
  assert.strictEqual(hits[0].kind, 'wall');
});

test('拖拽长度映射到力度：越拖越快，但有上下限', () => {
  assert.strictEqual(game.dragSpeed(0), game.MIN_SPEED);
  assert.strictEqual(game.dragSpeed(game.MAX_DRAG), game.MAX_SPEED);
  assert.ok(game.dragSpeed(game.MAX_DRAG * 2) <= game.MAX_SPEED);
  assert.ok(game.dragSpeed(game.MAX_DRAG / 2) > game.MIN_SPEED);
});

test('收齐宝石这一殿就通关，杆数用完则失败', () => {
  const state = newRun();
  state.gems = [{ x: 120, y: 300, taken: false, order: 0 }];
  state.gemsLeft = 1;
  const shot = game.launch(state, Math.atan2(300 - state.ball.y, 120 - state.ball.x), 500);
  assert.ok(shot, '应该能发射');
  assert.strictEqual(state.shotsLeft, state.level.budget - 1);
  let guard = 0;
  while (!shot.done && guard++ < 4000) game.physicsStep(state, shot);
  game.settle(state);
  assert.strictEqual(state.gemsLeft, 0);
  assert.strictEqual(state.phase, 'cleared');
  assert.ok(state.score > 0);

  const fail = newRun();
  fail.shotsLeft = 1;
  const shot2 = game.launch(fail, 0, 300);
  assert.ok(shot2);
  let g2 = 0;
  while (!shot2.done && g2++ < 4000) game.physicsStep(fail, shot2);
  game.settle(fail);
  assert.strictEqual(fail.phase, 'out');
});

test('模拟一杆不会污染真实局面里的宝石', () => {
  const state = newRun();
  const before = state.gemsLeft;
  game.simulate(state, 0, 700);
  assert.strictEqual(state.gemsLeft, before);
  assert.ok(state.gems.every((g) => !g.taken));
});

test('八殿的标称杆都能一杆收齐全场宝石，而且完全不蹭机关', () => {
  for (let i = 0; i < content.levels.length; i++) {
    const level = content.levels[i];
    const state = newRun(i);
    const angle = (level.par.angle * Math.PI) / 180;
    const sim = game.simulate(state, angle, level.par.speed);
    assert.strictEqual(
      sim.collected.length,
      level.gems.length,
      level.name + '：标称杆只收到 ' + sim.collected.length + '/' + level.gems.length + ' 颗'
    );
    assert.strictEqual(sim.propHits, 0, level.name + '：标称杆蹭到了机关');
  }
});

test('八殿的宝石都在瓶子内、标称杆撞墙次数与记录一致', () => {
  for (let i = 0; i < content.levels.length; i++) {
    const level = content.levels[i];
    for (const gem of level.gems) {
      assert.ok(gem[0] > 0 && gem[0] < game.ARENA_W, level.name + '：宝石跑到瓶子外面了');
      assert.ok(gem[1] > 0 && gem[1] < game.ARENA_H, level.name + '：宝石跑到瓶子外面了');
    }
    const state = newRun(i);
    const sim = game.simulate(state, (level.par.angle * Math.PI) / 180, level.par.speed);
    assert.strictEqual(sim.wallBounces, level.par.bounces, level.name + '：撞墙次数对不上');
  }
});

test('标称杆与石条相位无关：任何时候出杆都照样一杆清空', () => {
  for (let i = 0; i < content.levels.length; i++) {
    const level = content.levels[i];
    const angle = (level.par.angle * Math.PI) / 180;
    for (let t = 0; t <= 8; t += 0.5) {
      const state = newRun(i);
      state.time = t;
      const sim = game.simulate(state, angle, level.par.speed);
      assert.strictEqual(
        sim.collected.length,
        level.gems.length,
        level.name + '：起手 ' + t.toFixed(1) + 's 时标称杆只收到 ' + sim.collected.length + '/' + level.gems.length + ' 颗'
      );
      assert.strictEqual(sim.propHits, 0, level.name + '：起手 ' + t.toFixed(1) + 's 时标称杆蹭到了机关');
    }
  }
});
