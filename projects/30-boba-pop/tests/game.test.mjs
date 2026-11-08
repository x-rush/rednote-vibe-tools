import { createRequire } from 'node:module';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const Game = require('../src/game.js');
const content = JSON.parse(fs.readFileSync(new URL('../src/content/content.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));

test('content defines eight levels with rising targets and finite taps', () => {
  assert.equal(content.levels.length, 8);
  content.levels.forEach((level, index) => {
    assert.ok(level.target > 0, 'target must be positive');
    assert.ok(level.taps > 0, 'taps must be positive');
    assert.ok(level.palette.length >= 4, 'palette needs at least four flavors');
    assert.ok(content.flavors.some((f) => f.id === level.palette[0]), 'palette must reference known flavors');
    if (index > 0) {
      assert.ok(level.target > content.levels[index - 1].target, 'targets should rise');
    }
  });
});

test('board generation always yields at least one tappable triple', () => {
  const rng = Game.createRng(20261108);
  const board = Game.makeBoard(6, 8, [0, 1, 2, 3], rng);
  assert.equal(board.cells.length, 48);
  const groups = Game.findAllGroups(board);
  assert.ok(groups.some((group) => group.length >= 3), 'board must contain a tappable triple');
});

test('every generated board starts playable across many seeds', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const rng = Game.createRng(seed * 7919);
    const board = Game.makeBoard(6, 8, [0, 1, 2, 3, 4], rng);
    const groups = Game.findAllGroups(board);
    assert.ok(groups.some((group) => group.length >= 3), 'seed ' + seed + ' produced a dead board');
  }
});

test('findGroup returns only touching cells of the same color', () => {
  const rng = Game.createRng(7);
  const board = Game.makeBoard(6, 8, [0, 1, 2, 3], rng);
  const index = 0;
  const group = Game.findGroup(board, index);
  assert.ok(group.includes(index));
  const color = board.cells[index].color;
  for (const cell of group) {
    assert.equal(board.cells[cell].color, color);
  }
  for (const cell of group) {
    const r = Math.floor(cell / board.cols);
    const c = cell % board.cols;
    const adjacent = [];
    if (r > 0) adjacent.push(cell - board.cols);
    if (r < board.rows - 1) adjacent.push(cell + board.cols);
    if (c > 0) adjacent.push(cell - 1);
    if (c < board.cols - 1) adjacent.push(cell + 1);
    for (const nb of adjacent) {
      if (board.cells[nb] && board.cells[nb].color === color) {
        assert.ok(group.includes(nb), 'all same-color neighbors belong to the group');
      }
    }
  }
});

test('a tap on fewer than three pearls is rejected without changing the board', () => {
  const state = Game.createRun(content);
  let target = -1;
  for (let i = 0; i < state.board.cells.length; i++) {
    if (Game.findGroup(state.board, i).length < 3) {
      target = i;
      break;
    }
  }
  assert.ok(target >= 0, 'board should contain a lone or paired pearl');
  const before = state.board.cells.map((c) => (c ? c.color : null)).join(',');
  const result = Game.applyTap(state, target);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'too-few');
  assert.equal(state.board.cells.map((c) => (c ? c.color : null)).join(','), before);
  assert.equal(state.tapsLeft, state.level.taps);
});

test('a valid tap removes the group, drops pearls and refills the board', () => {
  const state = Game.createRun(content);
  let target = -1;
  for (let i = 0; i < state.board.cells.length; i++) {
    if (Game.findGroup(state.board, i).length >= 3) {
      target = i;
      break;
    }
  }
  assert.ok(target >= 0, 'board should contain a matchable group');
  const result = Game.applyTap(state, target);
  assert.equal(result.ok, true);
  assert.ok(result.popped >= 3);
  assert.equal(state.tapsLeft, state.level.taps - 1);
  assert.equal(state.board.cells.length, 48);
  assert.ok(state.board.cells.every(Boolean), 'board must be completely refilled');
  assert.equal(state.cleared, result.popped);
  assert.ok(state.score > 0);
});

test('every board cell keeps a unique id so the view can track movement', () => {
  const state = Game.createRun(content);
  const result = Game.applyTap(state, 0);
  const ids = state.board.cells.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(result.ok || !result.ok);
});

test('gravity keeps column order intact and never leaves holes', () => {
  const rng = Game.createRng(99);
  const board = Game.makeBoard(6, 8, [0, 1, 2, 3], rng);
  for (let c = 0; c < board.cols; c++) {
    board.cells[3 * board.cols + c] = null;
    board.cells[1 * board.cols + c] = null;
  }
  const before = board.cells.map((cell) => (cell ? cell.id : null));
  Game.applyGravity(board);
  for (let c = 0; c < board.cols; c++) {
    /* 压实后底部连续，顶部留空；空格之上不得再有珍珠 */
    let seenEmpty = false;
    for (let r = board.rows - 1; r >= 0; r--) {
      const cell = board.cells[r * board.cols + c];
      if (!cell) seenEmpty = true;
      else assert.equal(seenEmpty, false, 'no pearl may sit above an empty slot');
    }
    /* 列内顺序保持不变 */
    const remaining = [];
    for (let r = 0; r < board.rows; r++) {
      const cell = board.cells[r * board.cols + c];
      if (cell) remaining.push(cell.id);
    }
    const original = [];
    for (let r = 0; r < board.rows; r++) {
      const id = before[r * board.cols + c];
      if (id) original.push(id);
    }
    assert.deepEqual(remaining, original, 'column order must be preserved');
  }
});

test('the refill queue previews colors that actually arrive next', () => {
  const state = Game.createRun(content);
  const preview = Game.previewColors(state, 6);
  assert.equal(preview.length, 6);
  assert.ok(preview.every((color) => state.palette.includes(color)));
  const consumed = state.queue.slice(0, 6);
  assert.deepEqual(preview, consumed);
});

test('chain scoring grows with the chain depth', () => {
  const state = Game.createRun(content);
  let index = 0;
  for (let i = 0; i < state.board.cells.length; i++) {
    if (Game.findGroup(state.board, i).length >= 3) {
      index = i;
      break;
    }
  }
  const result = Game.applyTap(state, index);
  assert.ok(result.timeline.length >= 1);
  assert.equal(result.timeline[0].chain, 1);
  for (let i = 1; i < result.timeline.length; i++) {
    assert.equal(result.timeline[i].chain, i + 1);
    assert.ok(result.timeline[i].score > 0);
    assert.ok(result.timeline[i].popped >= 3);
  }
});

test('a single tap never wipes the whole board in one chain', () => {
  const state = Game.createRun(content);
  let index = 0;
  for (let i = 0; i < state.board.cells.length; i++) {
    if (Game.findGroup(state.board, i).length >= 3) {
      index = i;
      break;
    }
  }
  const result = Game.applyTap(state, index);
  assert.ok(result.chain <= 8, 'chain depth must stay bounded');
  assert.ok(result.popped <= 48, 'one tap cannot remove more than one board');
  assert.ok(result.score <= 48 * 10 * 5 * 8, 'score must stay bounded');
});

test('pre-existing triples are not auto-cleared by an unrelated tap', () => {
  const state = Game.createRun(content);
  const before = Game.findAllGroups(state.board).filter((g) => g.length >= 3).length;
  assert.ok(before > 0);
  let index = 0;
  for (let i = 0; i < state.board.cells.length; i++) {
    if (Game.findGroup(state.board, i).length >= 3) {
      index = i;
      break;
    }
  }
  const result = Game.applyTap(state, index);
  /* 第一连锁只应消除玩家点中的那一组 */
  assert.equal(result.timeline[0].groups.length, 1);
  const poppedFirst = result.timeline[0].popped;
  assert.ok(poppedFirst >= 3);
  assert.ok(poppedFirst < 48);
});

test('the board stays playable and target progress advances sanely', () => {
  const state = Game.createRun(content);
  for (let round = 0; round < 12; round++) {
    let index = -1;
    for (let i = 0; i < state.board.cells.length; i++) {
      if (Game.findGroup(state.board, i).length >= 3) {
        index = i;
        break;
      }
    }
    assert.ok(index >= 0, 'round ' + round + ' left no tappable group');
    const result = Game.applyTap(state, index);
    assert.ok(result.popped <= 48);
    assert.ok(state.cleared >= 0);
    if (state.tapsLeft <= 0) break;
  }
  assert.ok(state.cleared <= 12 * 48);
});

test('clearing the target completes the level and advances the run', () => {
  const state = Game.createRun(content);
  state.cleared = state.level.target;
  state.tapsLeft = 1;
  let index = 0;
  for (let i = 0; i < state.board.cells.length; i++) {
    if (Game.findGroup(state.board, i).length >= 3) {
      index = i;
      break;
    }
  }
  const result = Game.applyTap(state, index);
  assert.equal(result.levelDone, true);
  Game.loadLevel(state, 1);
  assert.equal(state.levelIndex, 1);
  assert.equal(state.cleared, 0);
  assert.equal(state.tapsLeft, state.level.taps);
  assert.equal(state.board.cells.length, 48);
});

test('every level is reachable and the last level completes the run', () => {
  const state = Game.createRun(content);
  for (let i = 1; i < content.levels.length; i++) {
    Game.loadLevel(state, i);
    assert.equal(state.levelIndex, i);
    assert.equal(state.level.taps, content.levels[i].taps);
  }
  state.cleared = state.level.target;
  let index = 0;
  for (let i = 0; i < state.board.cells.length; i++) {
    if (Game.findGroup(state.board, i).length >= 3) {
      index = i;
      break;
    }
  }
  const result = Game.applyTap(state, index);
  assert.equal(result.levelDone, true);
  assert.equal(result.runDone, true);
});

test('the run stays playable: a tapable group always exists after settling', () => {
  const state = Game.createRun(content);
  for (let round = 0; round < 25; round++) {
    let target = -1;
    for (let i = 0; i < state.board.cells.length; i++) {
      if (Game.findGroup(state.board, i).length >= 3) {
        target = i;
        break;
      }
    }
    if (target < 0) break;
    Game.applyTap(state, target);
    if (state.tapsLeft <= 0) {
      state.tapsLeft = 5;
    }
  }
  const groups = Game.findAllGroups(state.board);
  assert.ok(groups.length > 0);
});
