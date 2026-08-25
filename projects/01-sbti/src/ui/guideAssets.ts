export type GuidePortraitVariant = 'default' | 'pass-scroll' | 'read-seals'

const GUIDE_PORTRAITS: Readonly<Record<GuidePortraitVariant, string>> = {
  default: '/assets/sbti/guide/guide-master-v1.webp',
  'pass-scroll': '/assets/sbti/guide/guide-wenshan-pass-scroll-v1.webp',
  'read-seals': '/assets/sbti/guide/guide-wenshan-read-seals-v1.webp',
}

export function getGuidePortrait(variant: GuidePortraitVariant) {
  return GUIDE_PORTRAITS[variant]
}
