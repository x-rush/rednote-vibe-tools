/*
 * 弹珠神殿 · 关卡设计工具
 *
 * 思路是「先有解、后摆宝」：
 *   1. 用真实物理扫一遍角度与力度，挑出一条反弹次数、路径长度都合适的杆；
 *   2. 把宝石摆在这条路径上（留一点横向偏移，看起来更像散落在殿堂里）；
 *   3. 于是「一杆清空满室宝石」是构造上成立的，不是碰运气撞出来的。
 *
 * 这个工具只用来生成关卡，不参与打包，也不参与运行时。
 * 跑法：node tools/design-chambers.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
require(path.join(ROOT, 'src/game.js'));
const game = global.BilliardGame;

/*
 * 每个殿堂的规格：
 *   ball     球初始位置
 *   gems     宝石数量
 *   bounces  期望的反弹次数
 *   speeds   力度区间
 *   props    会动的障碍（后面再校验不挡路）
 *   budget   给玩家的杆数
 */
const SPECS = [
  {
    name: '第一殿 · 晨钟',
    gemName: '晨光黄晶',
    theme: 'dawn',
    hint: '拖住玉球瞄准，松手发射',
    ball: [150, 428],
    gems: 3,
    bounces: 1,
    speeds: [560, 760],
    budget: 4,
    props: []
  },
  {
    name: '第二殿 · 双廊',
    gemName: '琥珀蜜珠',
    theme: 'amber',
    hint: '撞一次墙，宝石就在拐角后面',
    ball: [64, 430],
    gems: 4,
    bounces: 2,
    speeds: [560, 780],
    budget: 5,
    props: []
  },
  {
    name: '第三殿 · 回环',
    gemName: '湖心碧玉',
    theme: 'lake',
    hint: '连撞两次，路线自己会绕回来',
    ball: [236, 424],
    gems: 5,
    bounces: 2,
    speeds: [600, 820],
    budget: 5,
    props: []
  },
  {
    name: '第四殿 · 逆旋',
    gemName: '霜纹青晶',
    theme: 'frost',
    hint: '会滑的石柱挡着路，找空档穿过去',
    ball: [150, 436],
    gems: 5,
    bounces: 3,
    speeds: [640, 860],
    budget: 5,
    props: [
      { type: 'slide', x: 96, y: 232, w: 58, h: 12, axis: 'x', range: 34, speed: 0.9, phase: 0 }
    ]
  },
  {
    name: '第五殿 · 分岔',
    gemName: '暮山紫晶',
    theme: 'dusk',
    hint: '两根石柱来回走，角度要算准',
    ball: [52, 300],
    gems: 6,
    bounces: 3,
    speeds: [620, 840],
    budget: 6,
    props: [
      { type: 'slide', x: 118, y: 150, w: 54, h: 12, axis: 'x', range: 30, speed: 0.8, phase: 0.6 },
      { type: 'slide', x: 132, y: 330, w: 54, h: 12, axis: 'x', range: 30, speed: 1.1, phase: 2.1 }
    ]
  },
  {
    name: '第六殿 · 窄门',
    gemName: '血珀红莲',
    theme: 'ember',
    hint: '门缝只有一条线，擦着过去',
    ball: [150, 448],
    gems: 6,
    bounces: 3,
    speeds: [640, 860],
    budget: 6,
    props: [
      { type: 'slide', x: 36, y: 214, w: 78, h: 12, axis: 'y', range: 36, speed: 0.9, phase: 0.3 },
      { type: 'slide', x: 186, y: 214, w: 78, h: 12, axis: 'y', range: 36, speed: 0.9, phase: 1.9 }
    ]
  },
  {
    name: '第七殿 · 绕塔',
    gemName: '玄夜墨钻',
    theme: 'night',
    hint: '绕着石塔走一圈，宝石在背面',
    ball: [40, 440],
    gems: 7,
    bounces: 4,
    speeds: [540, 880],
    budget: 8,
    blocks: [
      { x: 116, y: 196, w: 68, h: 16 },
      { x: 116, y: 268, w: 68, h: 16 }
    ],
    props: [
      { type: 'slide', x: 60, y: 96, w: 60, h: 12, axis: 'x', range: 26, speed: 1.0, phase: 1.2 }
    ]
  },
  {
    name: '第八殿 · 满室',
    gemName: '圣辉金钻',
    theme: 'gold',
    hint: '最后一殿，一杆走完全程',
    ball: [150, 452],
    gems: 8,
    bounces: 4,
    speeds: [680, 875],
    budget: 8,
    blocks: [
      { x: 210, y: 330, w: 16, h: 60 }
    ],
    props: [
      { type: 'slide', x: 20, y: 120, w: 62, h: 12, axis: 'y', range: 30, speed: 0.85, phase: 0.2 },
      { type: 'slide', x: 216, y: 150, w: 62, h: 12, axis: 'y', range: 30, speed: 1.05, phase: 1.5 }
    ]
  }
];

/* 造一个只含这一关的假局面 */
function makeState(spec) {
  const level = {
    name: spec.name,
    gems: [],
    blocks: spec.blocks || [],
    props: spec.props || [],
    budget: spec.budget
  };
  const state = {
    content: { levels: [level] },
    level: level,
    ball: { x: spec.ball[0], y: spec.ball[1], vx: 0, vy: 0 },
    gems: [],
    gemsLeft: 0
  };
  return state;
}

function resetGems(state) {
  state.gems = [];
  state.gemsLeft = 0;
}

/*
 * 路径与障碍的安全余量。
 *
 * 固定石柱：碰到就一定改道，所以路径必须绕开。
 * 会动的石条：扫掠区整条带都要避开，这样无论石条走到哪一相位，
 * 这一杆的走法都成立——「宝石要留在可行位置」靠的就是这条。
 *
 * 关键是要「有余量」，不能只判断「有没有压到」。
 * 早期版本用严格不等式判断，结果第六殿的标称轨迹正好擦过扫掠区的角点
 * （球心 x 恰好等于扫掠区左边界），被判成没压到；石条换个相位球就蹭上去，
 * 一杆清空直接失效。这里改成算「点到障碍矩形的最短距离」，要求留足 CLEARANCE。
 */

/* 点到矩形的距离；在矩形内为 0 */
function pointRectDistance(px, py, rect) {
  const dx = Math.max(rect.x - px, 0, px - (rect.x + rect.w));
  const dy = Math.max(rect.y - py, 0, py - (rect.y + rect.h));
  return Math.sqrt(dx * dx + dy * dy);
}

/* 轨迹到所有障碍扫掠区的最短距离 */
function minClearance(state, path) {
  let best = Infinity;
  const blocks = state.level.blocks || [];
  for (const block of blocks) {
    const r = game.propSwept({ type: 'static', x: block.x, y: block.y, w: block.w, h: block.h });
    for (const p of path) {
      const d = pointRectDistance(p.x, p.y, r);
      if (d < best) best = d;
    }
  }
  const props = state.level.props || [];
  for (const prop of props) {
    const swept = game.propSwept(prop);
    for (const p of path) {
      const d = pointRectDistance(p.x, p.y, swept);
      if (d < best) best = d;
    }
  }
  return best;
}

/* 宝石是不是落在了机关的扫掠区里（落在里面看起来像石条会压住宝石） */
function gemInSwept(state, gx, gy) {
  const props = state.level.props || [];
  for (const prop of props) {
    const swept = game.propSwept(prop);
    if (gx > swept.x && gx < swept.x + swept.w && gy > swept.y && gy < swept.y + swept.h) return true;
  }
  return false;
}

/* 沿路径按比例取点，并加上一点横向偏移 */
function placeGems(path, count) {
  const usable = path.slice(0, Math.max(2, path.length - 4));
  const picks = [];
  const start = 0.16;
  const end = 0.9;
  for (let i = 0; i < count; i++) {
    const f = count === 1 ? 0.5 : start + ((end - start) * i) / (count - 1);
    const idx = Math.min(usable.length - 1, Math.max(1, Math.round(f * (usable.length - 1))));
    const a = usable[idx];
    const b = usable[Math.min(usable.length - 1, idx + 1)];
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= len;
    dy /= len;
    /* 法线方向偏移几个像素，看起来像散落而不是排成一条线 */
    const off = (i % 2 === 0 ? 1 : -1) * (3 + (i % 3) * 2);
    picks.push({
      x: Math.round((a.x - dy * off) * 10) / 10,
      y: Math.round((a.y + dx * off) * 10) / 10
    });
  }
  /* 宝石之间不能叠在一起 */
  for (let i = 0; i < picks.length; i++) {
    for (let j = i + 1; j < picks.length; j++) {
      const ddx = picks[i].x - picks[j].x;
      const ddy = picks[i].y - picks[j].y;
      if (Math.sqrt(ddx * ddx + ddy * ddy) < 26) {
        picks[j].x += (j % 2 === 0 ? 14 : -14);
      }
    }
  }
  return picks;
}

const levels = [];

/* 与障碍的安全余量（虚拟殿堂像素）。球半径之外的额外余量 */
const CLEARANCE = Number(process.argv[2]) || 8;

/*
 * 相位无关性校验：石条按殿堂绝对时间运动，玩家什么时候出杆都不该影响标称解。
 * 这里把起手时间在 0–8 秒之间密集扫一遍（覆盖石条的一个完整运动周期），
 * 要求每一次起手，标称杆都照样一杆清空。
 */
function phaseIndependent(state, angle, speed, gemCount, wallBounces) {
  for (let t = 0; t <= 8; t += 0.05) {
    state.time = t;
    const sim = game.simulate(state, angle, speed);
    if (sim.collected.length !== gemCount) return { ok: false, at: t, got: sim.collected.length };
    if (sim.propHits > 0) return { ok: false, at: t, got: -1 };
    if (sim.wallBounces !== wallBounces) return { ok: false, at: t, got: -2 };
  }
  return { ok: true };
}

for (let s = 0; s < SPECS.length; s++) {
  const spec = SPECS[s];
  const state = makeState(spec);
  let best = null;
  let rejected = { clearance: 0, phase: 0 };

  for (let deg = 0; deg < 360; deg += 0.5) {
    const angle = (deg * Math.PI) / 180;
    for (let speed = spec.speeds[0]; speed <= spec.speeds[1]; speed += 10) {
      resetGems(state);
      state.time = 0;
      const sim = game.simulate(state, angle, speed);
      /* 只认撞墙的反弹次数；撞机关的杆直接否掉——
         标称杆一旦蹭到机关，石条换个相位这一杆就不成立了 */
      if (sim.wallBounces !== spec.bounces) continue;
      if (sim.propHits > 0) continue;
      if (sim.path.length < 120) continue;
      const clearance = minClearance(state, sim.path);
      if (clearance < CLEARANCE) {
        rejected.clearance++;
        continue;
      }
      /* 路径要够长（能摆下所有宝石），停下的位置也别贴角 */
      const end = sim.path[sim.path.length - 1];
      const nearCorner =
        end.x < 40 || end.x > 260 || end.y < 40 || end.y > 440;
      /* 余量优先，其次才比路径长度：余量大的杆在玩家手抖时更不容易蹭到机关 */
      const score = Math.min(clearance, 60) * 1000 + sim.path.length - (nearCorner ? 260 : 0);
      if (!best || score > best.score) {
        best = { score: score, angle: angle, deg: deg, speed: speed, path: sim.path, sim: sim, clearance: clearance };
      }
    }
  }

  if (!best) {
    console.error(
      '关卡没找到合适的杆：' + spec.name +
      '（余量不足被否 ' + rejected.clearance + ' 条）'
    );
    process.exit(1);
  }

  /* 摆好宝石后，再做一次相位无关校验：这一杆必须任何时候打都成立 */
  const gems = placeGems(best.path, spec.gems);
  /* 宝石别落在机关的扫掠区里 */
  for (let i = 0; i < gems.length; i++) {
    if (gemInSwept(state, gems[i].x, gems[i].y)) {
      /* 沿路径找一个不落在扫掠区里的点 */
      let moved = false;
      for (let k = 0; k < best.path.length; k++) {
        const p = best.path[k];
        if (!gemInSwept(state, p.x, p.y)) {
          gems[i].x = Math.round(p.x * 10) / 10;
          gems[i].y = Math.round(p.y * 10) / 10;
          moved = true;
          break;
        }
      }
      if (!moved) {
        console.error('宝石放不进安全区：' + spec.name);
        process.exit(1);
      }
    }
  }

  const checkState = makeState(spec);
  checkState.gems = gems.map((g) => ({ x: g.x, y: g.y, taken: false, order: 0 }));
  checkState.gemsLeft = gems.length;
  const phase = phaseIndependent(checkState, best.angle, best.speed, gems.length, spec.bounces);
  if (!phase.ok) {
    console.error(
      spec.name + '：标称杆在起手 ' + phase.at.toFixed(2) + 's 时失效（收到 ' + phase.got + '），相位无关性不成立'
    );
    process.exit(1);
  }

  levels.push({
    name: spec.name,
    gemName: spec.gemName,
    theme: spec.theme,
    hint: spec.hint,
    ball: spec.ball,
    budget: spec.budget,
    gems: gems.map((g) => [g.x, g.y]),
    blocks: spec.blocks || [],
    props: spec.props,
    par: { angle: Math.round(best.deg * 100) / 100, speed: best.speed, bounces: best.sim.wallBounces }
  });

  console.log(
    spec.name +
      '  角度 ' + best.deg + '°  力度 ' + best.speed +
      '  撞墙 ' + best.sim.wallBounces +
      '  路径点 ' + best.path.length +
      '  余量 ' + (best.clearance === Infinity ? '∞' : best.clearance.toFixed(1) + 'px') +
      '  停点 ' + JSON.stringify(best.path[best.path.length - 1])
  );
}

/* 写回 content.json 的 levels 段 */
const contentPath = path.join(ROOT, 'src/content/content.json');
const raw = fs.readFileSync(contentPath, 'utf8').replace(/^\uFEFF/, '');
const content = JSON.parse(raw);
content.levels = levels;
fs.writeFileSync(contentPath, JSON.stringify(content, null, 2) + '\n', 'utf8');
console.log('\n已写回 src/content/content.json 的 levels 段');
