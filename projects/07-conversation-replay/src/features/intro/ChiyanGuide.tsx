import { assetUrl, GUIDE_ASSETS } from '../../assets/manifest'
import type { CompanionViewModel } from '../../app/viewV2'

export function ChiyanGuide({
  companion,
  title,
  lead,
  step,
  primaryLabel,
  secondaryLabel,
  onNext,
  onSkip,
}: {
  companion: CompanionViewModel
  title: string
  lead: string
  step: number
  primaryLabel: string
  secondaryLabel: string
  onNext(): void
  onSkip(): void
}) {
  return (
    <section className="guide-stage" aria-labelledby="guide-title">
      <div className="guide-portrait-wrap">
        <img
          className="guide-portrait"
          src={assetUrl(GUIDE_ASSETS.master)}
          width="900"
          height="1200"
          alt={`句子编辑${companion.name}拿着四块空白纸条的分栏便签本`}
          onError={(event) => {
            event.currentTarget.onerror = null
            event.currentTarget.src = assetUrl(GUIDE_ASSETS.placeholder)
          }}
        />
      </div>
      <article className="guide-sheet">
        <div className="guide-identity">
          <img src={assetUrl(GUIDE_ASSETS.avatar)} width="48" height="48" alt="迟言头像" onError={(event) => {
            event.currentTarget.onerror = null
            event.currentTarget.src = assetUrl(GUIDE_ASSETS.placeholder)
          }} />
          <span><b>{companion.name}</b><small>{companion.role}</small></span>
          <em>{step + 1} / 3</em>
        </div>
        <h1 id="guide-title">{title}</h1>
        <p>{lead}</p>
        <div className="split-actions">
          <button className="button ghost" type="button" onClick={onSkip}>{secondaryLabel}</button>
          <button className="button primary" type="button" onClick={onNext}>{primaryLabel}</button>
        </div>
      </article>
    </section>
  )
}
