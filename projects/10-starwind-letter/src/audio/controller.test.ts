import { describe, expect, it } from 'vitest'
import { createAudioController } from './controller'

function fakeAudioContext() {
  const parameter = { setValueAtTime() {}, exponentialRampToValueAtTime() {} }
  const node = { connect() { return node }, disconnect() {} }
  return {
    currentTime: 0,
    destination: node,
    state: 'running',
    createOscillator() {
      return { ...node, frequency: parameter, type: 'sine', start() {}, stop() {} }
    },
    createGain() { return { ...node, gain: parameter } },
    resume: async () => undefined,
    suspend: async () => undefined,
  } as unknown as AudioContext
}

describe('audio controller activation', () => {
  it('does not create an audio context before explicit activation', () => {
    let created = 0
    const audio = createAudioController(() => { created += 1; return fakeAudioContext() })
    audio.cue('wind')
    expect(created).toBe(0)
    expect(audio.snapshot().active).toBe(false)
    audio.activate()
    expect(created).toBe(1)
    expect(audio.snapshot().active).toBe(true)
  })

  it('makes audio failure sticky and non-throwing', () => {
    const audio = createAudioController(() => { throw new Error('blocked') })
    expect(() => audio.activate()).not.toThrow()
    expect(audio.snapshot()).toEqual({ active: false, muted: true, failed: true })
  })

  it('persists the explicit mute preference in its snapshot', () => {
    const audio = createAudioController(fakeAudioContext)
    audio.activate()
    audio.setMuted(true)
    expect(audio.snapshot()).toMatchObject({ active: true, muted: true, failed: false })
  })
})
