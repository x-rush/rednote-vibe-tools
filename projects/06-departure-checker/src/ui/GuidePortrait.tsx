import type { ReactNode } from 'react'
import { GUIDE_ASSETS } from './assets'
import { guidePresentationFor, type GuidePortraitVariant } from './guidePresentation'

type DisplayGuidePortraitProps = {
  variant: GuidePortraitVariant
  children?: ReactNode
  interactive?: false
  onActivate?: never
}

type InteractiveGuidePortraitProps = {
  variant: GuidePortraitVariant
  children?: never
  interactive: true
  onActivate: () => void
}

type GuidePortraitProps = DisplayGuidePortraitProps | InteractiveGuidePortraitProps

export function GuidePortrait({ variant, children, interactive = false, onActivate }: GuidePortraitProps) {
  const presentation = guidePresentationFor(variant)
  const className = `guide-portrait-stage ${presentation.className}`

  if (interactive) {
    return <button className={className} type="button" onClick={onActivate} aria-label="打开路岚帮助">
      <img src={GUIDE_ASSETS.master} alt={presentation.alt} />
      <span className="guide-portrait-shade" aria-hidden="true" />
    </button>
  }

  return <figure className={className}>
    <img src={GUIDE_ASSETS.master} alt={presentation.alt} />
    <span className="guide-portrait-shade" aria-hidden="true" />
    {children && <figcaption className="guide-portrait-copy">{children}</figcaption>}
  </figure>
}
