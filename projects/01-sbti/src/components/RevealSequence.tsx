import { useEffect, useState } from 'react'
import type { DimensionDefinition, GuideCopy } from '../content/types'
import { deriveGuideMoment } from '../guide/guideMoment'
import { visibleRevealStep, type RevealStep } from '../quiz/revealMotion'
import { GuidePresence } from './guide/GuidePresence'

export type RevealSequenceProps = {
  guide: Pick<GuideCopy, 'name' | 'role' | 'reveal'>
  dimensions: DimensionDefinition[]
  reducedMotion: boolean
  onComplete: () => void
}

export function RevealSequence({ guide, dimensions, reducedMotion, onComplete }: RevealSequenceProps) {
  const [step, setStep] = useState<RevealStep>(reducedMotion ? 'complete' : 'collecting')
  const visibleStep = visibleRevealStep(step, reducedMotion)
  const moment = deriveGuideMoment({ screen: 'calculating', revealStep: visibleStep })
  const line = moment?.kind === 'reveal' ? guide.reveal[moment.step] : guide.reveal.complete

  useEffect(() => {
    if (reducedMotion || step === 'complete') return
    const next = window.setTimeout(() => setStep(step === 'collecting' ? 'reading' : 'complete'), step === 'collecting' ? 420 : 820)
    return () => window.clearTimeout(next)
  }, [reducedMotion, step])

  return (
    <main className="page page--center page--night reveal-sequence" data-state={visibleStep} aria-live="polite">
      <p className="eyebrow eyebrow--night">收卷 · 四维显形</p>
      <h1>{visibleStep === 'complete' ? '兽志将启' : '正在辨认卷中墨迹'}</h1>
      <GuidePresence name={guide.name} role={guide.role} line={line} />
      <ol className="reveal-sequence__seals" aria-label="四维倾向印">
        {dimensions.map((dimension, index) => (
          <li className={`reveal-sequence__seal${visibleStep === 'collecting' && index > 0 ? ' reveal-sequence__seal--waiting' : ''}`} data-state={visibleStep === 'collecting' && index > 0 ? 'waiting' : 'revealed'} key={dimension.code}>
            <strong>{dimension.displayName}</strong>
            <small>{dimension.poles[0].name} · {dimension.poles[1].name}</small>
          </li>
        ))}
      </ol>
      {visibleStep === 'complete' ? (
        <button type="button" className="button button--primary" onClick={onComplete}>展开兽志</button>
      ) : (
        <button type="button" className="text-button text-button--night" onClick={() => setStep('complete')}>跳过显形</button>
      )}
    </main>
  )
}
