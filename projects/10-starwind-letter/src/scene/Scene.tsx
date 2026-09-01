import type { ReactNode } from 'react'
import type { TimelineSample } from '../experience/timeline'
import { CurtainLayer } from './CurtainLayer'
import { WindowLayer } from './WindowLayer'

interface SceneProps { readonly sample: TimelineSample; readonly children?: ReactNode }

function windowMotion(sample: TimelineSample) {
  if (sample.stage === 'window-opening') return sample.stageProgress
  return ['stars-entering', 'settling', 'result'].includes(sample.stage) ? 1 : 0
}

export function Scene({ sample, children }: SceneProps) {
  const shake = sample.stage === 'window-opening' ? Math.min(1, sample.stageProgress * 4.5) : 0
  return (
    <section className="scene" data-stage={sample.stage} aria-label="深蓝房间与月光夜窗">
      <WindowLayer openProgress={windowMotion(sample)} shakeProgress={shake} />
      <CurtainLayer sample={sample} />
      <div className="scene-content">{children}</div>
    </section>
  )
}
