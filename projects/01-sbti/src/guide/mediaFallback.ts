export type PortraitStage = 'master' | 'placeholder' | 'css'

export function nextPortraitStage(stage: PortraitStage): PortraitStage {
  if (stage === 'master') return 'placeholder'
  return 'css'
}
