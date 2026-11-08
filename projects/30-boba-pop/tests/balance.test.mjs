import { createRequire } from 'node:module';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const Game = require('../src/game.js');
const content = JSON.parse(fs.readFileSync(new URL('../src/content/content.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));

/*
 * 关卡可通关性回归。
 *
 * 盘面由固定种子决定，每关开局完全一致，
 * 因此「随手点最大的那一组」这条朴素策略能拿到的分数是可复现的。
 * 这条策略代表普通玩家的直觉打法：它必须能通关，
 * 否则数值一旦被改动，某些关卡就会变成没人过得去的死关。
 */
function playCasual(levelIndex) {
  const state = Game.createRun(content);
  Game.loadLevel(state, levelIndex);
  let taps = 0;
  while (taps < state.level.taps && state.cleared < state.level.target) {
    const groups = Game.findAllGroups(state.board).filter((g) => g.length >= 3);
    if (!groups.length) break;
    let best = groups[0];
    for (let i = 1; i < groups.length; i++) {
      if (groups[i].length > best.length) best = groups[i];
    }
    const result = Game.applyTap(state, best[0]);
    if (!result.ok) break;
    taps++;
  }
  return { cleared: state.cleared, taps: taps, tapsAllowed: state.level.taps, target: state.level.target };
}

test('every level can be finished by the plain "largest group first" strategy', () => {
  content.levels.forEach((level, index) => {
    const r = playCasual(index);
    assert.ok(
      r.cleared >= r.target,
      `L${index + 1} ${level.name}: 只清了 ${r.cleared}/${r.target} 颗`,
    );
    assert.ok(
      r.taps <= r.tapsAllowed,
      `L${index + 1} ${level.name}: 用了 ${r.taps} 步，超出 ${r.tapsAllowed} 步上限`,
    );
  });
});

test('every level keeps at least two spare taps for the plain strategy', () => {
  content.levels.forEach((level, index) => {
    const r = playCasual(index);
    assert.ok(
      r.tapsAllowed - r.taps >= 2,
      `L${index + 1} ${level.name}: 余量只有 ${r.tapsAllowed - r.taps} 步，容错太低`,
    );
  });
});

test('the tap budget grows as the level gets longer', () => {
  content.levels.forEach((level, index) => {
    assert.ok(level.taps >= 5, `L${index + 1} 步数过少`);
    assert.ok(level.target >= 40, `L${index + 1} 目标过低，关卡没有内容`);
    if (index > 0) {
      assert.ok(
        level.taps >= content.levels[index - 1].taps,
        `L${index + 1} 步数不应少于上一关`,
      );
    }
  });
});
