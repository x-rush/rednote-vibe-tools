import { useId, useMemo } from 'react'
import { createMulberry32 } from '../domain/random'
import type { TimelineSample } from '../experience/timeline'
import { createCurtainStrands, curtainPathData, curtainVeilPathData, pointOnCurtainPath, sampleCurtainPath } from './curtain'

interface CurtainLayerProps {
  readonly sample: TimelineSample
  readonly reducedMotion?: boolean
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))
const smoothstep = (value: number) => value * value * (3 - 2 * value)

function motionElapsedMs(sample: TimelineSample) {
  switch (sample.stage) {
    case 'wind': return sample.stageProgress * 300
    case 'curtain-opening': return 300 + sample.stageProgress * 1500
    case 'stars-and-letters': return 1800 + sample.stageProgress * 4700
    case 'result': return 6500 + sample.resultElapsedMs
    case 'resetting': return sample.elapsedMs
  }
}

function curtainMotion(sample: TimelineSample) {
  if (sample.stage === 'resetting') {
    return {
      opening: 1 - sample.stageProgress,
      ambient: 0.24 * (1 - sample.stageProgress),
      gustStrength: 0,
      flowStrength: 0,
    }
  }
  const elapsedMs = motionElapsedMs(sample)
  const opening = elapsedMs < 300
    ? smoothstep(clamp((elapsedMs - 120) / 180)) * 0.05
    : 0.05 + clamp((elapsedMs - 300) / 1500) * 0.95
  const breezeRise = smoothstep(clamp((elapsedMs - 520) / 1680))
  const pressureRise = smoothstep(clamp((elapsedMs - 150) / 360))
  return {
    opening,
    ambient: 0.08 + pressureRise * 0.13 + breezeRise * 0.53,
    gustStrength: 1,
    flowStrength: breezeRise * 0.16,
  }
}

export function CurtainLayer({ sample, reducedMotion = false }: CurtainLayerProps) {
  const id = useId().replaceAll(':', '')
  const strands = useMemo(() => createCurtainStrands(64, createMulberry32(0x51a7)), [])
  const motion = curtainMotion(sample)
  const motionElapsed = motionElapsedMs(sample)
  const motionScale = reducedMotion ? 0.42 : 1
  const ambient = motion.ambient * motionScale
  const flowShift = (
    Math.sin(motionElapsed / 1450) * 11
    + Math.sin(motionElapsed / 510 + 0.8) * 3.6
  ) * motion.flowStrength * motionScale
  const paths = strands.map((strand) => ({
    strand,
    path: sampleCurtainPath(strand, motion.opening, motionElapsed, ambient, motion.gustStrength, flowShift),
  }))
  const leftBoundary = paths[0]?.path
  const rightBoundary = paths.at(-1)?.path
  const veilPath = leftBoundary && rightBoundary ? curtainVeilPathData(leftBoundary, rightBoundary) : ''
  const sparkles = paths.filter(({ strand }) => strand.id % 4 === 0).flatMap(({ strand, path }) => (
    [0.22, 0.5, 0.78].map((position, positionIndex) => ({
      strand,
      point: pointOnCurtainPath(path, position),
      index: strand.id * 3 + positionIndex,
    }))
  ))
  return (
    <svg className="curtain-layer" viewBox="0 0 390 844" aria-hidden="true" data-layer="curtain">
      <defs>
        <linearGradient id={`${id}-veil`} gradientUnits="userSpaceOnUse" x1="184" y1="116" x2="350" y2="520">
          <stop stopColor="#dce5ff" stopOpacity="0.34" />
          <stop offset="0.5" stopColor="#7087c8" stopOpacity="0.19" />
          <stop offset="1" stopColor="#243565" stopOpacity="0.025" />
        </linearGradient>
        <linearGradient id={`${id}-strand-back`} gradientUnits="userSpaceOnUse" x1="0" y1="110" x2="0" y2="590">
          <stop stopColor="#a7b9f4" stopOpacity="0.46" />
          <stop offset="0.52" stopColor="#657dc9" stopOpacity="0.3" />
          <stop offset="1" stopColor="#3b55aa" stopOpacity="0.025" />
        </linearGradient>
        <linearGradient id={`${id}-strand-main`} gradientUnits="userSpaceOnUse" x1="0" y1="110" x2="0" y2="590">
          <stop stopColor="#ffffff" stopOpacity="0.94" />
          <stop offset="0.18" stopColor="#dce7ff" stopOpacity="0.74" />
          <stop offset="0.58" stopColor="#94ace8" stopOpacity="0.48" />
          <stop offset="1" stopColor="#6079cd" stopOpacity="0.045" />
        </linearGradient>
        <linearGradient id={`${id}-strand-front`} gradientUnits="userSpaceOnUse" x1="0" y1="110" x2="0" y2="590">
          <stop stopColor="#fff9ed" stopOpacity="0.96" />
          <stop offset="0.34" stopColor="#eef2ff" stopOpacity="0.72" />
          <stop offset="0.78" stopColor="#aec3ff" stopOpacity="0.3" />
          <stop offset="1" stopColor="#859de9" stopOpacity="0.02" />
        </linearGradient>
        <filter id={`${id}-strand-back-glow`} x="-45%" y="-18%" width="190%" height="155%">
          <feGaussianBlur stdDeviation="2.1" />
        </filter>
        <filter id={`${id}-strand-glow`} x="-40%" y="-15%" width="180%" height="150%">
          <feGaussianBlur stdDeviation="0.68" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id={`${id}-sparkle-glow`} x="-500%" y="-500%" width="1000%" height="1000%">
          <feGaussianBlur stdDeviation="2.6" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <path
        data-layer="curtain-veil"
        d={veilPath}
        fill={`url(#${id}-veil)`}
        opacity={0.12 + 0.32 * (1 - motion.opening)}
      />
      <line x1="184" y1="116" x2="373" y2="151" stroke="#eff3ff" strokeOpacity={0.2 + sample.totalProgress * 0.49} strokeWidth="2.1" filter={`url(#${id}-strand-glow)`} />
      <g data-curtain-depth="back" filter={`url(#${id}-strand-back-glow)`}>
        {paths.filter(({ strand }) => strand.id % 2 === 1).map(({ strand, path }) => (
          <path
            key={`back-${strand.id}`}
            d={curtainPathData(path)}
            fill="none"
            stroke={`url(#${id}-strand-back)`}
            strokeWidth={1.25 + (strand.id % 5) * 0.13}
            opacity={strand.brightness * (0.28 + motion.opening * 0.2)}
          />
        ))}
      </g>
      <g data-curtain-depth="main" filter={`url(#${id}-strand-glow)`}>
        {paths.map(({ strand, path }) => (
          <path
            key={`main-${strand.id}`}
            d={curtainPathData(path)}
            fill="none"
            stroke={`url(#${id}-strand-main)`}
            strokeWidth={strand.id % 9 === 0 ? 1.06 : 0.42 + (strand.id % 4) * 0.08}
            opacity={strand.brightness * (0.44 + motion.opening * 0.18)}
          />
        ))}
      </g>
      <g data-curtain-depth="front" filter={`url(#${id}-strand-glow)`}>
        {paths.filter(({ strand }) => strand.id % 4 === 0).map(({ strand, path }) => (
          <path
            key={`front-${strand.id}`}
            d={curtainPathData(path)}
            fill="none"
            stroke={`url(#${id}-strand-front)`}
            strokeWidth={1.05 + (strand.id % 3) * 0.22}
            strokeDasharray={strand.id % 8 === 0 ? '16 2 1 4' : undefined}
            opacity={strand.brightness * (0.46 + motion.opening * 0.2)}
          />
        ))}
      </g>
      <g data-layer="curtain-sparkles" opacity={motion.opening * 0.82} filter={`url(#${id}-sparkle-glow)`}>
        {sparkles.map(({ strand, point, index }) => {
          const pulse = 0.55 + Math.sin(motionElapsed / (420 + index * 19) + strand.phase) * 0.38
          return (
            <g key={`sparkle-${index}`} data-curtain-sparkle="true" transform={`translate(${point.x} ${point.y})`} opacity={Math.max(0.12, pulse)}>
              <circle r={0.85 + (index % 3) * 0.24} fill={index % 4 === 0 ? '#fff1c8' : '#f5f7ff'} />
              <path d="M -4 0 L 4 0 M 0 -4 L 0 4" stroke="#f5f8ff" strokeWidth="0.42" />
            </g>
          )
        })}
      </g>
    </svg>
  )
}
