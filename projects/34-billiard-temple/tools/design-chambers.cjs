/*
 * 弹珠神殿 · 关卡设计工具（玩法重建版）
 *
 * 思路仍是「先有解、后摆宝」，但玩法重建后解的结构变了：
 *   1. 用真实物理扫一遍角度与力度，挑出一条余量充足、路径够长的「标称杆」；
 *   2. 把一半宝石（parGems）摆在标称杆的轨迹上——标称杆的直接收获是构造保证的；
 *   3. 其余宝石按「连锁走廊」散布：都在标称杆轨迹附近 24~210 虚拟像素的带状区里，
 *      标称杆撞出的连锁球能滚到它们，随手玩家的直瞄杆也能打到它们；
 *   4. 经济按原版：每殿 4 杆，宝石数 = 5 + min(5, 殿数)（第 1 殿 6 颗，第 5 殿起 10 颗）。
 *      一杆收齐全殿不再是被构造保证的事——连锁滚多远由玩家与随机扇出共同决定，
 *      可玩性由 qa-balance-check.cjs 的闭环真人模型（随手 / 熟练）守住。
 *
 * 连锁的扇出偏转是确定性的（宝石坐标哈希，见 src/game.js），
 * 所以「标称杆直接收齐 parGems 且不蹭机关」在任意起手时刻都成立，本工具自检这一条。
 *
 * 这个工具只用来生成关卡，不参与打包，也不参与运行时。
 * 跑法：node tools/design-chambers.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
require(path.join(ROOT, 'src/game.js'));
const game = global.BilliardGame;

/* ---------- 可调参数（平衡迭代时改这里） ---------- */
const SEED = 20261108;          // 散布用伪随机种子：同一批关卡可复现
const PATH_GEM_RATIO = 0.5;     // 摆在标称杆轨迹上的宝石比例（至少 1 颗）
const SCATTER_BAND_MIN = 24;    // 散布宝石离标称杆轨迹的最近距离
const SCATTER_BAND_MAX = 200;   // 散布宝石离标称杆轨迹的最远距离（连锁走廊宽度）
const GEM_GAP = 36;             // 路径宝石两两最小间距（太密会让一杆变身出整队连锁球）
const SCATTER_GAP = 44;         // 散布宝石两两最小间距的默认值
/* 按殿分级的散布间距：前殿宝石少、摊更开（难度补偿），后殿 10 颗收拢保证 4 杆可通 */
const SCATTER_GAPS = [60, 58, 52, 42, 40, 36, 46, 46];
const CLEARANCE = Number(process.argv[2]) || 8; // 标称杆与障碍的额外余量

/*
 * 每个殿堂的规格：
 *   ball     球初始位置
 *   gemCount 宝石数（原版经济：5 + min(5, 殿数)）
 *   bounces  期望的（主球撞墙）反弹次数
 *   speeds   力度区间
 *   props    会动的障碍（后面再校验不挡路）
 */
const GEM_COUNTS = [6, 7, 8, 9, 10, 10, 10, 10];
const SPECS = [
  {
    name: '第一殿 · 晨钟',
    gemName: '晨光黄晶',
    theme: 'dawn',
    hint: '按住玉球向后拖动，松手击球',
    ball: [120, 286],
    bounces: 1,
    speeds: [360, 640],
    props: []
  },
  {
    name: '第二殿 · 双廊',
    gemName: '琥珀蜜珠',
    theme: 'amber',
    hint: '撞到的宝石会变成新的球，让连锁继续',
    ball: [52, 288],
    bounces: 2,
    speeds: [380, 660],
    props: []
  },
  {
    name: '第三殿 · 回环',
    gemName: '湖心碧玉',
    theme: 'lake',
    hint: '连锁越滚越大，一杆能收一片',
    ball: [188, 284],
    bounces: 2,
    speeds: [420, 700],
    props: []
  },
  {
    name: '第四殿 · 逆旋',
    gemName: '霜纹青晶',
    theme: 'frost',
    hint: '闸条每 4 秒来回一次，看准空档穿过去',
    ball: [120, 292],
    bounces: 3,
    speeds: [420, 720],
    props: [
      { type: 'slide', x: 72, y: 150, w: 52, h: 10, axis: 'x', range: 42, period: 4, phase: 0, duty: 0.5 }
    ]
  },
  {
    name: '第五殿 · 分岔',
    gemName: '暮山紫晶',
    theme: 'dusk',
    hint: '两条闸条一去一回，让连锁球替你跑腿',
    ball: [44, 236],
    bounces: 3,
    speeds: [400, 700],
    props: [
      { type: 'slide', x: 86, y: 112, w: 48, h: 10, axis: 'x', range: 34, period: 4, phase: 0, duty: 0.5 },
      { type: 'slide', x: 96, y: 214, w: 48, h: 10, axis: 'x', range: 34, period: 4, phase: 0.5, duty: 0.5 }
    ]
  },
  {
    name: '第六殿 · 窄门',
    gemName: '血珀红莲',
    theme: 'ember',
    hint: '两扇石门上下开合，缝隙只有一条线',
    ball: [120, 296],
    bounces: 3,
    speeds: [420, 720],
    props: [
      { type: 'slide', x: 30, y: 150, w: 66, h: 10, axis: 'y', range: 40, period: 4, phase: 0, duty: 0.5 },
      { type: 'slide', x: 144, y: 150, w: 66, h: 10, axis: 'y', range: 40, period: 4, phase: 0.5, duty: 0.5 }
    ]
  },
  {
    name: '第七殿 · 绕塔',
    gemName: '玄夜墨钻',
    theme: 'night',
    hint: '绕着石塔走一圈，宝石在塔的背面',
    ball: [34, 288],
    bounces: 3,
    speeds: [400, 740],
    sweptPad: 26,
    blocks: [
      { x: 92, y: 122, w: 56, h: 12 },
      { x: 92, y: 176, w: 56, h: 12 }
    ],
    props: [
      { type: 'slide', x: 48, y: 66, w: 52, h: 10, axis: 'x', range: 28, period: 4, phase: 0.25, duty: 0.5 }
    ]
  },
  {
    name: '第八殿 · 满室',
    gemName: '圣辉金钻',
    theme: 'gold',
    hint: '十颗宝石，看你的神来一杆',
    ball: [120, 298],
    bounces: 3,
    speeds: [420, 740],
    blocks: [
      { x: 166, y: 206, w: 12, h: 44 }
    ],
    props: [
      { type: 'slide', x: 16, y: 94, w: 46, h: 10, axis: 'y', range: 26, period: 4, phase: 0, duty: 0.5 },
      { type: 'slide', x: 178, y: 114, w: 46, h: 10, axis: 'y', range: 26, period: 4, phase: 0.5, duty: 0.5 }
    ]
  }
];

/* 确定性伪随机（mulberry32）：同一批关卡可复现 */
function makeRandom(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* 造一个只含这一关的假局面 */
function makeState(spec) {
  const level = {
    name: spec.name,
    gems: [],
    blocks: spec.blocks || [],
    props: spec.props || []
  };
  const main = { x: spec.ball[0], y: spec.ball[1], vx: 0, vy: 0, r: game.BALL_R, chain: false, done: true };
  const state = {
    content: { levels: [level] },
    level: level,
    balls: [main],
    ball: main,
    gems: [],
    gemsLeft: 0,
    phase: 'aim',
    shotsLeft: 99,
    shotsUsed: 0,
    time: 0,
    runGems: 0,
    lastEvents: []
  };
  return state;
}

/* 点到矩形的距离；在矩形内为 0 */
function pointRectDistance(px, py, rect) {
  const dx = Math.max(rect.x - px, 0, px - (rect.x + rect.w));
  const dy = Math.max(rect.y - py, 0, py - (rect.y + rect.h));
  return Math.sqrt(dx * dx + dy * dy);
}

/* 轨迹到所有障碍扫掠区的最短距离（主球口径，机关必须整条避开） */
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

/* 宝石是不是落在了机关的扫掠区（或太贴近它）里：贴边的宝石最难打 */
function gemInSwept(state, gx, gy, pad) {
  const props = state.level.props || [];
  for (const prop of props) {
    const swept = game.propSwept(prop);
    const m = pad || 0;
    if (gx > swept.x - m && gx < swept.x + swept.w + m && gy > swept.y - m && gy < swept.y + swept.h + m) return true;
  }
  return false;
}

/* 宝石是不是压在石柱上（压在柱子上既看不见也收不到） */
function gemInBlock(state, gx, gy) {
  const pad = game.GEM_R + 6;
  for (const b of state.level.blocks || []) {
    if (
      gx > b.x - pad && gx < b.x + b.w + pad &&
      gy > b.y - pad && gy < b.y + b.h + pad
    ) return true;
  }
  return false;
}

/* 宝石是不是在四角的夹角口袋里：两墙夹角的进攻窗口太窄，随手玩家收不稳 */
function gemInCorner(gx, gy) {
  const r = 60;
  const corners = [
    [0, 0],
    [game.ARENA_W, 0],
    [0, game.ARENA_H],
    [game.ARENA_W, game.ARENA_H]
  ];
  for (const c of corners) {
    const dx = gx - c[0];
    const dy = gy - c[1];
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

/* 沿路径按比例取点，并加上一点横向偏移 */
function placeGems(state, path, count) {
  const usable = path.slice(0, Math.max(2, path.length - 4));
  const picks = [];
  const start = 0.24; /* 避开出发段：玉球从底边出发，起步段贴墙摆不了宝石 */
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
    /* 法线方向偏移几个像素，看起来像散落而不是排成一条线；
     * 偏进扫掠区/石柱就换另一侧 */
    let off = (i % 2 === 0 ? 1 : -1) * (3 + (i % 3) * 2);
    let px = a.x - dy * off;
    let py = a.y + dx * off;
    if (gemInSwept(state, px, py) || gemInBlock(state, px, py)) {
      off = -off;
      px = a.x - dy * off;
      py = a.y + dx * off;
    }
    picks.push({ x: px, y: py });
  }
  /*
   * 松弛推挤：自交叉的轨迹会让两颗宝石落得太近。
   * 成对推开（各让一半），推完不回投影——推得离轨迹太远的候选直接被否掉，换下一杆。
   */
  const margin = 16;
  for (let pass = 0; pass < 20; pass++) {
    let moved = false;
    for (let i = 0; i < picks.length; i++) {
      for (let j = i + 1; j < picks.length; j++) {
        let ddx = picks[j].x - picks[i].x;
        let ddy = picks[j].y - picks[i].y;
        let d = Math.sqrt(ddx * ddx + ddy * ddy);
        if (d >= GEM_GAP) continue;
        if (d < 0.001) { ddx = 1; ddy = 0; d = 1; }
        const push = (GEM_GAP - d) / 2 + 0.5;
        const ux = ddx / d;
        const uy = ddy / d;
        picks[i].x -= ux * push;
        picks[i].y -= uy * push;
        picks[j].x += ux * push;
        picks[j].y += uy * push;
        moved = true;
      }
    }
    for (const p of picks) {
      p.x = Math.max(margin, Math.min(game.ARENA_W - margin, p.x));
      p.y = Math.max(margin, Math.min(game.ARENA_H - margin, p.y));
    }
    if (!moved) break;
  }
  for (const p of picks) {
    p.x = Math.round(p.x * 10) / 10;
    p.y = Math.round(p.y * 10) / 10;
  }
  return picks;
}

/* 摆放校验：两两间距足够、每颗都还在轨迹的收取范围内、都不在障碍/扫掠区里 */
function verifyPathGems(state, path, picks) {
  for (let i = 0; i < picks.length; i++) {
    for (let j = i + 1; j < picks.length; j++) {
      const d = Math.sqrt(
        (picks[i].x - picks[j].x) * (picks[i].x - picks[j].x) +
        (picks[i].y - picks[j].y) * (picks[i].y - picks[j].y)
      );
      if (d < 30) return false;
    }
  }
  const reach = game.BALL_R + game.GEM_R - 3;
  for (const p of picks) {
    if (pathDistance(path, p.x, p.y) > reach) return false;
    /* 离墙至少 26px：贴墙的宝石进攻角度太窄 */
    if (p.x < 26 || p.x > game.ARENA_W - 26 || p.y < 26 || p.y > game.ARENA_H - 26) return false;
    if (gemInCorner(p.x, p.y)) return false;
    if (gemInSwept(state, p.x, p.y)) return false;
    if (gemInBlock(state, p.x, p.y)) return false;
  }
  return true;
}

/* 点到路径的最短距离 */
function pathDistance(path, x, y) {
  let best = Infinity;
  for (const p of path) {
    const d = Math.sqrt((p.x - x) * (p.x - x) + (p.y - y) * (p.y - y));
    if (d < best) best = d;
  }
  return best;
}

/*
 * 连锁走廊散布：一半宝石落在标称杆轨迹附近的带状区里（连锁球滚得到），
 * 另一半放到远离轨迹的「远区」（>210px，连锁球够不着）——
 * 一殿至少要两条进攻线，一杆连锁扫不全殿。
 */
function scatterGems(spec, state, path, placed, count, rand, scatterGap) {
  const margin = 30; /* 离墙至少 30px：贴墙的宝石进攻角度太窄 */
  const picks = placed.slice();
  /* 远区宝石数量：宝石少的殿放一半；10 颗宝石的大殿只放 1 颗（否则随手玩家 4 杆不够） */
  const farCount = count >= 9 ? 1 : Math.max(1, Math.ceil(count / 2));
  const nearCount = count - farCount;
  let remainingNear = nearCount;
  let remainingFar = farCount;
  while (remainingNear + remainingFar > 0) {
    let progress = false;
    for (let attempt = 0; attempt < 4000 && remainingNear + remainingFar > 0; attempt++) {
      const x = margin + rand() * (game.ARENA_W - margin * 2);
      const y = margin + rand() * (game.ARENA_H - margin * 2);
      /* 好位置优先：先避开扫掠区边缘 26px；空间不够（窄门这类大扫掠殿）退化到 20px，
       * 不把宝石塞进扫掠区边缘的窄缝口袋（那里的宝石进攻角度太窄）。
       * 个别殿（spec.sweptPad）强制固定缓冲，不退化。 */
      const sweptPad = spec.sweptPad || (attempt < 1200 ? 26 : 20);
      if (gemInSwept(state, x, y, sweptPad)) continue;
      if (gemInBlock(state, x, y)) continue;
      if (gemInCorner(x, y)) continue;
      const bd = Math.sqrt((x - state.ball.x) * (x - state.ball.x) + (y - state.ball.y) * (y - state.ball.y));
      if (bd < 45) continue;
      let tooClose = false;
      for (const p of picks) {
        if (Math.sqrt((p.x - x) * (p.x - x) + (p.y - y) * (p.y - y)) < scatterGap) { tooClose = true; break; }
      }
      if (tooClose) continue;
      const pd = pathDistance(path, x, y);
      const wantFar = remainingFar > 0 && (remainingNear === 0 || rand() < 0.5);
      if (wantFar) {
        /* 远区：先要求 >210，放不下逐级放宽到 >170 */
        const minFar = attempt < 1500 ? 210 : 170;
        if (pd < minFar) continue;
        picks.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
        remainingFar--;
        progress = true;
      } else {
        /* 走廊内：[24, 200]，放不下逐级放宽 */
        const bandMax = attempt < 1500 ? SCATTER_BAND_MAX : SCATTER_BAND_MAX + 80;
        if (pd < SCATTER_BAND_MIN || pd > bandMax) continue;
        picks.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
        remainingNear--;
        progress = true;
      }
    }
    if (!progress) {
      /* 放不下：优先放弃远区约束（把远区宝石转回走廊） */
      if (remainingFar > 0) { remainingNear += remainingFar; remainingFar = 0; continue; }
      console.error('宝石散布失败：' + spec_name(state));
      process.exit(1);
    }
  }
  return picks;
}

function spec_name(state) {
  return state.level.name;
}

/*
 * 相位无关性校验：石条按殿堂绝对时间运动，玩家什么时候出杆都不该影响标称解。
 * 标称杆必须「任何时候都直接收齐 parGems、主球完全不蹭机关、撞墙次数一致」。
 * 连锁球滚到哪是允许随相位变化的（机关本来就参与连锁的混乱）。
 */
function phaseIndependent(state, angle, speed, parGems, wallBounces) {
  for (let t = 0; t <= 8; t += 0.05) {
    state.time = t;
    const sim = game.simulate(state, angle, speed);
    if (sim.collected.length < parGems) return { ok: false, at: t, got: sim.collected.length };
    for (let g = 0; g < parGems; g++) {
      if (sim.collected.indexOf(g) < 0) return { ok: false, at: t, got: -1 };
    }
    if (sim.propHits > 0) return { ok: false, at: t, got: -2 };
    if (sim.wallBounces !== wallBounces) return { ok: false, at: t, got: -3 };
  }
  return { ok: true };
}

const levels = [];

for (let s = 0; s < SPECS.length; s++) {
  const spec = SPECS[s];
  const gemCount = GEM_COUNTS[s];
  const state = makeState(spec);
  const candidates = [];
  let rejected = { clearance: 0 };

  for (let deg = 0; deg < 360; deg += 0.5) {
    const angle = (deg * Math.PI) / 180;
    for (let speed = spec.speeds[0]; speed <= spec.speeds[1]; speed += 10) {
      state.gems = [];
      state.gemsLeft = 0;
      state.balls[0].x = spec.ball[0];
      state.balls[0].y = spec.ball[1];
      state.balls[0].vx = 0;
      state.balls[0].vy = 0;
      state.ball = state.balls[0];
      state.time = 0;
      const sim = game.simulate(state, angle, speed);
      /* 只认主球撞墙的反弹次数；主球蹭机关的杆直接否掉 */
      if (sim.wallBounces !== spec.bounces) continue;
      if (sim.propHits > 0) continue;
      if (sim.path.length < 120) continue;
      /* 贴墙的杆不做候选：沿墙跑的轨迹会把宝石摆在墙边，进攻角度太窄。
       * 起步段例外——玉球本来就停在殿堂底部，前 80 个轨迹点（约 0.35s）不算贴墙。 */
      let hug = 0;
      const rest = sim.path.length > 80 ? sim.path.slice(80) : sim.path;
      for (const p of rest) {
        if (p.x < 30 || p.x > game.ARENA_W - 30 || p.y < 30 || p.y > game.ARENA_H - 30) hug++;
      }
      if (hug > rest.length * 0.25) continue;
      const clearance = minClearance(state, sim.path);
      if (clearance < CLEARANCE) {
        rejected.clearance++;
        continue;
      }
      /* 路径要够长（能摆下路径宝石），停下的位置也别贴角 */
      const end = sim.path[sim.path.length - 1];
      const nearCorner =
        end.x < 40 || end.x > 200 || end.y < 40 || end.y > 280;
      /* 余量优先，其次才比路径长度：余量大的杆在玩家手抖时更不容易蹭到机关 */
      const score = Math.min(clearance, 60) * 1000 + sim.path.length - (nearCorner ? 260 : 0);
      candidates.push({
        score: score,
        angle: angle,
        deg: deg,
        speed: speed,
        path: sim.path,
        wallBounces: sim.wallBounces,
        clearance: clearance
      });
    }
  }

  if (!candidates.length) {
    console.error(
      '关卡没找到合适的杆：' + spec.name +
      '（余量不足被否 ' + rejected.clearance + ' 条）'
    );
    process.exit(1);
  }
  candidates.sort((a, b) => b.score - a.score);

  /*
   * 按分数顺序逐条候选杆尝试摆宝：路径宝石必须两两留距、都在轨迹收取范围内。
   * 折返型轨迹（后段回到出发点附近）摆不下就换下一杆，全量尝试保证找到非折返的解。
   */
  const parGems = Math.max(1, Math.round(gemCount * PATH_GEM_RATIO));
  let chosen = null;
  for (const cand of candidates) {
    const picks = placeGems(state, cand.path, parGems);
    if (!verifyPathGems(state, cand.path, picks)) continue;
    chosen = { cand: cand, picks: picks };
    break;
  }
  if (!chosen) {
    console.error(spec.name + '：' + candidates.length + ' 条候选杆都摆不下路径宝石');
    process.exit(1);
  }

  /* 其余宝石在连锁走廊里散布（间距按殿分级） */
  const gems = scatterGems(
    spec,
    state,
    chosen.cand.path,
    chosen.picks,
    gemCount - parGems,
    makeRandom(SEED + s * 977),
    SCATTER_GAPS[s] || SCATTER_GAP
  );

  const checkState = makeState(spec);
  checkState.gems = gems.map((g, i) => ({ x: g.x, y: g.y, taken: false, order: i }));
  checkState.gemsLeft = gems.length;
  const phase = phaseIndependent(checkState, chosen.cand.angle, chosen.cand.speed, parGems, spec.bounces);
  if (!phase.ok) {
    console.error(
      spec.name + '：标称杆在起手 ' + phase.at.toFixed(2) + 's 时失效（got=' + phase.got + '），相位无关性不成立'
    );
    process.exit(1);
  }

  levels.push({
    name: spec.name,
    gemName: spec.gemName,
    theme: spec.theme,
    hint: spec.hint,
    ball: spec.ball,
    budget: 4,
    gems: gems.map((g) => [g.x, g.y]),
    parGems: parGems,
    blocks: spec.blocks || [],
    props: spec.props,
    par: {
      angle: Math.round(chosen.cand.deg * 100) / 100,
      speed: chosen.cand.speed,
      bounces: chosen.cand.wallBounces
    }
  });

  console.log(
    spec.name +
      '  角度 ' + chosen.cand.deg + '°  力度 ' + chosen.cand.speed +
      '  撞墙 ' + chosen.cand.wallBounces +
      '  路径点 ' + chosen.cand.path.length +
      '  余量 ' + (chosen.cand.clearance === Infinity ? '∞' : chosen.cand.clearance.toFixed(1) + 'px') +
      '  宝石 ' + gemCount + '（路径 ' + parGems + ' + 散布 ' + (gemCount - parGems) + '）'
  );
}

/* 写回 content.json 的 levels 段 */
const contentPath = path.join(ROOT, 'src/content/content.json');
const raw = fs.readFileSync(contentPath, 'utf8').replace(/^\uFEFF/, '');
const content = JSON.parse(raw);
content.levels = levels;
fs.writeFileSync(contentPath, JSON.stringify(content, null, 2) + '\n', 'utf8');
console.log('\n已写回 src/content/content.json 的 levels 段');
