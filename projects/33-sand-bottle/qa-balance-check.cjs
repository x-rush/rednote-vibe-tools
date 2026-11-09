/*
 * 彩沙瓶 · 原版常量回归（三期）
 *
 * 三期没有关卡与评分，本门禁改为「逐常量对齐原版」的回归：
 *   1. 五种瓶型参数、十二色 hex、原版 22 条文案逐字对照（business 内容 = content.json）；
 *   2. 每种瓶型的 bottleX 剖面采样值（瓶颈 / 瓶身 / 收底）；
 *   3. 倒满一瓶的真实行为：2600 粒触发 isFull，而 fillLevel 远不到 .97
 *      ——原版缺陷如实断言，不得「修正」；
 *   4. 推杆作用半径 .11*W 与径向推力；
 *   5. tilt 对倒沙初速与沙堆流动的影响；
 *   6. 420 粒开场演示灌注 + 静止后不再置脏（性能缓存前提）。
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname);
const content = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/content/content.json'), 'utf8').replace(/^\uFEFF/, '')
);
require(path.join(ROOT, 'src/game.js'));
const game = global.SandGame;
const auto = require(path.join(ROOT, 'tools/autoplay.cjs'));

const W = 390;
const H = 430;

/* 原版 BOTTLE_SHAPES（chunk 33131） */
const SHAPES = [
  { id: 'round', name: 'Round Shoulder', bodyHalf: 0.33, neckHalf: 0.12, neckSpan: 0.16, shoulderSpan: 0.12, roundBottom: 0.5 },
  { id: 'cylinder', name: 'Tall Cylinder', bodyHalf: 0.28, neckHalf: 0.14, neckSpan: 0.12, shoulderSpan: 0.08, roundBottom: 0.15 },
  { id: 'flask', name: 'Flask', bodyHalf: 0.36, neckHalf: 0.1, neckSpan: 0.2, shoulderSpan: 0.16, roundBottom: 0.35 },
  { id: 'teardrop', name: 'Teardrop', bodyHalf: 0.35, neckHalf: 0.11, neckSpan: 0.14, shoulderSpan: 0.24, roundBottom: 0.85 },
  { id: 'wide', name: 'Wide Body', bodyHalf: 0.4, neckHalf: 0.13, neckSpan: 0.11, shoulderSpan: 0.1, roundBottom: 0.25 }
];

/* 原版 SAND_COLORS（chunk 33131） */
const COLORS = [
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

const COPY = {
  zh: {
    tutorialLine: '拖动倾倒并倾斜瓶身。一切都无法撤销。',
    startButton: '开始倒沙',
    chooseBottle: '选择瓶形',
    bottleHint: '瓶颈会限制你后期的操作。',
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
    pours: '倒沙次数'
  },
  en: {
    tutorialLine: 'Drag to pour and tilt. Nothing can be undone.',
    startButton: 'Start Pouring',
    chooseBottle: 'Choose a bottle',
    bottleHint: 'Its neck will restrict your later work.',
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
    pours: 'Pours'
  }
};

/* bottleX 剖面期望值（W=390, H=430，手工按原版公式算出） */
const PROFILE = {
  round: { top: 46.8, mid: 128.7, bottom: 114.91 },
  cylinder: { top: 54.6, mid: 109.2, bottom: 105.69 },
  flask: { top: 39.0, mid: 140.4, bottom: 129.87 },
  teardrop: { top: 42.9, mid: 136.5, bottom: 111.62 },
  wide: { top: 50.7, mid: 156.0, bottom: 147.64 }
};

function close(a, b, eps) {
  return Math.abs(a - b) <= (eps || 0.5);
}

const rows = [];

/* ---------- 1. 表与文案 ---------- */
assert.strictEqual(game.BOTTLE_SHAPES.length, 5, '瓶型必须是 5 种');
assert.strictEqual(game.SAND_COLORS.length, 12, '沙色必须是 12 种');
for (let i = 0; i < 5; i++) {
  for (const key of ['id', 'name', 'bodyHalf', 'neckHalf', 'neckSpan', 'shoulderSpan', 'roundBottom']) {
    assert.strictEqual(
      game.BOTTLE_SHAPES[i][key], SHAPES[i][key],
      'BOTTLE_SHAPES[' + i + '].' + key + ' 与原版不一致'
    );
    if (key !== 'name') {
      assert.strictEqual(
        content.meta.shapes[i][key], SHAPES[i][key],
        'content.meta.shapes[' + i + '].' + key + ' 与原版不一致'
      );
    }
  }
}
for (let i = 0; i < 12; i++) {
  assert.strictEqual(game.SAND_COLORS[i].hex, COLORS[i].hex, '色表[' + i + '] hex 不一致');
  assert.strictEqual(content.meta.colors[i].hex, COLORS[i].hex, 'content 色表[' + i + '] hex 不一致');
}
for (const lang of ['zh', 'en']) {
  for (const key of Object.keys(COPY[lang])) {
    assert.strictEqual(
      content.copy[lang][key], COPY[lang][key],
      'copy.' + lang + '.' + key + ' 必须与原版逐字一致'
    );
  }
}

/* ---------- 2~6. 每种瓶型的引擎行为 ---------- */
for (const def of SHAPES) {
  const engine = auto.createEngine(game, def.id, W, H);
  const prof = PROFILE[def.id];
  const cx = W / 2;

  const halfTop = engine.bottleX(engine.topY())[1] - cx;
  const halfMid = engine.bottleX(215)[1] - cx;
  const halfBottom = engine.bottleX(engine.bottomY())[1] - cx;
  assert(close(halfTop, prof.top), def.id + ' 瓶颈半宽 ' + halfTop.toFixed(2) + ' ≠ ' + prof.top);
  assert(close(halfMid, prof.mid), def.id + ' 瓶身半宽 ' + halfMid.toFixed(2) + ' ≠ ' + prof.mid);
  assert(close(halfBottom, prof.bottom), def.id + ' 收底半宽 ' + halfBottom.toFixed(2) + ' ≠ ' + prof.bottom);

  /* 开场演示灌注 */
  engine.demoFill();
  const demo = auto.settle(engine);
  const demoCount = engine.grains.length;
  assert.strictEqual(demoCount, 420, def.id + ' 开场演示灌注应为 420 粒');
  const demoFill = engine.fillLevel();
  assert(engine.grains.every((g) => engine.inside(g.x, g.y)), def.id + ' 演示沙必须全在瓶内');

  /* 2600 粒倒满：原版缺陷——fillLevel 远到不了 .97，isFull 靠粒数触发 */
  const colors = game.SAND_COLORS;
  const fullCount = auto.fillTo(engine, colors, 2600);
  assert.strictEqual(fullCount, 2600, def.id + ' 应能倒到 2600 粒上限');
  assert.strictEqual(engine.isFull(), true, def.id + ' 2600 粒后 isFull 必须为 true');
  const saturatedFill = engine.fillLevel();
  assert(
    saturatedFill <= 0.97,
    def.id + ' 倒满 2600 粒后 fillLevel=' + saturatedFill.toFixed(3) +
      '，不应达到 .97（原版缺陷：粒数上限先触发）'
  );
  assert.strictEqual(engine.pour(cx, 215, colors[0].hex, 18), 0, def.id + ' 满瓶后 pour 返回 0');

  /* 推杆：半径 .11*W，径向推力 */
  const rod = auto.createEngine(game, def.id, W, H);
  rod.grains.push({ x: 205, y: 215, vx: 0, vy: 0, r: 2, settled: true });
  rod.grains.push({ x: 250, y: 215, vx: 0, vy: 0, r: 2, settled: true });
  rod.rod(195, 215, 4, 0);
  assert.strictEqual(rod.grains[0].settled, false, def.id + ' 半径内的粒被推动');
  assert(rod.grains[0].x > 205, def.id + ' 推杆应沿径向推开');
  assert.strictEqual(rod.grains[0].vy, -0.6, def.id + ' 被推粒 vy=-.6');
  assert.strictEqual(rod.grains[1].x, 250, def.id + ' 半径外的粒不动');

  /* tilt：倒沙初速带倾斜分量，堆面沙会流动 */
  const tiltEngine = auto.createEngine(game, def.id, W, H);
  tiltEngine.tilt = 0.6;
  tiltEngine.pour(cx, engine.bottomY() - 60, colors[1].hex, 20);
  const meanVx = tiltEngine.grains.reduce((s, g) => s + g.vx, 0) / tiltEngine.grains.length;
  assert(meanVx > 0.4, def.id + ' tilt=.6 时倒沙平均 vx 应明显向右（' + meanVx.toFixed(3) + '）');

  /* 静止后不再置脏 */
  tiltEngine.tilt = 0;
  auto.settle(tiltEngine);
  tiltEngine.dirty = false;
  tiltEngine.step();
  tiltEngine.step();
  assert.strictEqual(tiltEngine.dirty, false, def.id + ' 静止沙堆不应再置脏');

  rows.push({
    瓶型: def.id,
    名称: def.name,
    瓶颈半宽: halfTop.toFixed(2),
    瓶身半宽: halfMid.toFixed(2),
    收底半宽: halfBottom.toFixed(2),
    开场演示粒数: demoCount,
    开场演示填充度: (demoFill * 100).toFixed(1) + '%',
    倒满粒数: fullCount,
    倒满时填充度: (saturatedFill * 100).toFixed(1) + '%',
    静止步数: demo
  });
}

fs.mkdirSync(path.join(ROOT, 'qa'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'qa', 'balance-report.json'), JSON.stringify(rows, null, 2));
console.log(JSON.stringify(rows, null, 2));
console.log('PASS：5 瓶型 / 12 色 / 22 条文案逐常量对齐原版；2600 粒触发 isFull 而 fillLevel 不到 .97（原版缺陷如实保留）');
