import { describe, expect, it } from 'vitest'
import { createTimelineClock, sampleTimeline } from './timeline'

describe('scene timeline', () => {
  it.each([
    [0, 'slowing'],
    [1199, 'slowing'],
    [1200, 'selected'],
    [1900, 'wind'],
    [3400, 'window-opening'],
    [4300, 'stars-entering'],
    [6500, 'settling'],
    [7500, 'result'],
  ] as const)('maps %dms to %s', (elapsedMs, stage) => {
    expect(sampleTimeline(elapsedMs, false).stage).toBe(stage)
  })

  it('clamps stage and total progress at both ends', () => {
    expect(sampleTimeline(-10, false)).toMatchObject({
      stage: 'slowing', stageProgress: 0, totalProgress: 0,
    })
    expect(sampleTimeline(99_000, false)).toMatchObject({
      stage: 'result', stageProgress: 1, totalProgress: 1,
    })
  })

  it('keeps every narrative stage in reduced motion', () => {
    const stages = Array.from({ length: 50 }, (_, index) => sampleTimeline(index * 100, true).stage)
    expect(new Set(stages)).toEqual(new Set([
      'slowing', 'selected', 'wind', 'window-opening', 'stars-entering', 'settling', 'result',
    ]))
  })
})

describe('timeline clock', () => {
  it('does not accumulate background time while paused', () => {
    let now = 1000
    const clock = createTimelineClock(() => now)
    clock.start()
    now = 1400
    clock.pause()
    now = 6400
    clock.resume()
    now = 6600
    expect(clock.elapsed()).toBe(600)
  })

  it('resets elapsed time for a new run', () => {
    let now = 500
    const clock = createTimelineClock(() => now)
    clock.start()
    now = 900
    expect(clock.elapsed()).toBe(400)
    clock.reset()
    expect(clock.elapsed()).toBe(0)
  })
})
