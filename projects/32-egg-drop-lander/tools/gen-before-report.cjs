/*
 * 蛋落地 · 一次性工具：生成二期返工前的平衡基线（qa/balance-report-before.json）
 *
 * 从 git HEAD 取旧版 content.json，用与 qa-balance-check 完全相同的模拟器
 * （tools/level-sim.cjs，内部调用当前 src/game.js 的 integrate）计算旧关卡的指标，
 * 供 qa-balance-check 输出「旧 → 新」对照。
 * 注：旧关卡没有 jetTime / jetAccel，normalizeLevel 会补 0，等价于旧版的纯冲量喷气。
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const sim = require(path.join(ROOT, 'tools/level-sim.cjs'));

const gitPath = 'projects/32-egg-drop-lander/src/content/content.json';
const raw = execSync('git show HEAD:' + gitPath, {
  cwd: path.resolve(ROOT, '../..'),
  encoding: 'utf8'
});
const content = JSON.parse(raw.replace(/^\uFEFF/, ''));

const rows = content.levels.map((level) => {
  const idle = sim.idleDrop(level);
  const sc = sim.score(level);
  const sc2 = sim.score2D(level);
  const windPeak = Math.abs(level.wind || 0) + Math.abs(level.gust || 0);
  return {
    关卡: level.name,
    安全线: level.safe,
    终端速度: Math.round(level.gravity / level.drag),
    不喷气落地: idle.landed ? Math.round(idle.impact) : null,
    最少喷气: sc.minThrusts === Infinity ? null : sc.minThrusts,
    最费气节奏: sc.maxThrusts,
    气量预算: level.gas,
    真人通过率: sc.pass + '/' + sim.TOTAL,
    二维通过率: sc2.pass + '/' + sim.TOTAL,
    落地秒: Math.round(idle.time * 100) / 100,
    风力峰值: Math.round(windPeak)
  };
});

const out = path.join(ROOT, 'qa', 'balance-report-before.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(rows, null, 2) + '\n', 'utf8');
console.log('已写出 ' + out);
console.log(rows.map((r) => r.关卡 + ' 通过=' + r.真人通过率 + ' 风峰值=' + r.风力峰值).join('\n'));
