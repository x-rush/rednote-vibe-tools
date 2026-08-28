import { describe, expect, it } from 'vitest'
import { fakeAudioContext } from '../tests/fixtures'
import { createAudioDirector } from './audio'

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
})
