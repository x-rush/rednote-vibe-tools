/*
 * 毽子连击 · 玩法单测（三期：严格 1:1 复刻 eazo 原版）
 * 断言锚定 reference/eazo-spec.txt 提取的原版常量与公式，
 * 含原版缺陷（阻力公式符号问题 → 踢起仅数像素），不为断言好看而改公式。
 * 直接加载浏览器端的 game.js（它导出到 global），不引入额外依赖。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
require(path.join(ROOT, 'src/game.js'));
const game = global.JianziGame;

const content = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/content/content.json'), 'utf8').replace(/^\uFEFF/, '')
);

const KICKS = content.meta.kicks;
const YARDS = content.meta.courtyards;
const PHY = content.meta.physics;
const GEN = content.meta.kickGen;
const YGEN = content.meta.courtyardGen;

/* 标定视口：390 x 780 CSS px（iPhone 390 典型值） */
const FW = 390;
const FH = 780;
const PLAY_TOP = PHY.topSafe + 8;              /* 64 */
const GROUND_Y = FH - PHY.bottomSafe - PHY.groundPad; /* 686 */
const PLAY_H = GROUND_Y - PLAY_TOP;            /* 622 */
const STEP = 1 / 240;

/* 原版阻力公式下的下落终速：760 = 1.15*0.0016*60*v^2 */
const TERMINAL = Math.sqrt(PHY.gravity / (PHY.dragK * PHY.dragUnit * PHY.dragTime));

/* 把毽子放到某个归一化高度 */
function placeAt(state, ny, vy) {
  state.shuttle.y = PLAY_TOP + ny * PLAY_H;
  state.shuttle.vy = typeof vy === 'number' ? vy : 60;
  state.shuttle.vx = 0;
}

/* 推进物理直到落地 */
function stepUntilLand(state, maxSteps = 40000) {
  for (let i = 0; i < maxSteps; i++) {
    const event = game.step(state, STEP);
    if (event && event.type === 'land') return true;
  }
  return false;
}

/* 推进物理直到满足条件 */
function stepUntil(state, predicate, maxSteps = 40000) {
  for (let i = 0; i < maxSteps; i++) {
    if (predicate(state)) return true;
    game.step(state, STEP);
  }
  return false;
}

test('踢法表 = 原版生成式：4 家族 × 3 阶，逐行核对常量', () => {
  assert.equal(KICKS.length, 12);
  for (let i = 0; i < 12; i++) {
    const kick = KICKS[i];
    const family = GEN.families[Math.floor(i / 3)];
    const tier = (i % 3) + 1;
    const params = GEN.tierParams[String(tier)];
    const familyIndex = GEN.families.indexOf(family);
    const expected = {
      id: family + '-' + tier,
      bandCenter: GEN.bandCenter[family],
      bandHalfWidth: params.halfWidth,
      multiplier: params.multiplier,
      power: params.power,
      unlockRally: GEN.unlockBase[String(tier)] + familyIndex * GEN.unlockStep[String(tier)]
    };
    assert.equal(kick.id, expected.id, 'row ' + i + ' id');
    assert.equal(kick.family, family, 'row ' + i + ' family');
    assert.equal(kick.tier, tier, 'row ' + i + ' tier');
    assert.equal(kick.bandCenter, expected.bandCenter, 'row ' + i + ' bandCenter');
    assert.equal(kick.bandHalfWidth, expected.bandHalfWidth, 'row ' + i + ' halfWidth');
    assert.equal(kick.multiplier, expected.multiplier, 'row ' + i + ' multiplier');
    assert.equal(kick.power, expected.power, 'row ' + i + ' power');
    assert.equal(kick.unlockRally, expected.unlockRally, 'row ' + i + ' unlockRally');
    /* 原版 label：`${名} ${'II'.repeat(tier-1)}`.trim() */
    const roman = tier > 1 ? 'II'.repeat(tier - 1) : '';
    assert.equal(kick.label, (GEN.labels[family] + ' ' + roman).trim(), 'row ' + i + ' label');
  }
  /* 原版表序（家族优先）下的解锁门槛逐行核对；
   * 按门槛排序后的解锁序列是 0,3,6,9,14,20,26,32,36,46,56,66 */
  assert.deepEqual(
    KICKS.map((k) => k.unlockRally),
    [0, 14, 36, 3, 20, 46, 6, 26, 56, 9, 32, 66]
  );
  assert.deepEqual(
    KICKS.slice().sort((a, b) => a.unlockRally - b.unlockRally).map((k) => k.unlockRally),
    [0, 3, 6, 9, 14, 20, 26, 32, 36, 46, 56, 66]
  );
  /* 带几何在画面内 */
  for (const kick of KICKS) {
    assert.ok(kick.bandCenter > 0 && kick.bandCenter < 1);
    assert.ok(kick.bandCenter - kick.bandHalfWidth >= 0);
    assert.ok(kick.bandCenter + kick.bandHalfWidth <= 1);
  }
});

test('庭院表 = 原版生成式：名称/门槛/风/障碍/配色逐行核对', () => {
  assert.equal(YARDS.length, 12);
  assert.deepEqual(
    YARDS.map((y) => y.unlockRally),
    [0, 12, 20, 28, 36, 44, 52, 60, 68, 76, 84, 92]
  );
  for (let t = 0; t < 12; t++) {
    const yard = YARDS[t];
    assert.equal(yard.id, t + 1, 'yard row ' + t);
    assert.equal(yard.name, YGEN.names[t], 'yard row ' + t + ' name');
    const expectedUnlock = t === 0 ? 0 : YGEN.unlockStep * t + YGEN.unlockBase;
    assert.equal(yard.unlockRally, expectedUnlock, 'yard row ' + t + ' unlockRally');
    assert.ok(
      Math.abs(yard.windStrength - Math.min(YGEN.windStrengthCap, YGEN.windStrengthUnit * t)) < 1e-12,
      'yard row ' + t + ' windStrength'
    );
    assert.ok(
      Math.abs(yard.windGust - Math.min(YGEN.windGustCap, YGEN.windGustUnit * t)) < 1e-12,
      'yard row ' + t + ' windGust'
    );
    const expectedObstacle = t < 2 ? 'none' : YGEN.obstacleCycle[t % YGEN.obstacleCycle.length];
    assert.equal(yard.obstacle, expectedObstacle, 'yard row ' + t + ' obstacle');
    assert.equal(
      yard.groundTint,
      t % 2 === 0 ? YGEN.groundTintEven : YGEN.groundTintOdd,
      'yard row ' + t + ' groundTint'
    );
    assert.equal(yard.accentTint, YGEN.accentCycle[t % 3], 'yard row ' + t + ' accentTint');
  }
  assert.ok(YARDS[11].windStrength > 0, '末庭必须有风');
  assert.equal(YARDS[11].windStrength, 0.198, '末庭风级 = min(.22, .018*11)');
});

test('布局：playTop/groundY 随画布尺寸（原版 topSafe56 / bottomSafe88）', () => {
  const state = game.createRun(content, FW, FH);
  assert.equal(game.PLAY_TOP(state), 64);
  assert.equal(game.GROUND_Y(state), 686);
  assert.equal(game.PLAY_HEIGHT(state), 622);
});

test('初始状态：playing、rally 0、原版发球参数（vy 40 / angVel 0.6 / ny .18）', () => {
  const state = game.createRun(content, FW, FH);
  assert.equal(state.phase, 'playing');
  assert.equal(state.rally, 0);
  assert.equal(state.combo, 0);
  assert.equal(state.unlockedCount, 1);
  assert.equal(state.courtyardIndex, 0);
  const ny = game.normalizedY(state);
  assert.ok(Math.abs(ny - PHY.serveNy) < 0.001, '发球高度 ny 应为 0.18');
  assert.equal(state.shuttle.vy, PHY.serveVy);
  assert.equal(state.shuttle.angVel, PHY.serveAngVel);
  assert.equal(state.shuttle.x, FW / 2);
});

test('resolveKick：带心强度 100%、带沿趋近 0、带外 null', () => {
  const state = game.createRun(content, FW, FH);
  placeAt(state, 0.64, 60);
  const center = game.resolveKick(state);
  assert.ok(center, '带心必须命中');
  assert.equal(center.kick.id, 'inside-1');
  assert.ok(Math.abs(center.strength - 1) < 1e-9);
  placeAt(state, 0.64 + 0.12 - 0.005, 60);
  const edge = game.resolveKick(state);
  assert.ok(edge, '带沿内侧仍命中');
  assert.ok(edge.strength < 0.1, '带沿强度应趋近 0');
  placeAt(state, 0.64 + 0.13, 60);
  assert.equal(game.resolveKick(state), null, '带外不命中');
});

test('原版无下落方向限制：上升段带内点按同样是一脚', () => {
  const state = game.createRun(content, FW, FH);
  placeAt(state, 0.64, -200); /* 正在上升 */
  assert.ok(game.resolveKick(state), '上升段同样命中');
  const event = game.kick(state);
  assert.equal(event.type, 'kick');
  assert.equal(state.rally, 1);
});

test('同倍率并列时按表序先命中者胜（原版一阶四条全是 1）', () => {
  const state = game.createRun(content, FW, FH);
  state.rally = 9; /* 四条一阶带全部解锁 */
  /* 四期带宽 0.17→0.12 后覆盖变化：inside 0.52-0.76 / outside 0.43-0.67 / knee 0.28-0.52 / back 0.68-0.92 */
  placeAt(state, 0.55, 60);
  assert.equal(game.resolveKick(state).kick.id, 'inside-1', '0.55 处 inside 表序最先');
  placeAt(state, 0.45, 60);
  assert.equal(game.resolveKick(state).kick.id, 'outside-1', '0.45 处 outside 先于 knee');
  placeAt(state, 0.9, 60);
  assert.equal(game.resolveKick(state).kick.id, 'back-1');
});

test('whiff（带外点按）：不碰毽子、只清零 combo', () => {
  const state = game.createRun(content, FW, FH);
  placeAt(state, 0.64, 60);
  game.kick(state);
  assert.equal(state.rally, 1);
  assert.ok(state.combo >= 1);
  const y = state.shuttle.y;
  const vy = state.shuttle.vy;
  placeAt(state, 0.1, 60); /* 所有已解锁带之外 */
  const yBefore = state.shuttle.y;
  const vyBefore = state.shuttle.vy;
  const event = game.kick(state);
  assert.equal(event.type, 'whiff');
  assert.equal(state.combo, 0, '点空清零连击');
  assert.equal(state.rally, 1, '点空不清连踢');
  assert.equal(state.shuttle.y, yBefore, '点空不影响毽子位置');
  assert.equal(state.shuttle.vy, vyBefore, '点空不影响毽子速度');
});

test('踢击冲量逐项（四期：vy ±9% 随机、vx ±35 随机横速）：基准值照旧', () => {
  const center = game.createRun(content, FW, FH);
  placeAt(center, 0.64, 60);
  const centerEvent = game.kick(center);
  assert.equal(centerEvent.kick.id, 'inside-1');
  /* 四期：vy 有 ±9% 随机（-610~-510），vx 有 ±35 随机横速（回中量为 0、inside 无家族横速） */
  assert.ok(center.shuttle.vy < -509 && center.shuttle.vy > -611, '带心 vy 应在 -610~-510（±9% 随机），实测 ' + center.shuttle.vy.toFixed(1));
  assert.ok(Math.abs(center.shuttle.vx) < 40, '正中场地 vx 应只有 ±35 随机横速，实测 ' + center.shuttle.vx.toFixed(1));
  assert.equal(center.shuttle.angle, Math.PI, '踢起翻面');
  assert.equal(centerEvent.gain, 20, '浮字 +round(m*(1+s)*10)');

  const edge = game.createRun(content, FW, FH);
  edge.bandJitter = 1; /* 固定带宽（随机带宽系数另行覆盖），带沿位置可精确预测 */
  placeAt(edge, 0.64 + 0.119, 60); /* 贴近带沿（四期带宽 0.12），strength 很小 */
  const edgeEvent = game.kick(edge);
  assert.ok(edgeEvent.type === 'kick' && edgeEvent.strength < 0.06, '贴近带沿强度应很小');
  const expectedVy = -560 * (0.62 + 0.38 * edgeEvent.strength);
  assert.ok(Math.abs(edge.shuttle.vy - expectedVy) < Math.abs(expectedVy) * 0.1 + 1, 'vy = -560*(.62+.38*strength) ± 9% 随机');

  const back = game.createRun(content, FW, FH);
  back.rally = 9;
  placeAt(back, 0.9, 60); /* 0.9 只在 back 带（0.68~0.92）内，inside 带够不到 */
  const backEvent = game.kick(back);
  assert.equal(backEvent.kick.id, 'back-1');
  const expectedBackVx = -60 * (backEvent.strength + 0.3);
  assert.ok(Math.abs(back.shuttle.vx - expectedBackVx) < 36, 'back 家族横速 -60*(s+.3) ± 35 随机');
});

test('四期体验修正：踢击力度真实决定踢起高度（约 200px±9%，非原版的数像素）', () => {
  const state = game.createRun(content, FW, FH);
  const startY = PLAY_TOP + 0.64 * PLAY_H;
  placeAt(state, 0.64, 60);
  game.kick(state);
  assert.ok(state.shuttle.vy < -509 && state.shuttle.vy > -611, '踢出瞬间初速 -560 ± 9%（四期随机化），实测 ' + state.shuttle.vy.toFixed(1));
  let apex = state.shuttle.y;
  for (let i = 0; i < 4000; i++) {
    game.step(state, STEP);
    if (state.shuttle.y < apex) apex = state.shuttle.y;
    if (state.shuttle.vy > 0) break;
  }
  const rise = startY - apex;
  assert.ok(rise > 150, '修正后踢起应有真实高度（>150px，vy ±9% 随机后下限）');
  assert.ok(rise < 270, '踢起高度上限（power 1 基准约 206px ± 9%），实测 ' + rise.toFixed(2) + 'px');
});

test('四期物理：下落终速约 150px/s（用户反馈「落得太慢」后提速），vy>210 软钳制生效', () => {
  const state = game.createRun(content, FW, FH);
  placeAt(state, 0.02, 0);
  stepUntil(state, (s) => s.shuttle.vy > 130, 20000);
  const nearGround = state.shuttle.vy;
  assert.ok(nearGround > 125 && nearGround < 175, '终速应约 150（fallJitter ±15%），实测 ' + nearGround.toFixed(1));
  /* 软钳制：vy = 210 + (vy-210)*0.4；输入 vy=400 → 钳后约 286（fallJitter 276~287） */
  const capped = game.createRun(content, FW, FH);
  placeAt(capped, 0.1, 400);
  game.step(capped, 1 / 240);
  assert.ok(capped.shuttle.vy > 260 && capped.shuttle.vy < 300, '软钳制后 vy 应在 260~300，实测 ' + capped.shuttle.vy.toFixed(1));
});

test('带穿越时间：一阶带（四期收窄至 0.12 + 终速 150）穿越 0.8s~2.0s', () => {
  const state = game.createRun(content, FW, FH);
  const ok = stepUntil(state, (s) => game.resolveKick(s) !== null, 40000);
  assert.ok(ok, '应能落进初始带');
  const fallSpeed = state.shuttle.vy;
  const bandSeconds = (2 * 0.12 * PLAY_H) / fallSpeed;
  assert.ok(bandSeconds >= 0.8, '一阶带穿越 ' + bandSeconds.toFixed(2) + 's 过短');
  assert.ok(bandSeconds <= 2.0, '一阶带穿越 ' + bandSeconds.toFixed(2) + 's 过长');
  /* 发球到首带等待在反应窗口内 */
  assert.ok(state.time > 0.5 && state.time < 5, '发球到首带 ' + state.time.toFixed(2) + 's 超出窗口');
});

test('左右墙：26px 钳制 + 0.5 反弹', () => {
  const state = game.createRun(content, FW, FH);
  state.shuttle.x = 10;
  state.shuttle.vx = -50;
  game.step(state, 1 / 60);
  assert.equal(state.shuttle.x, PHY.wallMargin, '应钳制在 26');
  assert.ok(state.shuttle.vx > 0, '左墙反弹为正');
  assert.ok(Math.abs(state.shuttle.vx - 50 * (1 - PHY.vxDamping / 60) * PHY.wallBounce) < 1e-6, '反弹 = 0.5*|vx|');

  const right = game.createRun(content, FW, FH);
  right.shuttle.x = FW - 10;
  right.shuttle.vx = 50;
  game.step(right, 1 / 60);
  assert.equal(right.shuttle.x, FW - PHY.wallMargin);
  assert.ok(right.shuttle.vx < 0, '右墙反弹为负');
});

test('风：庭院越靠后风越大，加速度有界', () => {
  const calm = game.windAccel({ content: content, courtyardIndex: 0, windPhase: 0 });
  const windy = game.windAccel({ content: content, courtyardIndex: 11, windPhase: 0 });
  assert.ok(windy > calm, '末庭风加速度应大于首庭');
  assert.ok(Math.abs(windy) < 40, '风加速度应有界');
  const norm = game.windNorm({ content: content, courtyardIndex: 11, windPhase: 0 });
  assert.ok(norm > 0 && norm <= 1);
});

test('踢法解锁：rally 3 解锁 Outside（原版 s/r 公式路径）', () => {
  const state = game.createRun(content, FW, FH);
  state.rally = 2;
  placeAt(state, 0.64, 60);
  const event = game.kick(state);
  assert.equal(event.rally, 3);
  assert.ok(event.unlockedKick, '第 3 脚应解锁 Outside');
  assert.equal(event.unlockedKick.id, 'outside-1');
  assert.equal(event.unlockedKick.label, 'Outside');
  assert.equal(event.unlockedCount, 2);
  assert.equal(state.unlockedCount, 2);
  assert.equal(game.unlockedKicks(content, 2).length, 1);
  assert.equal(game.unlockedKicks(content, 3).length, 2);
  assert.equal(game.nextKickToUnlock(content, 3).id, 'knee-1');
  assert.equal(game.nextKickToUnlock(content, 13).id, 'inside-2', 'rally 14 前的下一个是 Inside II');
  assert.equal(game.nextKickToUnlock(content, 14).id, 'outside-2', 'Inside II 解锁后下一个是 Outside II');
  assert.equal(game.nextKickToUnlock(content, 66), null, '全部解锁后无待解锁');
  assert.equal(game.unlockedKicks(content, 66).length, 12);
});

test('庭院解锁：rally 12 换第 2 庭院（原版 8*t+4 公式路径）', () => {
  const state = game.createRun(content, FW, FH);
  state.rally = 11;
  placeAt(state, 0.64, 60);
  const event = game.kick(state);
  assert.equal(event.rally, 12);
  assert.equal(event.unlockedYard, 1);
  assert.equal(state.courtyardIndex, 1);
  assert.equal(game.courtyardIndexFor(content, 11), 0);
  assert.equal(game.courtyardIndexFor(content, 12), 1);
  assert.equal(game.courtyardIndexFor(content, 999), YARDS.length - 1);
});

test('落地 = 局终：phase landed、不可再踢', () => {
  const state = game.createRun(content, FW, FH);
  placeAt(state, 0.64, 60);
  game.kick(state);
  assert.ok(stepUntilLand(state), '应当能落地');
  assert.equal(state.phase, 'landed');
  assert.equal(game.resolveKick(state), null, '落地后不可踢');
  assert.equal(game.kick(state), null, '落地后 kick 返回 null');
});

test('highestKickPx 统计（结算卡 Highest kick 字段）', () => {
  const state = game.createRun(content, FW, FH);
  const serveY = PLAY_TOP + 0.18 * PLAY_H;
  assert.ok(stepUntilLand(state), '应当能落地');
  assert.ok(Math.abs(state.highestKickPx - (GROUND_Y - serveY)) < 1, '最高踢击高度应等于发球点到地面');
});

test('引擎粒子簿记：容量上限与生命周期（原版 220 上限）', () => {
  const state = game.createRun(content, FW, FH);
  state.rally = 66;
  for (let i = 0; i < 30; i++) {
    placeAt(state, 0.64, 60);
    game.kick(state);
  }
  assert.ok(state.particles.length <= PHY.burstCap, '粒子不得超过 220');
  for (let i = 0; i < 120; i++) game.step(state, 1 / 60);
  assert.ok(state.particles.every((p) => p.life < p.maxLife), '死亡粒子应被清除');
});

test('羽色档位按已解锁踢法数映射（纯视觉）', () => {
  const tiers = content.meta.featherTiers;
  assert.equal(game.tierOf(content, 0), tiers[0]);
  assert.equal(game.tierOf(content, tiers[1].kickCount), tiers[1]);
  assert.equal(game.tierOf(content, 12), tiers[tiers.length - 1]);
});

test('原版没有落点预测：landingX 不再存在', () => {
  assert.equal(typeof game.landingX, 'undefined', '原版无落点预测环，API 应已移除');
});
