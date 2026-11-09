/*
 * 蛋落地 · 一次性工具：把 tools/solve-levels.cjs 的求解结果合并回 content.json
 * 前置：先跑 node tools/solve-levels.cjs 生成 qa/level-plan.json。
 * 求解结果与现有关卡一一对应（按名字校验顺序），字段与 content.json 的关卡完全同构。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'qa/level-plan.json'), 'utf8'));
const contentPath = path.join(ROOT, 'src/content/content.json');
const content = JSON.parse(fs.readFileSync(contentPath, 'utf8').replace(/^\uFEFF/, ''));

if (plan.length !== content.levels.length) {
  throw new Error('关卡数量不一致：plan=' + plan.length + ' content=' + content.levels.length);
}
for (let i = 0; i < plan.length; i++) {
  if (plan[i].name !== content.levels[i].name) {
    throw new Error('第 ' + i + ' 关顺序不一致：' + plan[i].name + ' ≠ ' + content.levels[i].name);
  }
  content.levels[i] = plan[i];
}

fs.writeFileSync(contentPath, JSON.stringify(content, null, 2) + '\n', 'utf8');
console.log('已把 ' + plan.length + ' 关的求解结果合并进 src/content/content.json');
