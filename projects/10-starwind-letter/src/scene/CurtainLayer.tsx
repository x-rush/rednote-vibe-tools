import { useId, useMemo } from 'react'
import { createMulberry32 } from '../domain/random'
import type { TimelineSample } from '../experience/timeline'
import { createCurtainStrands, curtainPathData, sampleCurtainPath } from './curtain'

interface CurtainLayerProps {
  readonly sample: TimelineSample
  readonly reducedMotion?: boolean
}

function curtainMotion(sample: TimelineSample) {
  switch (sample.stage) {
    case 'wind': return { opening: sample.stageProgress * 0.12, ambient: 0.08 }
    case 'curtain-opening': return {
      opening: 0.12 + sample.stageProgress * 0.88,
      ambient: 0.18 + sample.stageProgress * 0.28,
    }
    case 'stars-and-letters': return { opening: 1, ambient: 0.42 }
    case 'result': return {
      opening: 1,
      ambient: 0.32 + Math.sin(sample.resultElapsedMs / 1700) * 0.1,
    }
    case 'resetting': return {
      opening: 1 - sample.stageProgress,
      ambient: 0.24 * (1 - sample.stageProgress),
    }
  }
}

export function CurtainLayer({ sample, reducedMotion = false }: CurtainLayerProps) {
  const id = useId().replaceAll(':', '')
  const strands = useMemo(() => createCurtainStrands(64, createMulberry32(0x51a7)), [])
  const motion = curtainMotion(sample)
  const ambient = motion.ambient * (reducedMotion ? 0.42 : 1)
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
            d={curtainPathData(sampleCurtainPath(strand, motion.opening, sample.elapsedMs, ambient))}
            fill="none"
            stroke={`url(#${id}-strand)`}
            strokeWidth={strand.id % 9 === 0 ? 0.9 : 0.46}
            opacity={strand.brightness * (0.72 - motion.opening * 0.28)}
          />
        ))}
      </g>
    </svg>
  )
}
