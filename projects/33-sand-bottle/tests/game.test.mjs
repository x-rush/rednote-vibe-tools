/*
 * 彩沙瓶 · 玩法单测（三期：原版值逐常量断言）
 *
 * 所有期望值都直接来自原版源码（reference/eazo-spec.txt 与
 * %TEMP%\eazo-original\33\12gurs1rhkq1r.js 的 chunk 33131 / 52499）。
 * 原版缺陷照抄并如实断言：2600 粒沙在原版瓶身剖面里根本填不满
 * （fillLevel 最高 ~0.5），isFull 实际由粒数上限触发；.97 填充分支
 * 只有人工摆粒才可能达到——这是原版行为，不得「修正」。
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
const game = global.SandGame;

/* 原版 BOTTLE_SHAPES（chunk 33131），一字不改 */
const ORIGINAL_SHAPES = [
  { id: 'round', name: 'Round Shoulder', bodyHalf: 0.33, neckHalf: 0.12, neckSpan: 0.16, shoulderSpan: 0.12, roundBottom: 0.5 },
  { id: 'cylinder', name: 'Tall Cylinder', bodyHalf: 0.28, neckHalf: 0.14, neckSpan: 0.12, shoulderSpan: 0.08, roundBottom: 0.15 },
  { id: 'flask', name: 'Flask', bodyHalf: 0.36, neckHalf: 0.1, neckSpan: 0.2, shoulderSpan: 0.16, roundBottom: 0.35 },
  { id: 'teardrop', name: 'Teardrop', bodyHalf: 0.35, neckHalf: 0.11, neckSpan: 0.14, shoulderSpan: 0.24, roundBottom: 0.85 },
  { id: 'wide', name: 'Wide Body', bodyHalf: 0.4, neckHalf: 0.13, neckSpan: 0.11, shoulderSpan: 0.1, roundBottom: 0.25 }
];

/* 原版 SAND_COLORS（chunk 33131），hex 与顺序一字不改 */
const ORIGINAL_COLORS = [
  { id: 'ochre', hex: '#D7A34A', name: 'Ochre' },
  { id: 'amber', hex: '#E8954A', name: 'Amber' },
  { id: 'coral', hex: '#B96C3F', name: 'Coral' },
  { id: 'rust', hex: '#A55C49', name: 'Rust' },
  { id: 'clay', hex: '#8D5A3B', name: 'Clay' },
  { id: 'cream', hex: '#ECE5CD', name: 'Cream' },
  { id: 'wheat', hex: '#D9C7A5', name: 'Wheat' },
  { id: 'gold', hex: '#C8A86B', name: 'Gold' },
  { id: 'moss', hex: '#76815C', name: 'Moss' },
  { id: 'teal', hex: '#6E7C77', name: 'Teal' },
  { id: 'violet', hex: '#7A6A86', name: 'Violet' },
  { id: 'slate', hex: '#4F4A38', name: 'Slate' }
];

/* 原版 22 条文案（en + zh），逐字对照 */
const ORIGINAL_COPY = {
  en: {
    tutorialLine: 'Drag to pour and tilt. Nothing can be undone.',
    startButton: 'Start Pouring',
    chooseBottle: 'Choose a bottle',
    bottleHint: 'Its neck will restrict your later work.',
    beginCraft: 'Begin',
    toolPour: 'Pour',
    toolRod: 'Rod',
    hintPour: 'Drag in the glass to pour. No undo.',
    hintRod: 'Drag to push sand into peaks against the glass.',
    fillLabel: 'Fill',
    fullBottle: 'The bottle is full — hold it to the light.',
    finishButton: 'Hold to the Light',
    resultTitle: 'Your Sand Bottle',
    resultHint: 'Layers made, nothing to redo.',
    replayButton: 'Pour a New Bottle',
    muteOn: 'Sound on',
    muteOff: 'Sound off',
    pours: 'Pours',
    colors: 'colours',
    langLabel: 'EN'
  },
  zh: {
    tutorialLine: '拖动倾倒并倾斜瓶身。一切都无法撤销。',
    startButton: '开始倒沙',
    chooseBottle: '选择瓶形',
    bottleHint: '瓶颈会限制你后期的操作。',
    beginCraft: '开始制作',
    toolPour: '倒沙',
    toolRod: '推杆',
    hintPour: '在玻璃瓶内拖动即可倒沙。无法撤销。',
    hintRod: '拖动推杆把沙子推向玻璃壁形成尖峰。',
    fillLabel: '填充度',
    fullBottle: '瓶子已满——把它举到光下看看。',
    finishButton: '举向光亮',
    resultTitle: '你的沙瓶',
    resultHint: '层层堆叠，无法重做。',
    replayButton: '再做一瓶',
    muteOn: '声音开启',
    muteOff: '声音关闭',
    pours: '倒沙次数',
    colors: '种颜色',
    langLabel: '中文'
  }
};

const W = 390;
const H = 430;

function newEngine(shapeId) {
  const engine = new game.SandEngine(game.shapeById(shapeId || 'round'));
  engine.resize(W, H);
  return engine;
}

/* ---------- 瓶型表 / 色表 ---------- */

test('五种瓶型与原版逐字段一致（含顺序）', () => {
  assert.strictEqual(game.BOTTLE_SHAPES.length, 5);
  for (let i = 0; i < 5; i++) {
    const mine = game.BOTTLE_SHAPES[i];
    const orig = ORIGINAL_SHAPES[i];
    assert.strictEqual(mine.id, orig.id, '第 ' + i + ' 个瓶型 id 不对');
    assert.strictEqual(mine.name, orig.name);
    for (const key of ['bodyHalf', 'neckHalf', 'neckSpan', 'shoulderSpan', 'roundBottom']) {
      assert.strictEqual(mine[key], orig[key], orig.id + '.' + key + ' 应为 ' + orig[key]);
    }
  }
});

test('十二种沙色与原版逐字段一致（含顺序与 hex 大小写）', () => {
  assert.strictEqual(game.SAND_COLORS.length, 12);
  for (let i = 0; i < 12; i++) {
    const mine = game.SAND_COLORS[i];
    const orig = ORIGINAL_COLORS[i];
    assert.strictEqual(mine.id, orig.id, '第 ' + i + ' 个颜色 id 不对');
    assert.strictEqual(mine.hex, orig.hex, orig.id + ' hex 应为 ' + orig.hex);
    assert.strictEqual(mine.name, orig.name);
  }
});

test('content.json 的瓶型与色表和引擎表完全一致（业务内容唯一来源）', () => {
  assert.strictEqual(content.meta.shapes.length, 5);
  assert.strictEqual(content.meta.colors.length, 12);
  for (let i = 0; i < 5; i++) {
    const s = content.meta.shapes[i];
    const g = game.BOTTLE_SHAPES[i];
    assert.strictEqual(s.id, g.id);
    assert.strictEqual(s.name, g.name);
    for (const key of ['bodyHalf', 'neckHalf', 'neckSpan', 'shoulderSpan', 'roundBottom']) {
      assert.strictEqual(s[key], g[key]);
    }
  }
  for (let i = 0; i < 12; i++) {
    assert.strictEqual(content.meta.colors[i].hex, game.SAND_COLORS[i].hex);
    assert.strictEqual(content.meta.colors[i].name, game.SAND_COLORS[i].name);
  }
});

test('原版 22 条文案逐字对照（zh + en）', () => {
  for (const lang of ['en', 'zh']) {
    const mine = content.copy[lang];
    assert.ok(mine, '缺 ' + lang + ' 文案');
    for (const key of Object.keys(ORIGINAL_COPY[lang])) {
      assert.strictEqual(
        mine[key],
        ORIGINAL_COPY[lang][key],
        lang + '.' + key + ' 必须与原版逐字一致'
      );
    }
  }
});

test('shapeById：未知 id 回退到第一种（原版 t[0] 兜底）', () => {
  assert.strictEqual(game.shapeById('no-such'), game.BOTTLE_SHAPES[0]);
  assert.strictEqual(game.shapeById('flask').id, 'flask');
});

/* ---------- 几何 ---------- */

test('topY / bottomY / grainR 公式', () => {
  const e = newEngine('round');
  assert.strictEqual(e.topY(), Math.max(8, 0.03 * H));
  assert.strictEqual(e.bottomY(), H - Math.max(10, 0.02 * H));
  assert.strictEqual(e.grainR(), Math.max(1.6, 0.006 * W));
  const small = new game.SandEngine(game.BOTTLE_SHAPES[0]);
  small.resize(100, 300);
  assert.strictEqual(small.grainR(), 1.6, 'W=100 时单粒半径取下限 1.6');
});

test('bottleX：五种瓶型的瓶颈 / 瓶身 / 收底剖面（原版公式采样值）', () => {
  /* 手工按原版公式算出的期望值（W=390, H=430，容差 0.5px） */
  const cases = [
    { id: 'round', top: 46.8, mid: 128.7, bottom: 114.91 },
    { id: 'cylinder', top: 54.6, mid: 109.2, bottom: 105.69 },
    { id: 'flask', top: 39.0, mid: 140.4, bottom: 129.87 },
    { id: 'teardrop', top: 42.9, mid: 136.5, bottom: 111.62 },
    { id: 'wide', top: 50.7, mid: 156.0, bottom: 147.64 }
  ];
  const cx = W / 2;
  for (const c of cases) {
    const e = newEngine(c.id);
    const atTop = e.bottleX(e.topY());
    const atMid = e.bottleX(215);
    const atBottom = e.bottleX(e.bottomY());
    const halfTop = atTop[1] - cx;
    const halfMid = atMid[1] - cx;
    const halfBottom = atBottom[1] - cx;
    assert.ok(
      Math.abs(halfTop - c.top) < 0.5,
      c.id + ' 瓶颈半宽 ' + halfTop.toFixed(2) + ' 应为 ' + c.top
    );
    assert.ok(
      Math.abs(halfMid - c.mid) < 0.5,
      c.id + ' 瓶身半宽 ' + halfMid.toFixed(2) + ' 应为 ' + c.mid
    );
    assert.ok(
      Math.abs(halfBottom - c.bottom) < 0.5,
      c.id + ' 收底半宽 ' + halfBottom.toFixed(2) + ' 应为 ' + c.bottom
    );
    /* 左右对称 */
    assert.ok(Math.abs(atMid[0] + atMid[1] - W) < 0.001, c.id + ' 剖面应左右对称');
  }
});

test('inside：壁厚 1px，上下越界为 false', () => {
  const e = newEngine('round');
  assert.strictEqual(e.inside(195, 215), true, '瓶身中心在瓶内');
  const pair = e.bottleX(215);
  assert.strictEqual(e.inside(pair[0] + 0.5, 215), false, '左壁 1px 之内不算瓶内');
  assert.strictEqual(e.inside(pair[1] - 0.5, 215), false, '右壁 1px 之内不算瓶内');
  assert.strictEqual(e.inside(195, e.topY() - 1), false, '瓶口以上不算');
  assert.strictEqual(e.inside(195, e.bottomY() + 1), false, '瓶底以下不算');
});

/* ---------- 填充与满瓶 ---------- */

test('fillLevel：空瓶 0，按瓶内最高一粒到瓶底的比例', () => {
  const e = newEngine('round');
  assert.strictEqual(e.fillLevel(), 0);
  e.grains.push({ x: 195, y: e.bottomY(), r: 2 });
  assert.ok(Math.abs(e.fillLevel()) < 1e-9, '贴底的沙填充度为 0');
  e.grains.length = 0;
  e.grains.push({ x: 195, y: 30, r: 2 });
  const expect = (e.bottomY() - 30) / (e.bottomY() - e.topY());
  assert.ok(Math.abs(e.fillLevel() - expect) < 1e-9, '填充度按最高粒算');
});

test('isFull：粒数 2600 触发；.97 填充分支按原公式可达（人工摆粒）', () => {
  const e = newEngine('round');
  for (let i = 0; i < 2600; i++) {
    e.grains.push({ x: 195, y: e.bottomY(), r: 2, settled: true });
  }
  assert.strictEqual(e.isFull(), true, '2600 粒即满（原版行为）');
  const f = newEngine('round');
  f.grains.push({ x: 195, y: f.topY() + 2, r: 2 });
  assert.ok(f.fillLevel() > 0.97, '人工摆粒可到 .97 以上');
  assert.strictEqual(f.isFull(), true, '.97 填充分支触发');
});

/* ---------- pour ---------- */

test('pour：按下一次 18 粒的抖动范围、初速与半径公式', () => {
  const e = newEngine('round');
  e.tilt = 0.35;
  const added = e.pour(195, 215, '#123456', 18);
  assert.strictEqual(added, 18, '瓶身中心倒沙全部落瓶');
  const a = e.grainR();
  for (const g of e.grains) {
    assert.ok(Math.abs(g.x - 195) <= a * 2 + 1e-9, '抖动 x ≤ ±2 粒半径');
    assert.ok(Math.abs(g.y - 215) <= a + 1e-9, '抖动 y ≤ ±1 粒半径');
    assert.ok(g.vx >= 1.4 * 0.35 - 0.3 - 1e-9 && g.vx <= 1.4 * 0.35 + 0.3 + 1e-9,
      'vx = 1.4*tilt + (rng-.5)*.6');
    assert.ok(g.vy >= 1.2 && g.vy <= 2.0 + 1e-9, 'vy = 1.2 + .8*rng');
    assert.ok(g.r >= a * 0.85 - 1e-9 && g.r <= a * 1.2 + 1e-9, 'r = a*(.85+.35*rng)');
    assert.strictEqual(g.c, '#123456');
    assert.strictEqual(g.settled, false);
  }
  /* 特效粒子同步生成 */
  assert.strictEqual(e.particles.length, 18);
  assert.strictEqual(e.particles[0].life, 1);
});

test('pour：瓶外落点不入瓶；满瓶后返回 0；粒数上限 2600', () => {
  const e = newEngine('round');
  const outside = e.pour(10, 215, '#123456', 10);
  assert.strictEqual(outside, 0, '瓶外倒沙一粒也不进');
  for (let i = 0; i < 2590; i++) {
    e.grains.push({ x: 195, y: 215, r: 2, settled: true });
  }
  const added = e.pour(195, 215, '#123456', 50);
  assert.strictEqual(added, 10, '只补到 2600 为止');
  assert.strictEqual(e.grains.length, 2600);
  assert.strictEqual(e.pour(195, 215, '#123456', 10), 0, '满瓶后 pour 返回 0');
});

/* ---------- rod ---------- */

test('rod：作用半径固定 .11*W，径向推力 (1-s/a)*3.2 + 拖动位移', () => {
  const e = newEngine('round');
  e.grains.push({ x: 205, y: 215, vx: 0, vy: 0, r: 2, settled: true });
  e.grains.push({ x: 260, y: 215, vx: 0, vy: 0, r: 2, settled: true });
  e.rod(195, 215, 5, 0);
  const near = e.grains[0];
  const far = e.grains[1];
  /* s=10：e=(1-10/42.9)*3.2 ≈ 2.4541；x += o/s*e + .35*5 */
  const a = 0.11 * W;
  const expect = 205 + (10 / 10) * (1 - 10 / a) * 3.2 + 0.35 * 5;
  assert.ok(Math.abs(near.x - expect) < 1e-9, '近粒位移按公式：' + near.x + ' vs ' + expect);
  assert.strictEqual(near.y, 215, 'o 分量为 0 时 y 不动（.5 系数乘 0）');
  assert.strictEqual(near.vy, -0.6, '被推的粒 vy = -.6');
  assert.strictEqual(near.settled, false, '被推的粒解除静止');
  assert.strictEqual(far.x, 260, '半径外的粒不动');
  assert.strictEqual(far.settled, true, '半径外的粒保持静止');
});

/* ---------- step 物理 ---------- */

test('step：重力 .22（上限 5）、tilt=.05 横向、水平阻尼 *.9', () => {
  const e = newEngine('round');
  e.grains.push({ x: 195, y: 100, vx: 0, vy: 0, r: 2, settled: false });
  const g = e.grains[0];
  e.tilt = 0;
  e.step();
  assert.ok(Math.abs(g.vy - 0.22) < 1e-9, '第一帧 vy = .22');
  assert.strictEqual(g.x, 195, '无倾斜无水平位移');
  e.tilt = 0.5;
  e.step();
  /* vx = (0 + .05*.5) * .9 = .0225 */
  assert.ok(Math.abs(g.vx - 0.0225) < 1e-9, 'tilt 横向分量与阻尼');
  for (let i = 0; i < 40; i++) e.step();
  assert.ok(g.vy <= 5 + 1e-9, 'vy 上限 5');
});

test('step：已静止的粒在 |tilt| < .04 时整帧跳过，倾斜后恢复流动', () => {
  const e = newEngine('round');
  e.grains.push({ x: 195, y: 419, vx: 0, vy: 5, r: 2, settled: false });
  e.tilt = 0;
  e.step();
  assert.strictEqual(e.grains[0].settled, true, '落到堆面后被 stack 置为静止');
  e.step();
  /* 静止帧整帧跳过：若未跳过，积分会把 vy 加到 .22 */
  assert.strictEqual(e.grains[0].vy, 0, '跳帧时 vy 不增长');
  assert.ok(Math.abs(e.grains[0].y - (e.bottomY() - 1.1 * e.grainR())) < 1e-6, '停在堆面位置');
  e.tilt = 0.5;
  e.step();
  e.step();
  assert.ok(e.grains[0].x > 195, '倾斜后沙粒恢复流动');
});

test('step：位置变了才置脏（渲染缓存层的失效前提）', () => {
  const e = newEngine('round');
  e.grains.push({ x: 195, y: 419, vx: 0, vy: 5, r: 2, settled: false });
  e.tilt = 0;
  for (let i = 0; i < 6; i++) e.step();
  e.dirty = false;
  e.step();
  e.step();
  e.step();
  assert.strictEqual(e.dirty, false, '沙落定后位置不再变化，不应置脏');
  /* 倒进一粒新的沙：位置变了必须置脏 */
  e.grains.push({ x: 150, y: 100, vx: 0, vy: 0, r: 2, settled: false });
  e.dirty = false;
  e.step();
  assert.strictEqual(e.dirty, true, '有粒子移动就必须置脏');
});

test('stack：沙堆成山形，中间比边上高', () => {
  const e = newEngine('wide');
  for (let i = 0; i < 400; i++) {
    e.pour(195 + (Math.random() - 0.5) * 60, 200, '#123456', 1);
  }
  for (let i = 0; i < 400; i++) e.step();
  const cell = 1.7 * e.grainR();
  const tops = new Map();
  for (const g of e.grains) {
    const idx = Math.floor(g.x / cell);
    if (!tops.has(idx) || g.y < tops.get(idx)) tops.set(idx, g.y);
  }
  const heights = [...tops.entries()].map(([k, v]) => [k, e.bottomY() - v]);
  heights.sort((a, b) => a[0] - b[0]);
  const mid = heights[Math.floor(heights.length / 2)][1];
  const edge = Math.max(heights[0][1], heights[heights.length - 1][1]);
  assert.ok(mid > edge + e.grainR(), '中间堆得比两边高（' + mid + ' > ' + edge + '）');
});

/* ---------- 开场演示灌注 ---------- */

test('demoFill：420 粒、三色各 140 粒（原版开场行为）', () => {
  const e = newEngine('flask');
  const added = e.demoFill();
  assert.strictEqual(e.grains.length, 420);
  assert.ok(added > 380, '锥形瓶窄口也应在 380 粒以上');
  assert.strictEqual(e.grains[0].c, '#D7A34A', '第一层 ochre');
  assert.strictEqual(e.grains[139].c, '#D7A34A');
  assert.strictEqual(e.grains[140].c, '#E8954A', '第二层 amber');
  assert.strictEqual(e.grains[279].c, '#E8954A');
  assert.strictEqual(e.grains[280].c, '#B96C3F', '第三层 coral');
  assert.strictEqual(e.grains[419].c, '#B96C3F');
  const again = e.demoFill();
  assert.strictEqual(again, 0, '已有沙就不再演示灌注');
});

/* ---------- resize / layerRuns ---------- */

test('resize：已有沙粒按比例缩放（原版行为）', () => {
  const e = newEngine('round');
  e.demoFill();
  const before = e.grains.map((g) => [g.x, g.y]);
  e.resize(780, 860);
  assert.strictEqual(e.W, 780);
  assert.strictEqual(e.H, 860);
  assert.ok(Math.abs(e.grains[0].x - before[0][0] * 2) < 1e-6, 'x 翻倍');
  assert.ok(Math.abs(e.grains[0].y - before[0][1] * 2) < 1e-6, 'y 翻倍');
});

test('layerRuns：逐列颜色游程，只存 hex 与粒数（结构化存档）', () => {
  const e = newEngine('round');
  e.pour(193, 215, '#D7A34A', 2);
  e.pour(196, 216, '#76815C', 1);
  const runs = e.layerRuns();
  const cell = 1.7 * e.grainR();
  const cols = Math.max(1, Math.ceil(e.W / cell));
  assert.strictEqual(runs.length, cols);
  let total = 0;
  let hexSeen = [];
  for (const col of runs) {
    for (const run of col) {
      total += run[1];
      hexSeen.push(run[0]);
    }
  }
  assert.strictEqual(total, 3, '游程粒数守恒');
  assert.ok(hexSeen.indexOf('#D7A34A') >= 0, '含 ochre 游程');
  assert.ok(hexSeen.indexOf('#76815C') >= 0, '含 moss 游程');
});

test('引擎没有撤销接口：原版「Nothing can be undone」', () => {
  const e = newEngine('round');
  assert.strictEqual(typeof e.undo, 'undefined');
  assert.strictEqual(typeof e.removeGrains, 'undefined');
  assert.strictEqual(typeof game.undo, 'undefined');
});
