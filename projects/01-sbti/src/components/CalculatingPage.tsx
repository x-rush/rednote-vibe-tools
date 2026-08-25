import type { DimensionDefinition, GuideCopy } from '../content/types'
import { RevealSequence } from './RevealSequence'

export function CalculatingPage({ guide, dimensions, reducedMotion, onComplete }: { guide: GuideCopy; dimensions: DimensionDefinition[]; reducedMotion: boolean; onComplete: () => void }) {
  return <RevealSequence guide={guide} dimensions={dimensions} reducedMotion={reducedMotion} onComplete={onComplete} />
}
