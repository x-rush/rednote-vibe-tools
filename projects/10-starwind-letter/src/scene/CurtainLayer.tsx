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
    case 'resetting': return 0.36 * (1 - sample.stageProgress)
    case 'result': return 0.36
  }
}

function gatherStrength(sample: TimelineSample) {
  switch (sample.stage) {
    case 'slowing':
    case 'selected': return 0
    case 'wind': return sample.stageProgress * 0.42
    case 'window-opening': return 0.42 + sample.stageProgress * 0.38
    case 'stars-entering': return 0.8 + sample.stageProgress * 0.15
    case 'settling': return 0.95 + sample.stageProgress * 0.05
    case 'resetting': return 1 - sample.stageProgress
    case 'result': return 1
  }
}

export function CurtainLayer({ sample }: CurtainLayerProps) {
  const id = useId().replaceAll(':', '')
  const strands = useMemo(() => createCurtainStrands(64, createMulberry32(0x51a7)), [])
  const strength = windStrength(sample)
  const gather = gatherStrength(sample)
  return (
    <svg className="curtain-layer" viewBox="0 0 390 844" aria-hidden="true" data-layer="curtain">
      <defs>
        <linearGradient id={`${id}-strand`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#fff" stopOpacity="0.92" />
          <stop offset="0.45" stopColor="#b5cbff" stopOpacity="0.62" />
          <stop offset="1" stopColor="#6788ff" stopOpacity="0.08" />
        </linearGradient>
        <filter id={`${id}-strand-glow`} x="-35%" y="-15%" width="170%" height="150%">
          <feGaussianBlur stdDeviation="0.72" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <line x1="184" y1="116" x2="373" y2="151" stroke="#dce8ff" strokeOpacity={0.42 + sample.totalProgress * 0.28} strokeWidth="1.5" filter={`url(#${id}-strand-glow)`} />
      <g filter={`url(#${id}-strand-glow)`}>
        {strands.map((strand) => (
          <path
            key={strand.id}
            d={curtainPathData(sampleCurtainPath(strand, strength, sample.elapsedMs, gather))}
            fill="none"
            stroke={`url(#${id}-strand)`}
            strokeWidth={strand.id % 9 === 0 ? 0.9 : 0.46}
            opacity={strand.brightness * (0.72 - gather * 0.39)}
          />
        ))}
      </g>
    </svg>
  )
}
