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

export type AudioCueInput =
  | { kind: 'movement-onset' }
  | { kind: 'engulf'; chain: number }
  | { kind: 'damage'; severity?: number }
  | { kind: 'block' }
  | { kind: 'collapse-warning' }
  | { kind: 'metamorphosis' }
  | { kind: 'boss-arrival' }
  | { kind: 'death' }
  | { kind: 'ending' }

export type AudioCuePattern = {
  frequencies: number[]
  duration: number
  gain: number
  type: OscillatorType
  staggerMs: number
}

export function cuePattern(input: AudioCueInput): AudioCuePattern {
  if (input.kind === 'engulf') {
    const chain = Math.max(1, Math.min(8, Math.floor(input.chain)))
    const base = 410 + chain * 34
    const frequencies = chain >= 5 ? [base, base * 1.25, base * 1.5] : chain >= 3 ? [base, base * 1.25] : [base]
    return { frequencies, duration: 0.1 + chain * 0.012, gain: Math.min(0.06, 0.034 + chain * 0.004), type: 'sine', staggerMs: 18 }
  }
  if (input.kind === 'movement-onset') return { frequencies: [210, 315], duration: 0.08, gain: 0.025, type: 'triangle', staggerMs: 12 }
  if (input.kind === 'damage') return { frequencies: [110, 82], duration: 0.16, gain: Math.min(0.06, 0.045 + (input.severity ?? 0) * 0.01), type: 'sawtooth', staggerMs: 16 }
  if (input.kind === 'block') return { frequencies: [720, 960], duration: 0.08, gain: 0.035, type: 'triangle', staggerMs: 10 }
  if (input.kind === 'collapse-warning') return { frequencies: [180, 135, 90], duration: 0.24, gain: 0.04, type: 'triangle', staggerMs: 55 }
  if (input.kind === 'metamorphosis') return { frequencies: [330, 494, 659, 988], duration: 0.28, gain: 0.05, type: 'sine', staggerMs: 42 }
  if (input.kind === 'boss-arrival') return { frequencies: [82, 123, 164], duration: 0.38, gain: 0.055, type: 'sawtooth', staggerMs: 65 }
  if (input.kind === 'death') return { frequencies: [110, 82, 62], duration: 0.42, gain: 0.055, type: 'sawtooth', staggerMs: 70 }
  return { frequencies: [523, 659, 784], duration: 0.42, gain: 0.05, type: 'sine', staggerMs: 58 }
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
      const input = cueInputFor(event)
      if (!input) return
      const pattern = cuePattern(input)
      const frequencies = pattern.frequencies.slice(0, 8)
      const layerGain = pattern.gain / Math.max(1, frequencies.length)
      frequencies.forEach((frequency, index) => playTone(context!, frequency, pattern.duration, layerGain, pattern.type, index * pattern.staggerMs / 1000))
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

function cueInputFor(event: GameEvent): AudioCueInput | undefined {
  if (event.type === 'engulfed') return { kind: 'engulf', chain: event.predatorId.startsWith('player') ? event.chain ?? 1 : 1 }
  if (event.type === 'damaged') return { kind: 'damage', severity: Math.min(1, event.amount / 100) }
  if (event.type === 'blocked') return { kind: 'block' }
  if (event.type === 'collapse-warning' || event.type === 'event-phase' && event.phase === 'telegraph') return { kind: 'collapse-warning' }
  if (event.type === 'mutation-selected') return { kind: 'metamorphosis' }
  if (event.type === 'trait-triggered' && (event.effectId === 'pursuit-burst' || event.effectId === 'current-assisted-acceleration')) return { kind: 'movement-onset' }
  if (event.type === 'boss-resolved') return { kind: 'boss-arrival' }
  if (event.type === 'player-died') return { kind: 'death' }
  if (event.type === 'ending-reached') return { kind: 'ending' }
  return undefined
}

function playTone(context: AudioContextLike, frequency: number, duration: number, volume: number, type: OscillatorType, delay = 0) {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const now = context.currentTime
  oscillator.type = type
  oscillator.frequency.setValueAtTime?.(frequency, now + delay)
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime?.(volume, now + delay)
  gain.gain.exponentialRampToValueAtTime?.(0.0001, now + delay + duration)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(now + delay)
  oscillator.stop(now + delay + duration)
}
