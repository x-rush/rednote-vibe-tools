export type AudioCue = 'select' | 'wind' | 'frame' | 'stars'

export interface AudioSnapshot {
  readonly active: boolean
  readonly muted: boolean
  readonly failed: boolean
}

export interface AudioController {
  activate(): void
  cue(name: AudioCue): void
  setMuted(muted: boolean): void
  pause(): void
  resume(): void
  snapshot(): AudioSnapshot
}

export function createAudioController(factory: () => AudioContext): AudioController {
  let context: AudioContext | undefined
  let muted = false
  let failed = false

  const snapshot = (): AudioSnapshot => ({ active: Boolean(context), muted, failed })

  return {
    activate() {
      if (context || failed) return
      try {
        context = factory()
        if (context.state === 'suspended') void context.resume().catch(() => undefined)
      } catch {
        failed = true
        muted = true
      }
    },
    cue(name) {
      if (!context || muted || failed) return
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const now = context.currentTime
      const settings = {
        select: { frequency: 620, duration: 0.16, volume: 0.035, type: 'sine' },
        wind: { frequency: 95, duration: 1.05, volume: 0.025, type: 'sawtooth' },
        frame: { frequency: 155, duration: 0.18, volume: 0.04, type: 'triangle' },
        stars: { frequency: 880, duration: 0.72, volume: 0.03, type: 'sine' },
      }[name] as { frequency: number; duration: number; volume: number; type: OscillatorType }
      oscillator.type = settings.type
      oscillator.frequency.setValueAtTime(settings.frequency, now)
      gain.gain.setValueAtTime(0.001, now)
      gain.gain.exponentialRampToValueAtTime(settings.volume, now + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, now + settings.duration)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(now)
      oscillator.stop(now + settings.duration + 0.03)
    },
    setMuted(nextMuted) { muted = nextMuted },
    pause() {
      if (context?.state === 'running') void context.suspend().catch(() => undefined)
    },
    resume() {
      if (context?.state === 'suspended' && !muted) void context.resume().catch(() => undefined)
    },
    snapshot,
  }
}
