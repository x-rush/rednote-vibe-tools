import { describe, expect, it } from 'vitest'
import { createAudioController, stageAudioCue } from './controller'

function fakeAudioContext(calls = { buffers: 0, filters: 0 }) {
  const parameter = { setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }
  const node = { connect() { return node }, disconnect() {} }
  return {
    currentTime: 0,
    sampleRate: 48_000,
    destination: node,
    state: 'running',
    createOscillator() {
      return { ...node, frequency: parameter, type: 'sine', start() {}, stop() {} }
    },
    createGain() { return { ...node, gain: parameter } },
    createBuffer() {
      calls.buffers += 1
      return { getChannelData: () => new Float32Array(48_000) }
    },
    createBufferSource() { return { ...node, buffer: null, start() {}, stop() {} } },
    createBiquadFilter() {
      calls.filters += 1
      return { ...node, type: 'lowpass', frequency: parameter, Q: parameter }
    },
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

  it('renders the curtain brush as filtered broadband texture', () => {
    const calls = { buffers: 0, filters: 0 }
    const audio = createAudioController(() => fakeAudioContext(calls))
    audio.activate()
    expect(() => audio.cue('curtain')).not.toThrow()
    expect(calls.buffers).toBe(1)
    expect(calls.filters).toBeGreaterThanOrEqual(1)
  })

  it('synchronizes the brush cue with the curtain-opening stage', () => {
    expect(stageAudioCue('wind')).toBeUndefined()
    expect(stageAudioCue('curtain-opening')).toBe('curtain')
    expect(stageAudioCue('stars-and-letters')).toBe('stars')
  })
})
