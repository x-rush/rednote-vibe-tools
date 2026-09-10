import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { freshState, startSession, remaining, togglePause, settle, collect, restore, stageOf, localDay } from '../src/engine.js';
const { plants } = JSON.parse(await readFile(new URL('../src/content/content.json', import.meta.url)));
const now = 1_780_000_000_000;
const start = (state = freshState()) => startSession(state, { id: 'one', minutes: 25, task: 'Read', now });
test('every plant has five strictly increasing growth stages', () => {
  for (const p of plants) { assert.equal(p.stages.length, 5); assert.equal(p.stages[0].at, 0); p.stages.slice(1).forEach((s, i) => assert(s.at > p.stages[i].at)); }
});
test('background elapsed time is computed from deadline and capped at zero', () => {
  assert.equal(remaining(start().session, now + 7 * 60000), 18 * 60000);
  assert.equal(remaining(start().session, now + 2 * 3600000), 0);
});
test('pausing excludes time while paused and resumes from remaining time', () => {
  const paused = togglePause(start(), now + 5 * 60000);
  assert.equal(remaining(paused.session, now + 100 * 60000), 20 * 60000);
  const resumed = togglePause(paused, now + 100 * 60000);
  assert.equal(remaining(resumed.session, now + 105 * 60000), 15 * 60000);
});
test('partial session keeps whole minutes, excludes paused time', () => {
  const paused = togglePause(start(), now + 5 * 60000 + 59000);
  const { state, result } = settle(paused, now + 100 * 60000, plants);
  assert.equal(result.minutes, 5); assert.equal(state.total, 5); assert.equal(state.progress.tomato, 5); assert.equal(state.records[0].complete, false);
});
test('completion awards one session only even after an overnight return', () => {
  const done = settle(start(), now + 86400000, plants).state;
  assert.equal(done.total, 25); assert.equal(done.records.length, 1); assert.equal(done.records[0].complete, true);
  assert.deepEqual(settle(done, now + 86400001, plants).state, done);
  assert.equal(settle({ ...done, session: start().session }, now + 86400000, plants).state.total, 25);
});
test('rest completion never awards growth or records', () => {
  const resting = startSession(freshState(), { id: 'rest', minutes: 5, task: '', mode: 'rest', now });
  const done = settle(resting, now + 300000, plants);
  assert.equal(done.state.total, 0); assert.equal(done.state.records.length, 0); assert(done.result.rest);
});
test('growth caps at maturity while total minutes reflect all effort', () => {
  const initial = { ...freshState(), progress: { tomato: 140 } };
  const done = settle(start(initial), now + 25 * 60000, plants).state;
  assert.equal(done.progress.tomato, 150); assert.equal(done.total, 25);
  assert.equal(stageOf(plants[0], 150), 4);
});
test('collect is idempotent, requires maturity and clears only the selected plant', () => {
  assert.equal(collect(freshState(), plants, now, 'c').collection.length, 0);
  const state = { ...freshState(), progress: { tomato: 150, sunflower: 30 } };
  const harvested = collect(state, plants, now, 'c');
  assert.equal(harvested.collection.length, 1); assert.equal(harvested.progress.tomato, 0); assert.equal(harvested.progress.sunflower, 30);
  assert.equal(collect(harvested, plants, now, 'd').collection.length, 1);
});
test('restoring preserves paused and active sessions exactly', () => {
  for (const state of [start(), togglePause(start(), now + 60000)]) assert.deepEqual(restore(JSON.stringify(state), plants), state);
});
test('corrupted and unsupported saved data is rejected', () => {
  for (const raw of ['null', '{}', '{', JSON.stringify({ ...freshState(), total: -1 }), JSON.stringify({ ...freshState(), selected: 'unknown' }), JSON.stringify({ ...freshState(), progress: { tomato: 999 } }), JSON.stringify({ ...freshState(), records: [{}] })]) assert.throws(() => restore(raw, plants));
});
test('zero-minute abandoned session does not clutter history', () => {
  const done = settle(start(), now + 59000, plants).state;
  assert.equal(done.records.length, 0); assert.equal(done.total, 0);
});
test('a running session cannot be replaced by another start', () => {
  const state = start(); assert.strictEqual(start(state), state);
});
test('statistics group by local calendar date', () => {
  assert.equal(localDay(new Date(2026, 8, 6, 0, 1)), '2026-9-6');
  assert.equal(localDay(new Date(2026, 8, 5, 23, 59)), '2026-9-5');
});
test('invalid custom durations never create a timer or corrupt saved progress', () => {
  for (const minutes of [0, -5, NaN, Infinity, 1.5, '25']) {
    const state = freshState();
    assert.strictEqual(startSession(state, { id: 'invalid', minutes, task: '', now }), state);
  }
});
test('custom focus and long rest keep their own duration and reward rules', () => {
  const custom = startSession(freshState(), { id: 'custom', minutes: 37, task: 'Write', now });
  const done = settle(custom, now + 37 * 60000, plants).state;
  assert.equal(done.total, 37);
  const rest = startSession(done, { id: 'long-rest', minutes: 15, mode: 'rest', task: '', now });
  assert.equal(remaining(rest.session, now), 15 * 60000);
  assert.equal(settle(rest, now + 15 * 60000, plants).state.total, 37);
});
test('each plant can grow, survive a reload, and be collected', () => {
  for (const plant of plants) {
    const maturity = plant.stages.at(-1).at;
    const initial = { ...freshState(), selected: plant.id, total: plant.unlock, progress: { [plant.id]: maturity - 5 } };
    const session = startSession(initial, { id: plant.id, minutes: 5, task: 'Grow', now });
    const done = settle(session, now + 5 * 60000, plants).state;
    const restored = restore(JSON.stringify(done), plants);
    assert.equal(stageOf(plant, restored.progress[plant.id]), 4);
    const harvested = collect(restored, plants, now, `harvest-${plant.id}`);
    assert.equal(harvested.collection[0].plantId, plant.id);
    assert.equal(harvested.progress[plant.id], 0);
    assert.equal(harvested.total, plant.unlock + 5);
  }
});
