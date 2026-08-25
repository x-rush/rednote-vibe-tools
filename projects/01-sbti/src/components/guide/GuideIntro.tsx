import { useEffect, useRef, useState } from 'react'
import type { ExperienceCopy } from '../../content/types'

type Props = {
  copy: ExperienceCopy['guide']
  onDismiss: () => void
  onComplete: () => void
}

export function GuideIntro({ copy, onDismiss, onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [imageFailed, setImageFailed] = useState(false)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const isLast = step === copy.steps.length - 1

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  return (
    <div className="guide-overlay" role="presentation">
      <section
        className="guide-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        aria-describedby="guide-line"
        onKeyDown={(event) => {
          if (event.key === 'Escape') onDismiss()
        }}
      >
        <div
          className={`guide-sheet__portrait${imageFailed ? ' guide-sheet__portrait--fallback' : ''}`}
          style={{ backgroundImage: 'url(/assets/sbti/guide/guide-placeholder-v1.webp)' }}
          aria-hidden="true"
        >
          {!imageFailed && (
            <img
              src="/assets/sbti/guide/guide-master-v1.webp"
              alt=""
              width="900"
              height="1200"
              decoding="async"
              onError={() => setImageFailed(true)}
            />
          )}
          {imageFailed && <span className="guide-ink-figure" />}
        </div>
        <div className="guide-sheet__copy">
          <div className="guide-sheet__identity">
            <p>{copy.role}</p>
            <span aria-label={`第 ${step + 1} 句，共 ${copy.steps.length} 句`}>{step + 1} / {copy.steps.length}</span>
          </div>
          <h2 id="guide-title" ref={titleRef} tabIndex={-1}>{copy.name}</h2>
          <p id="guide-line" className="guide-line">{copy.steps[step]}</p>
          <div className="guide-sheet__actions">
            <button type="button" className="button button--quiet" onClick={onDismiss}>跳过引导</button>
            <button
              type="button"
              className="button button--primary"
              onClick={() => isLast ? onComplete() : setStep((value) => value + 1)}
            >
              {isLast ? '收下试卷' : '下一句'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
