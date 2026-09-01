import type { ReactNode } from 'react'
import type { TimelineSample } from '../experience/timeline'
import type { Mood } from '../content/messages'
import { ParticleCanvases } from '../particles/ParticleCanvases'
import { CurtainLayer } from './CurtainLayer'
import { WindowLayer } from './WindowLayer'

interface SceneProps {
  readonly sample: TimelineSample
  readonly mood?: Mood
  readonly run?: number
  readonly reducedMotion?: boolean
  readonly particlesEnabled?: boolean
  readonly children?: ReactNode
}

const smoothstep = (value: number) => value * value * (3 - 2 * value)

function lightReveal(sample: TimelineSample) {
  if (sample.stage === 'wind') return sample.stageProgress * 0.08
  if (sample.stage === 'curtain-opening') return smoothstep(sample.stageProgress)
  if (sample.stage === 'resetting') return 1 - sample.stageProgress
  return sample.stage === 'stars-and-letters' || sample.stage === 'result' ? 1 : 0
}

export function Scene({ sample, mood = 'dream', run = 0, reducedMotion = false, particlesEnabled = true, children }: SceneProps) {
  const reveal = lightReveal(sample)
  return (
    <section className="scene" data-stage={sample.stage} aria-label="深蓝房间与月光夜窗">
      <WindowLayer revealProgress={reveal} />
      <ParticleCanvases sample={sample} entryProgress={reveal} mood={mood} run={run} reducedMotion={reducedMotion} enabled={particlesEnabled} />
      <CurtainLayer sample={sample} />
      <div className="scene-content">{children}</div>
    </section>
  )
}
