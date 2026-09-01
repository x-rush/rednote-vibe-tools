import { describe, expect, it } from 'vitest'
import { createTimelineClock, resetSceneSample, sampleResetTimeline, sampleTimeline } from './timeline'

describe('scene timeline', () => {
  it.each([
    [0, 'wind'], [299, 'wind'], [300, 'curtain-opening'], [1799, 'curtain-opening'],
    [1800, 'stars-and-letters'], [6499, 'stars-and-letters'], [6500, 'result'], [66_500, 'result'],
  ] as const)('maps %dms to %s', (elapsedMs, stage) => {
    expect(sampleTimeline(elapsedMs, false).stage).toBe(stage)
  })

  it('preserves unbounded result time while clamping narrative progress', () => {
    expect(sampleTimeline(66_500, false)).toMatchObject({
      stage: 'result', totalProgress: 1, narrativeElapsedMs: 6500,
      resultElapsedMs: 60_000, elapsedMs: 66_500,
    })
  })

  it('keeps every narrative stage in reduced motion', () => {
    expect([0, 200, 1100, 3000].map((time) => sampleTimeline(time, true).stage)).toEqual([
      'wind', 'curtain-opening', 'stars-and-letters', 'result',
    ])
  })

  it('continues changing result samples so ambient systems keep animating', () => {
    const first = sampleTimeline(6500, false)
    const later = sampleTimeline(7600, false)
    expect(later.elapsedMs).toBeGreaterThan(first.elapsedMs)
    expect(later.resultElapsedMs).toBeGreaterThan(first.resultElapsedMs)
  })
})

describe('reset scene sample', () => {
  it('returns to a stable first frame', () => {
    expect(resetSceneSample(0).stage).toBe('result')
    expect(resetSceneSample(0.5)).toMatchObject({ stage: 'resetting', stageProgress: 0.5 })
    expect(resetSceneSample(1)).toMatchObject({ stage: 'wind', stageProgress: 0, elapsedMs: 0 })
  })
})

describe('timeline clock', () => {
  it('does not accumulate background time while paused', () => {
    let now = 1000
    const clock = createTimelineClock(() => now)
    clock.start(); now = 1400; clock.pause(); now = 6400; clock.resume(); now = 6600
    expect(clock.elapsed()).toBe(600)
  })

  it('resets elapsed time for a new run', () => {
    let now = 500
    const clock = createTimelineClock(() => now)
    clock.start(); now = 900
    expect(clock.elapsed()).toBe(400)
    clock.reset()
    expect(clock.elapsed()).toBe(0)
  })

  it('keeps reset sampling frozen while its clock is paused', () => {
    let now = 1000
    const clock = createTimelineClock(() => now)
    clock.start(); now = 1450; clock.pause(); now = 9450
    expect(sampleResetTimeline(clock.elapsed())).toMatchObject({
      stage: 'resetting', stageProgress: 0.3,
    })
    clock.resume(); now = 9900
    expect(sampleResetTimeline(clock.elapsed())).toMatchObject({
      stage: 'resetting', stageProgress: 0.6,
    })
  })
})
