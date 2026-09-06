import type { TimelineStage } from '../experience/timeline'

export type AudioCue = 'select' | 'wind' | 'curtain' | 'stars'

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

export function stageAudioCue(stage: TimelineStage): AudioCue | undefined {
  if (stage === 'curtain-opening') return 'curtain'
  if (stage === 'stars-and-letters') return 'stars'
  return undefined
}

function playNoise(context: AudioContext, kind: 'wind' | 'curtain') {
  const now = context.currentTime
  const duration = kind === 'wind' ? 1.18 : 0.74
  const sampleCount = Math.ceil(context.sampleRate * duration)
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate)
  const channel = buffer.getChannelData(0)
  for (let index = 0; index < channel.length; index += 1) {
    const envelope = kind === 'curtain'
      ? Math.sin(Math.PI * Math.min(1, index / channel.length))
      : 0.35 + index / channel.length * 0.65
    channel[index] = (Math.random() * 2 - 1) * envelope
  }
  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()
  source.buffer = buffer
  filter.type = kind === 'wind' ? 'lowpass' : 'bandpass'
  filter.frequency.setValueAtTime(kind === 'wind' ? 620 : 1850, now)
  filter.frequency.exponentialRampToValueAtTime(kind === 'wind' ? 980 : 760, now + duration)
  filter.Q.setValueAtTime(kind === 'wind' ? 0.72 : 0.9, now)
  gain.gain.setValueAtTime(0.001, now)
  gain.gain.exponentialRampToValueAtTime(kind === 'wind' ? 0.032 : 0.055, now + (kind === 'wind' ? 0.34 : 0.045))
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
  source.connect(filter).connect(gain).connect(context.destination)
  source.start(now)
  source.stop(now + duration + 0.02)
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
      if (name === 'wind' || name === 'curtain') {
        playNoise(context, name)
        return
      }
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const now = context.currentTime
      const settings = {
        select: { frequency: 620, duration: 0.16, volume: 0.035, type: 'sine' },
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
