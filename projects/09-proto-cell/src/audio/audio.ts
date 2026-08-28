import type { GameEvent } from '../game/interactions'

export type AudioSettings = { music: boolean; sfx: boolean }
export type AudioState = 'locked' | 'ready' | 'silent' | 'failed' | 'closed'

export type AudioParamLike = {
  value: number
  setValueAtTime?(value: number, atTime: number): void
  exponentialRampToValueAtTime?(value: number, endTime: number): void
}
export type AudioNodeLike = { connect(destination: unknown): unknown; disconnect?(): void }
export type OscillatorLike = AudioNodeLike & { type: OscillatorType; frequency: AudioParamLike; start(when?: number): void; stop(when?: number): void }
export type GainLike = AudioNodeLike & { gain: AudioParamLike }
export type AudioContextLike = {
  currentTime: number
  state: string
  destination: unknown
  resume(): Promise<void>
  createOscillator(): OscillatorLike
  createGain(): GainLike
  close?(): Promise<void>
}

export type AudioDirector = {
  unlock(): Promise<void>
  handle(event: GameEvent): void
  setSettings(settings: AudioSettings): void
  state(): AudioState
  destroy(): void
}

export function createAudioDirector(
  source: AudioContextLike | (() => AudioContextLike | undefined),
  initial: AudioSettings = { music: true, sfx: true },
): AudioDirector {
  let context: AudioContextLike | undefined
  let status: AudioState = 'locked'
  let settings = { ...initial }
  let ambient: { oscillator: OscillatorLike; gain: GainLike } | undefined

  return {
    async unlock() {
      if (status === 'closed' || status === 'ready' || status === 'silent') return
      try {
        context = typeof source === 'function' ? source() : source
        if (!context) {
          status = 'failed'
          return
        }
        await context.resume()
        status = settings.music || settings.sfx ? 'ready' : 'silent'
        syncAmbient()
      } catch {
        status = 'failed'
      }
    },
    handle(event) {
      if (status !== 'ready' || !settings.sfx || !context) return
      const cue = cueFor(event)
      if (!cue) return
      playTone(context, cue.frequency, cue.duration, cue.gain, cue.type)
    },
    setSettings(next) {
      settings = { ...next }
      if (status === 'ready' || status === 'silent') status = settings.music || settings.sfx ? 'ready' : 'silent'
      syncAmbient()
    },
    state: () => status,
    destroy() {
      stopAmbient()
      void context?.close?.()
      status = 'closed'
    },
  }

  function syncAmbient() {
    if (!context || status === 'locked' || status === 'failed' || status === 'closed') return
    if (!settings.music) {
      stopAmbient()
      return
    }
    if (ambient) return
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = 55
    gain.gain.value = 0.018
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    ambient = { oscillator, gain }
  }

  function stopAmbient() {
    if (!ambient) return
    try { ambient.oscillator.stop() } catch { /* already stopped */ }
    ambient.oscillator.disconnect?.()
    ambient.gain.disconnect?.()
    ambient = undefined
  }
}

export function createBrowserAudioDirector(settings?: AudioSettings): AudioDirector {
  return createAudioDirector(() => {
    const Constructor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    return Constructor ? new Constructor() : undefined
  }, settings)
}

function cueFor(event: GameEvent): { frequency: number; duration: number; gain: number; type: OscillatorType } | undefined {
  if (event.type === 'engulfed') return { frequency: event.predatorId.startsWith('player') ? 440 : 130, duration: 0.11, gain: 0.045, type: 'sine' }
  if (event.type === 'damaged') return { frequency: 105, duration: 0.16, gain: 0.055, type: 'sawtooth' }
  if (event.type === 'blocked') return { frequency: 720, duration: 0.08, gain: 0.035, type: 'triangle' }
  if (event.type === 'mutation-ready') return { frequency: 610, duration: 0.22, gain: 0.035, type: 'sine' }
  if (event.type === 'event-phase' && event.phase === 'telegraph') return { frequency: 180, duration: 0.28, gain: 0.028, type: 'triangle' }
  if (event.type === 'boss-resolved') return { frequency: 330, duration: 0.4, gain: 0.05, type: 'sine' }
  if (event.type === 'player-died') return { frequency: 72, duration: 0.45, gain: 0.055, type: 'sawtooth' }
  if (event.type === 'ending-reached') return { frequency: 523, duration: 0.5, gain: 0.045, type: 'sine' }
  return undefined
}

function playTone(context: AudioContextLike, frequency: number, duration: number, volume: number, type: OscillatorType) {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const now = context.currentTime
  oscillator.type = type
  oscillator.frequency.setValueAtTime?.(frequency, now)
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime?.(volume, now)
  gain.gain.exponentialRampToValueAtTime?.(0.0001, now + duration)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(now)
  oscillator.stop(now + duration)
}
