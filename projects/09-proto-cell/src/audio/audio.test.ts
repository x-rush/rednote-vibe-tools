import { describe, expect, it } from 'vitest'
import { fakeAudioContext } from '../tests/fixtures'
import { createAudioDirector, cuePattern } from './audio'

describe('audio director', () => {
  it('never starts audio before a user gesture', () => {
    const context = fakeAudioContext()
    const audio = createAudioDirector(context)
    audio.handle({ type: 'engulfed', predatorId: 'player', preyId: 'prey-1', biomass: 8, atMs: 100 })

    expect(audio.state()).toBe('locked')
    expect(context.calls).toEqual([])
  })

  it('unlocks from a gesture and keeps quiet mode mechanically equivalent', async () => {
    const context = fakeAudioContext()
    const audio = createAudioDirector(context)
    await audio.unlock()
    audio.handle({ type: 'damaged', targetId: 'player', amount: 8, source: 'acid', atMs: 100 })
    const audibleCalls = context.calls.length
    audio.setSettings({ music: false, sfx: false })
    audio.handle({ type: 'damaged', targetId: 'player', amount: 8, source: 'acid', atMs: 200 })

    expect(audio.state()).toBe('silent')
    expect(audibleCalls).toBeGreaterThan(0)
    expect(context.calls).toHaveLength(audibleCalls + 1)
  })

  it('raises pitch and layer count across an engulf chain without exceeding the gain cap', () => {
    expect(cuePattern({ kind: 'engulf', chain: 1 }).frequencies).toHaveLength(1)
    expect(cuePattern({ kind: 'engulf', chain: 5 }).frequencies.length).toBeGreaterThan(1)
    expect(cuePattern({ kind: 'engulf', chain: 5 }).frequencies[0]).toBeGreaterThan(cuePattern({ kind: 'engulf', chain: 1 }).frequencies[0]!)
    expect(cuePattern({ kind: 'engulf', chain: 5 }).gain).toBeLessThanOrEqual(0.06)
  })
})
