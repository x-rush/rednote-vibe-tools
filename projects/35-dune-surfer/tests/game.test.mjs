/*
 * 沙丘速降 · 玩法单测
 * 只测纯逻辑：速度、切弯、甩尾、岩脊、旗门、跳台、雪崩追赶、关卡生成。
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
const game = global.DuneGame;

const DT = 1 / 60;

function newRun(seed) {
  const state = game.createRun(content, seed === undefined ? 12345 : seed);
  game.startRun(state);
  return state;
}

/* 让物理跑 n 秒；target 可以是固定值，也可以是每帧算出来的函数 */
function run(state, seconds, target) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    if (target !== undefined) {
      game.setTarget(state, typeof target === 'function' ? target(state) : target);
    }
    game.update(state, DT);
    if (state.phase !== 'run') break;
  }
  return state;
}

test('初始状态：满杆开局、站在坡底中央、雪崩有一段距离', () => {
  const state = newRun();
  assert.strictEqual(state.phase, 'run');
  assert.strictEqual(state.s, 0);
  assert.strictEqual(state.gap, game.GAP_START);
  assert.strictEqual(state.flags, 0);
  assert.ok(state.x > 0 && state.x < game.WIDTH);
});

test('跟着落水线跑更快，横向偏出去就变慢', () => {
  const onLine = game.steepness(1000, game.fallLine(1000));
  const offLine = game.steepness(1000, game.fallLine(1000) + 120);
  assert.ok(onLine > offLine + 0.1, '落水线附近必须明显更陡');

  const a = newRun();
  run(a, 6, (s) => game.fallLine(s.s));
  const b = newRun();
  run(b, 6, (s) => game.fallLine(s.s) + 120);
  assert.ok(a.speed > b.speed, '踩着落水线速度应该更高（' + a.speed.toFixed(0) + ' vs ' + b.speed.toFixed(0) + '）');
});

test('横向切弯会跟到目标位置，但横向速度有上限', () => {
  const state = newRun();
  game.setTarget(state, state.x + 150);
  run(state, 2.5);
  assert.ok(Math.abs(state.x - (150 + game.WIDTH / 2)) < 12, '应该横向移到目标附近');
  assert.ok(Math.abs(state.vx) <= game.CARVE_MAX + 1, '横向速度不能超过上限');
});

test('横向反向甩动会触发甩尾，把雪崩推远', () => {
  const state = newRun();
  run(state, 1);
  const before = state.gap;
  /* 先甩向右，再甩向左 */
  game.setTarget(state, state.x + 120);
  run(state, 0.6);
  game.setTarget(state, state.x - 120);
  run(state, 0.6);
  assert.ok(state.carves >= 1, '反向甩动应该触发甩尾');
  assert.ok(state.gap > before, '甩尾应该把雪崩推远');
});

test('撞岩脊会减速并让雪崩逼近，从旁边过去不会', () => {
  /* 两条 run 走完全相同的路线，只有岩脊摆在哪不同，这样对比才干净 */
  const state = newRun();
  /* 先把速度跑起来，不然 MIN_SPEED 会把减速效果盖住 */
  run(state, 5, 140);
  /* 只留这一道岩脊，别的特征会干扰对比 */
  state.features = [];
  state.nextFeatureS = 1e9;
  state.features.push({ type: 'ridge', s: state.s + 260, lo: 0, hi: 200 });
  const ridgeS = state.s + 260;
  game.setTarget(state, 140);
  const gapBefore = state.gap;
  const speedBefore = state.speed;
  for (let i = 0; i < 4000 && state.s < ridgeS; i++) game.update(state, DT);
  assert.ok(state.speed < speedBefore * 0.75, '撞上岩脊速度应该大降');
  assert.ok(state.gap < gapBefore - 45, '撞上岩脊雪崩应该被咬一大口');

  const safe = newRun();
  run(safe, 5, 140);
  safe.features = [];
  safe.nextFeatureS = 1e9;
  /* 岩脊挪到玩家右边，人从旁边过去 */
  safe.features.push({ type: 'ridge', s: safe.s + 260, lo: 180, hi: 300 });
  const safeRidgeS = safe.s + 260;
  game.setTarget(safe, 140);
  const safeGap = safe.gap;
  const safeSpeed = safe.speed;
  for (let i = 0; i < 4000 && safe.s < safeRidgeS; i++) game.update(safe, DT);
  assert.ok(safe.speed > safeSpeed * 0.85, '从旁边过去不该减速');
  assert.ok(safe.gap > state.gap + 40, '从旁边过去不该被雪崩咬那么狠');
});

test('坡侧岩体不会挡到快车道上', () => {
  /* 这一条是全作的地基：
     追落水线的人一路畅通（快），不追线的人才会被石头绊住（慢）。
     如果坡侧岩体压到快车道上，这个地基就塌了。 */
  for (const seed of [1, 5, 9, 13, 21]) {
    const state = newRun(seed);
    run(state, 30);
    for (const f of state.features) {
      if (f.type !== 'ridge') continue;
      const line = game.fallLine(f.s);
      const onLine = f.lo < line && line < f.hi;
      const clear = Math.min(Math.abs(line - f.lo), Math.abs(line - f.hi));
      assert.ok(
        onLine || clear >= game.WALL_CLEAR - 1,
        '种子 ' + seed + '：坡侧岩体离快车道只有 ' + clear.toFixed(1) + '，会把追线的人一起挡住'
      );
    }
  }
});

test('从旗门中间穿过会得分并把雪崩推开', () => {
  const state = newRun();
  state.features.push({ type: 'gate', s: 400, x: 150, passed: false });
  state.x = 150;
  game.setTarget(state, 150);
  /* 看穿旗门那一瞬间的前后差：雪崩本来就在一直吃缓冲，
     所以不能拿「整段路走完的 gap」来比，那样测不出旗门到底推了没有 */
  let gapBeforeCross = null;
  let gapAfterCross = null;
  for (let i = 0; i < 4000 && state.s < 460; i++) {
    const gPre = state.gap;
    game.update(state, DT);
    if (gapBeforeCross === null && state.s >= 400) {
      gapBeforeCross = gPre;
      gapAfterCross = state.gap;
      break;
    }
  }
  assert.strictEqual(state.flags, 1);
  assert.ok(
    gapAfterCross > gapBeforeCross,
    '穿过旗门应该把雪崩推开（' + gapBeforeCross.toFixed(1) + ' → ' + gapAfterCross.toFixed(1) + '）'
  );
});

test('踩上跳台会腾空，腾空时撞岩脊也不怕', () => {
  const state = newRun();
  state.features.push({ type: 'ramp', s: 400, x: 150 });
  state.features.push({ type: 'ridge', s: 520, lo: 0, hi: 250 });
  state.x = 150;
  game.setTarget(state, 150);
  for (let i = 0; i < 4000 && state.s < 560; i++) game.update(state, DT);
  assert.ok(state.air > 0, '踩上跳台应该还在空中');
  assert.ok(state.gap > game.GAP_START - 120, '腾空越过岩脊不该被咬');
});

test('雪崩追上来就结束这一局', () => {
  /* 初速段雪崩其实是往后落的，要到后面的难度段才追得紧 */
  const state = newRun();
  state.s = 30000;
  state.gap = 40;
  run(state, 6);
  assert.strictEqual(state.phase, 'over');
});

test('特征总是提前生成在玩家前方', () => {
  const state = newRun();
  run(state, 3);
  assert.ok(state.features.length > 0, '前方应该有特征');
  let far = 0;
  for (const f of state.features) if (f.s > state.s + 600) far++;
  assert.ok(far >= 0);
  assert.ok(state.nextFeatureS > state.s, '生成器要跑在玩家前面');
});

test('岩脊的逃逸距离一定来得及横移过去', () => {
  for (const seed of [1, 2, 3, 7, 11, 23]) {
    const state = newRun(seed);
    run(state, 25);
    for (const log of state.corridorLog) {
      assert.ok(
        log.need <= log.reach + 0.001,
        '种子 ' + seed + '：逃逸要横移 ' + log.need.toFixed(1) + '，超过来得及的范围 ' + log.reach.toFixed(1)
      );
    }
  }
});

test('难度段按距离推进，越往下越紧', () => {
  assert.ok(content.stages.length >= 4, '至少四段');
  for (let i = 1; i < content.stages.length; i++) {
    assert.ok(content.stages[i].from > content.stages[i - 1].from, '海拔带门槛必须递增');
    assert.ok(
      content.stages[i].wallDrain >= content.stages[i - 1].wallDrain,
      '雪崩必须越追越紧'
    );
  }
});
