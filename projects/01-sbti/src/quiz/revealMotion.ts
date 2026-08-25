export type RevealStep = 'collecting' | 'reading' | 'complete'

export function visibleRevealStep(step: RevealStep, reducedMotion: boolean): RevealStep {
  return reducedMotion ? 'complete' : step
}
