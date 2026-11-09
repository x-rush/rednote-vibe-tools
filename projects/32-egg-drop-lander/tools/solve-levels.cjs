/*
 * 蛋落地 · 关卡参数求解器（一次性工具，不参与打包）
 *
 * 玩法重建后，关卡表的高度 / 重力 / 风 / 脉冲数 / 限速 / 障碍带全部沿用
 * eazo 原版逆向表；「冲量」是唯一需要求解的物理常数：
 *   - 冲量太小 → 脉冲预算盖不住落体动能，随手玩家必碎（数学上无解）；
 *   - 冲量太大 → 一发就抵掉大半速度，「一直点」变成最优解，资源决策消失。
 * 求解目标（对每一关）：
 *   1. 随手玩家（闭环模型，反应 180–260ms）≥ 17/20 通过（含障碍带转向）；
 *   2. 熟练玩家 6/6 通过；
 *   3. 不动手必碎、一直乱点必碎；
 *   4. 在满足 1–3 的候选里取最小冲量 —— 资源越紧，决策感越强。
 *
 * 物理与玩家模型全部来自 tools/level-sim.cjs（内部调用 src/game.js），
 * 保证求解器、qa-balance-check 与游戏本体零漂移。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const sim = require(path.join(ROOT, 'tools/level-sim.cjs'));
const content = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/content/content.json'), 'utf8').replace(/^\uFEFF/, '')
);

/* 通过率门槛：随手 17/20（qa-balance-check 的硬门槛是 16/20，求解留 1 档余量） */
const CASUAL_FLOOR = 17;
const PRO_FLOOR = 6;

function probeWith(level, impulse) {
  const copy = Object.assign({}, level);
  copy.impulse = impulse;
  return copy;
}

function evaluate(level, impulse) {
  const probe = probeWith(level, impulse);
  const idle = sim.idleDrop(probe);
  if (idle.ok) return null;                       /* 不动手必须碎 */
  const spam = sim.spamDrop(probe);
  if (spam.ok) return null;                       /* 乱点必须碎 */
  const casual = sim.casualScore(probe);
  if (casual.pass < CASUAL_FLOOR) return null;
  const pro = sim.proScore(probe);
  if (pro.pass < PRO_FLOOR) return null;
  return { casual: casual, pro: pro };
}

const results = [];
for (const level of content.levels) {
  let chosen = null;
  /* 外层扫每关重力缩放（越接近 1 手感越接近原表），内层扫冲量系数 */
  for (const gScale of [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3]) {
    const probeBase = Object.assign({}, level, { gScale: gScale });
    const gEff = level.gravity * sim.game.GRAVITY_SCALE * gScale;
    const vFree = Math.sqrt(2 * gEff * level.height);
    const base = vFree / level.pulses;
    for (let k = 0.9; k <= 3.2; k += 0.1) {
      const impulse = Math.round(base * k);
      const r = evaluate(probeBase, impulse);
      if (r) {
        chosen = { gScale: gScale, impulse: impulse, k: k, casual: r.casual, pro: r.pro };
        break;
      }
    }
    if (chosen) break;
  }
  if (!chosen) {
    console.log(level.name + ' 无解');
    results.push(null);
    continue;
  }
  results.push({
    name: level.name,
    gScale: chosen.gScale,
    impulse: chosen.impulse,
    impulseK: Math.round(chosen.k * 100) / 100,
    casualPass: chosen.casual.pass,
    casualMeanUsed: chosen.casual.meanUsed === null ? null : Math.round(chosen.casual.meanUsed * 100) / 100,
    proPass: chosen.pro.pass
  });
  console.log(
    level.name +
      ' → gScale ' + chosen.gScale +
      ' 冲量 ' + chosen.impulse + '（' + chosen.k.toFixed(1) + '×v/n）' +
      ' 随手=' + chosen.casual.pass + '/20' +
      ' 用量=' + (chosen.casual.meanUsed === null ? '-' : chosen.casual.meanUsed.toFixed(2)) +
      ' 熟练=' + chosen.pro.pass + '/6'
  );
}

fs.mkdirSync(path.join(ROOT, 'qa'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'qa', 'level-plan.json'), JSON.stringify(results, null, 2));
console.log('\n已写出 qa/level-plan.json');
console.log('JSON:');
console.log(JSON.stringify(results, null, 2));
