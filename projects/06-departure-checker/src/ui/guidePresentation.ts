export const GUIDE_PORTRAIT_VARIANTS = [
  'home',
  'wizard',
  'summary',
  'urgent',
  'completion',
  'help',
] as const

export type GuidePortraitVariant = (typeof GUIDE_PORTRAIT_VARIANTS)[number]

type GuidePresentation = {
  className: string
  alt: string
}

const PRESENTATIONS = {
  home: {
    className: 'guide-portrait-home',
    alt: '路岚手持三折出门清单站在明亮玄关',
  },
  wizard: {
    className: 'guide-portrait-wizard',
    alt: '',
  },
  summary: {
    className: 'guide-portrait-summary',
    alt: '',
  },
  urgent: {
    className: 'guide-portrait-urgent',
    alt: '',
  },
  completion: {
    className: 'guide-portrait-completion',
    alt: '',
  },
  help: {
    className: 'guide-portrait-help',
    alt: '',
  },
} satisfies Record<GuidePortraitVariant, GuidePresentation>

export const guidePresentationFor = (variant: GuidePortraitVariant): GuidePresentation =>
  PRESENTATIONS[variant]
