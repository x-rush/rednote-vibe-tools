import type { UiContent } from '../content/schema'
import { assets } from './asset-paths'

type MiraGuideProps = {
  copy: UiContent['intro']
  step: 0 | 1 | 2
  onNext: () => void
  onSkip: () => void
}

export function MiraGuide({ copy, step, onNext, onSkip }: MiraGuideProps) {
  const totalSteps = copy.lines.length

  return (
    <section className="mira-guide" role="dialog" aria-modal="true" aria-labelledby="mira-guide-title">
      <div className="mira-guide__bar">
        <span>{copy.role}</span>
        <button className="text-button" type="button" onClick={onSkip}>{copy.skipLabel}</button>
      </div>
      <div className="mira-guide__portrait" aria-hidden="true">
        <img src={assets.mira.master} width="1086" height="1448" alt="" />
      </div>
      <div className="mira-dialogue">
        <div className="mira-dialogue__speaker">
          <img src={assets.mira.avatar} width="48" height="48" alt="" />
          <div><strong id="mira-guide-title">{copy.name}</strong><span>{copy.role}</span></div>
        </div>
        <p>{copy.lines[step]}</p>
        <div className="mira-dialogue__progress" aria-label={`${step + 1} / ${totalSteps}`}>
          <span className="mira-dialogue__counter" aria-hidden="true">
            <strong>{String(step + 1).padStart(2, '0')}</strong><span>/ {String(totalSteps).padStart(2, '0')}</span>
          </span>
          <span className="mira-dialogue__pips" aria-hidden="true">
            {copy.lines.map((_, index) => {
              const stateClass = index < step ? ' mira-dialogue__pip--complete' : index === step ? ' mira-dialogue__pip--active' : ''
              return <i className={`mira-dialogue__pip${stateClass}`} key={index} />
            })}
          </span>
        </div>
        <button type="button" className="button button--primary button--large" onClick={onNext}>{step === 2 ? copy.finishLabel : copy.nextLabel}</button>
      </div>
    </section>
  )
}
