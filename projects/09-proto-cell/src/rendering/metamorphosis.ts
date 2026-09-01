export type MetamorphosisPresentation = {
  phase: 'contraction' | 'growth' | 'bloom' | 'cross-fade'
  scale: number
  alpha: number
  bloom: number
  titleAlpha: number
}

export function metamorphosisPresentation(ageMs: number, reducedMotion: boolean): MetamorphosisPresentation | undefined {
  if (ageMs < 0) return undefined
  if (reducedMotion) {
    if (ageMs >= 180) return undefined
    return { phase: 'cross-fade', scale: 1, alpha: Math.min(1, ageMs / 90), bloom: 0, titleAlpha: ageMs / 180 }
  }
  if (ageMs >= 900) return undefined
  if (ageMs < 220) {
    const progress = ageMs / 220
    return { phase: 'contraction', scale: 1 - progress * 0.16, alpha: 1, bloom: 0, titleAlpha: 0 }
  }
  if (ageMs < 560) {
    const progress = (ageMs - 220) / 340
    return { phase: 'growth', scale: 0.84 + (1 - (1 - progress) ** 3) * 0.2, alpha: 1, bloom: progress * 0.35, titleAlpha: 0 }
  }
  const progress = (ageMs - 560) / 340
  return { phase: 'bloom', scale: 1.04 - progress * 0.04, alpha: 1, bloom: 1 - progress * 0.35, titleAlpha: Math.min(1, progress * 2) }
}
