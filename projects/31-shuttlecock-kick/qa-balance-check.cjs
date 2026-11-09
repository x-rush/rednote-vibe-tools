/*
 * 毽子连击 · 平衡回归（三期：按 eazo 原版数值与原版行为断言）
 *
 * 原版行为事实（不修正、如实断言）：
 *  - 阻力公式符号缺陷照抄 → 踢击力度对高度影响极小（每次踢起仅数像素），
 *    毽子以约 83px/s 缓降；
 *  - 四条一阶带的并集覆盖归一化高度 0.23~0.97，几乎全程可踢；
 *  - 持续点按不易落地、rally 上不封顶（受点按节奏与走神约束），
 *    这是原版「解压玩具」属性，不是平衡缺陷；
 *  - 因此断言是下限门槛（原版体验的可量化底座），不是上限设计值。
 *
 * 断言：
 *  1. 踢法表/庭院表逐值等于原版生成式（s/r 公式、8*t+4、风公式、障碍循环、配色取模）；
 *  2. 带穿越时间：一阶带 ≥ 2s、三阶带 ≥ 0.4s，发球到首带在反应窗口内；
 *  3. 玩家模型（tools/sim-rally.cjs，1/60 引擎步长闭环）：
 *     随手玩家 avgRally ≥ 40、体验 ≥ 3.5 种踢法、首局进第 2 庭院 ≥ 90%、进第 5 庭院 ≥ 80%；
 *     熟练玩家 avgRally ≥ 120、平均最高倍率 ≥ 1.4（能摸到二阶踢法）。
 *
 * 输出数值表并写入 qa/balance-report.json。
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname);
const content = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/content/content.json'), 'utf8').replace(/^\uFEFF/, '')
);
const sim = require(path.join(ROOT, 'tools/sim-rally.cjs'));

const KICKS = content.meta.kicks;
const YARDS = content.meta.courtyards;
const PHY = content.meta.physics;
const GEN = content.meta.kickGen;
const YGEN = content.meta.courtyardGen;
const PLAY_H = sim.GROUND_Y - sim.PLAY_TOP;

/* ---------- 静态断言：表值 = 原版生成式 ---------- */
for (let i = 0; i < KICKS.length; i++) {
  const kick = KICKS[i];
  const family = GEN.families[Math.floor(i / 3)];
  const tier = (i % 3) + 1;
  const params = GEN.tierParams[String(tier)];
  const familyIndex = GEN.families.indexOf(family);
  assert.equal(kick.family, family, '踢法行 ' + i + ' 家族序（原版为家族优先）');
  assert.equal(kick.bandCenter, GEN.bandCenter[family], '踢法行 ' + i + ' 带中心');
  assert.equal(kick.bandHalfWidth, params.halfWidth, '踢法行 ' + i + ' 带半宽');
  assert.equal(kick.multiplier, params.multiplier, '踢法行 ' + i + ' 倍率');
  assert.equal(kick.power, params.power, '踢法行 ' + i + ' 力度');
  assert.equal(
    kick.unlockRally,
    GEN.unlockBase[String(tier)] + familyIndex * GEN.unlockStep[String(tier)],
    '踢法行 ' + i + ' unlockRally = s[tier] + familyIndex * r[tier]'
  );
}
for (let t = 0; t < YARDS.length; t++) {
  const yard = YARDS[t];
  assert.equal(yard.unlockRally, t === 0 ? 0 : YGEN.unlockStep * t + YGEN.unlockBase, '庭院行 ' + t + ' unlockRally = 8*t+4');
  assert.ok(Math.abs(yard.windStrength - Math.min(YGEN.windStrengthCap, YGEN.windStrengthUnit * t)) < 1e-12, '庭院行 ' + t + ' windStrength');
  assert.ok(Math.abs(yard.windGust - Math.min(YGEN.windGustCap, YGEN.windGustUnit * t)) < 1e-12, '庭院行 ' + t + ' windGust');
  assert.equal(yard.obstacle, t < 2 ? 'none' : YGEN.obstacleCycle[t % YGEN.obstacleCycle.length], '庭院行 ' + t + ' obstacle');
}

/* ---------- 手感断言（原版物理推论，不是自创目标） ---------- */
/* 原版下落终速：760 = 1.15*0.0016*60*v^2 → v ≈ 83px/s */
const terminal = Math.sqrt(PHY.gravity / (PHY.dragK * PHY.dragUnit * PHY.dragTime));
assert.ok(terminal > 75 && terminal < 90, '原版下落终速应约 83px/s，实测 ' + terminal.toFixed(1));
const band1Seconds = (2 * KICKS[0].bandHalfWidth * PLAY_H) / terminal;
assert.ok(band1Seconds >= 2.0, '一阶带穿越 ' + band1Seconds.toFixed(2) + 's 过短（原版宽窗）');
const band3Seconds = (2 * KICKS[8].bandHalfWidth * PLAY_H) / terminal;
assert.ok(band3Seconds >= 0.4, '三阶带穿越 ' + band3Seconds.toFixed(2) + 's 过短');
/* 发球落进首带（inside-1，开局唯一已解锁）上沿的等待（终速主导） */
const serveFall = ((KICKS[0].bandCenter - KICKS[0].bandHalfWidth - PHY.serveNy) * PLAY_H) / terminal;
assert.ok(serveFall >= 0.4 && serveFall <= 4.0, '发球到首带 ' + serveFall.toFixed(2) + 's 超出反应窗口');

/* ---------- 玩家模型闭环断言（引擎步长 1/60） ---------- */
const RUNS = 400;
const casual = sim.simulateBatch(sim.PROFILES.casual, RUNS, 20260101);
const skilled = sim.simulateBatch(sim.PROFILES.skilled, RUNS, 31415000);

assert.ok(casual.avgRally >= 40, '随手玩家平均 rally ' + casual.avgRally + ' 低于 40（原版宽松节奏）');
assert.ok(casual.avgUniqueKicks >= 3.5, '随手玩家平均只体验 ' + casual.avgUniqueKicks + ' 种踢法');
assert.ok(casual.shareYard2FirstRun >= 0.9, '随手首局进第 2 庭院概率 ' + casual.shareYard2FirstRun + ' 过低');
assert.ok(casual.shareYard5 >= 0.8, '随手玩家进第 5 庭院概率 ' + casual.shareYard5 + ' 过低');
assert.ok(skilled.avgRally >= 120, '熟练玩家平均 rally ' + skilled.avgRally + ' 低于 120');
assert.ok(skilled.avgMaxMultiplier >= 1.4, '熟练玩家最高倍率体验 ' + skilled.avgMaxMultiplier + ' 应摸到二阶踢法');

/* ---------- 报告输出 ---------- */
const kickRows = KICKS.map(function (k) {
  return {
    label: k.label,
    id: k.id,
    解锁rally: k.unlockRally,
    带中心: k.bandCenter,
    带半宽: k.bandHalfWidth,
    倍率: k.multiplier,
    力度: k.power,
    带穿越s: +((2 * k.bandHalfWidth * PLAY_H) / terminal).toFixed(2)
  };
});

const yardRows = YARDS.map(function (y) {
  return { 场地: y.name + ' / ' + y.nameZh, id: y.id, 解锁rally: y.unlockRally, 风力: y.windStrength, 阵风: y.windGust, 障碍: y.obstacle };
});

const summary = {
  模型: 'tools/sim-rally.cjs 反应模型（引擎 1/60 步长）：随手 180-260ms+σ70+12%冲动+10%走神；熟练 80-120ms+σ30+3%冲动+2%走神；带内即点，否则瞄最近带心',
  随手玩家: casual,
  熟练玩家: skilled,
  原版终速px_s: +terminal.toFixed(1),
  一阶带穿越s: +band1Seconds.toFixed(2),
  三阶带穿越s: +band3Seconds.toFixed(2),
  发球到首带s: +serveFall.toFixed(2),
  说明: '原版阻力公式符号缺陷照抄：踢起仅数像素、终速约 83px/s；一阶带并集覆盖 0.23~0.97，持续点按几乎不落地（解压玩具属性），rally 不设上限，断言均为下限门槛。'
};

fs.mkdirSync(path.join(ROOT, 'qa'), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, 'qa', 'balance-report.json'),
  JSON.stringify({ summary: summary, kicks: kickRows, courtyards: yardRows }, null, 2)
);
console.log(JSON.stringify(summary, null, 2));
console.log('踢法表：');
console.table(kickRows);
console.log('庭院表：');
console.table(yardRows);
console.log(
  '平衡 PASS：随手 avgRally ' + casual.avgRally + '（≥40）· 熟练 avgRally ' + skilled.avgRally +
  '（≥120）· 随手首局进第 2 庭院 ' + (casual.shareYard2FirstRun * 100).toFixed(1) + '%（≥90%）'
);
