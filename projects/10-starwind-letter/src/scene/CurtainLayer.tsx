import { useId, useMemo } from 'react'
import { createMulberry32 } from '../domain/random'
import type { TimelineSample } from '../experience/timeline'
import { createCurtainStrands, curtainPathData, sampleCurtainPath } from './curtain'

interface CurtainLayerProps { readonly sample: TimelineSample }

function windStrength(sample: TimelineSample) {
  switch (sample.stage) {
    case 'slowing': return 0
    case 'selected': return sample.stageProgress * 0.04
    case 'wind': return sample.stageProgress
    case 'window-opening': return 1 - sample.stageProgress * 0.12
    case 'stars-entering': return 0.88 - sample.stageProgress * 0.2
    case 'settling': return 0.68 - sample.stageProgress * 0.3
    case 'result': return 0.36
  }
}

export function CurtainLayer({ sample }: CurtainLayerProps) {
  const id = useId().replaceAll(':', '')
  const strands = useMemo(() => createCurtainStrands(64, createMulberry32(0x51a7)), [])
  const strength = windStrength(sample)
  return (
    <svg className="curtain-layer" viewBox="0 0 390 844" aria-hidden="true" data-layer="curtain">
      <defs>
        <linearGradient id={`${id}-strand`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#fff" stopOpacity="0.92" />
          <stop offset="0.45" stopColor="#b5cbff" stopOpacity="0.62" />
          <stop offset="1" stopColor="#6788ff" stopOpacity="0.08" />
        </linearGradient>
        <filter id={`${id}-strand-glow`} x="-35%" y="-15%" width="170%" height="150%">
          <feGaussianBlur stdDeviation="1.4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <line x1="184" y1="116" x2="373" y2="151" stroke="#f0f6ff" strokeWidth="2" filter={`url(#${id}-strand-glow)`} />
      <g filter={`url(#${id}-strand-glow)`}>
        {strands.map((strand) => (
          <path
            key={strand.id}
            d={curtainPathData(sampleCurtainPath(strand, strength, sample.elapsedMs))}
            fill="none"
            stroke={`url(#${id}-strand)`}
            strokeWidth={strand.id % 9 === 0 ? 1.18 : 0.66}
            opacity={strand.brightness}
          />
        ))}
      </g>
    </svg>
  )
}
