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

function windowMotion(sample: TimelineSample) {
  if (sample.stage === 'window-opening') return sample.stageProgress
  if (sample.stage === 'resetting') return 1 - sample.stageProgress
  return ['stars-entering', 'settling', 'result'].includes(sample.stage) ? 1 : 0
}

export function Scene({ sample, mood = 'dream', run = 0, reducedMotion = false, particlesEnabled = true, children }: SceneProps) {
  const shake = sample.stage === 'window-opening' ? Math.min(1, sample.stageProgress * 4.5) : 0
  const sashOpen = windowMotion(sample)
  return (
    <section className="scene" data-stage={sample.stage} aria-label="深蓝房间与月光夜窗">
      <WindowLayer openProgress={sashOpen} shakeProgress={shake} />
      <ParticleCanvases sample={sample} sashOpen={sashOpen} mood={mood} run={run} reducedMotion={reducedMotion} enabled={particlesEnabled} />
      <CurtainLayer sample={sample} />
      <div className="scene-content">{children}</div>
    </section>
  )
}
