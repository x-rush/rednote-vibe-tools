import { useId } from 'react'
import { WINDOW_PORTAL, projectSash, quadPoints } from './geometry'

interface WindowLayerProps { readonly openProgress: number; readonly shakeProgress: number }

const exteriorStars = [
  [242, 205, 1.2], [288, 190, 0.8], [324, 232, 1.1], [266, 276, 0.7],
  [314, 319, 1.4], [238, 350, 0.9], [296, 397, 0.8], [332, 444, 1.2],
] as const
const staticStrands = Array.from({ length: 42 }, (_, index) => ({
  x: 190 + index * 4.2, length: 332 + (index % 7) * 7, opacity: 0.22 + (index % 5) * 0.055,
}))

function crossbarPoints(openProgress: number, ratio: number) {
  const sash = projectSash(openProgress)
  const left = { x: sash.topLeft.x + (sash.bottomLeft.x - sash.topLeft.x) * ratio, y: sash.topLeft.y + (sash.bottomLeft.y - sash.topLeft.y) * ratio }
  const right = { x: sash.topRight.x + (sash.bottomRight.x - sash.topRight.x) * ratio, y: sash.topRight.y + (sash.bottomRight.y - sash.topRight.y) * ratio }
  return `${left.x},${left.y} ${right.x},${right.y}`
}

export function WindowLayer({ openProgress, shakeProgress }: WindowLayerProps) {
  const ids = useId().replaceAll(':', '')
  const sash = projectSash(openProgress)
  const shakeX = Math.sin(shakeProgress * Math.PI * 6) * (1 - shakeProgress) * 2.2
  const isOpen = openProgress >= 0.55
  return (
    <svg className="window-layer" viewBox="0 0 390 844" aria-hidden="true" data-window-state={isOpen ? 'open' : 'closed'}>
      <defs>
        <linearGradient id={`${ids}-room`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#041746" /><stop offset="0.48" stopColor="#061c55" /><stop offset="1" stopColor="#02092b" /></linearGradient>
        <radialGradient id={`${ids}-sky`} cx="58%" cy="24%" r="85%"><stop stopColor="#26305b" /><stop offset="0.38" stopColor="#090f2d" /><stop offset="1" stopColor="#010416" /></radialGradient>
        <linearGradient id={`${ids}-frame`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#b6c5ff" /><stop offset="0.26" stopColor="#687af2" /><stop offset="0.7" stopColor="#303bc1" /><stop offset="1" stopColor="#0e176b" /></linearGradient>
        <linearGradient id={`${ids}-beam`} x1="1" y1="0" x2="0" y2="1"><stop stopColor="#d9e7ff" stopOpacity="0.75" /><stop offset="1" stopColor="#728dff" stopOpacity="0" /></linearGradient>
        <linearGradient id={`${ids}-strand`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#f7fbff" stopOpacity="0.9" /><stop offset="0.48" stopColor="#9ebcff" stopOpacity="0.55" /><stop offset="1" stopColor="#496ee8" stopOpacity="0.08" /></linearGradient>
        <filter id={`${ids}-glow`} x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <mask id={`${ids}-crescent`}><rect width="390" height="844" fill="black" /><circle cx="278" cy="235" r="27" fill="white" /><circle cx="289" cy="225" r="25" fill="black" /></mask>
      </defs>
      <rect width="390" height="844" fill={`url(#${ids}-room)`} />
      <path d="M0 610 C110 545 193 548 390 500 L390 844 L0 844Z" fill="#010824" opacity="0.55" />
      <g transform={`translate(${shakeX} 0)`}>
        <polygon points={quadPoints(WINDOW_PORTAL)} fill={`url(#${ids}-sky)`} />
        {exteriorStars.map(([x, y, radius], index) => <circle key={index} cx={x} cy={y} r={radius} fill="#dce8ff" opacity={0.45 + (index % 3) * 0.16} />)}
        <circle cx="278" cy="235" r="28" fill="#f9fbff" mask={`url(#${ids}-crescent)`} filter={`url(#${ids}-glow)`} />
        <polygon points={`348,178 348,486 ${164 - openProgress * 44},655 ${111 - openProgress * 24},604`} fill={`url(#${ids}-beam)`} opacity={0.08 + openProgress * 0.3} />
        <g data-layer="window-frame" filter={`url(#${ids}-glow)`}>
          <polyline points="202,138 360,168 360,505 202,452 202,138" fill="none" stroke={`url(#${ids}-frame)`} strokeWidth="10" />
          <polyline points="202,138 214,152 348,178 360,168" fill="#778cff" opacity="0.38" />
          <polyline points="360,168 348,178 348,486 360,505" fill="#1a257d" opacity="0.9" />
          <line x1="208" y1="286" x2="354" y2="322" stroke="#6678e8" strokeWidth="7" />
        </g>
        <g data-layer="window-sash">
          <polygon points={quadPoints(sash)} fill="#101743" fillOpacity={0.2 + openProgress * 0.18} stroke={`url(#${ids}-frame)`} strokeWidth="7" />
          <polyline points={crossbarPoints(openProgress, 0.48)} stroke="#7d8ff0" strokeWidth="6" />
          <polyline points={crossbarPoints(openProgress, 0.78)} stroke="#596bdc" strokeWidth="5" opacity="0.82" />
          {openProgress > 0.08 && <polyline points={`${sash.topLeft.x},${sash.topLeft.y} ${sash.topLeft.x + 9},${sash.topLeft.y + 4} ${sash.bottomLeft.x + 9},${sash.bottomLeft.y + 5} ${sash.bottomLeft.x},${sash.bottomLeft.y}`} fill="#141c58" stroke="#788af0" strokeWidth="2" />}
        </g>
        <g data-layer="curtain-static">
          <line x1="184" y1="116" x2="373" y2="151" stroke="#e7f0ff" strokeWidth="2" filter={`url(#${ids}-glow)`} />
          {staticStrands.map((strand, index) => {
            const topY = 116 + (strand.x - 184) * 0.185
            return <path key={index} d={`M ${strand.x} ${topY} Q ${strand.x - 1.5} ${topY + strand.length * 0.5} ${strand.x + (index % 4) - 2} ${topY + strand.length}`} fill="none" stroke={`url(#${ids}-strand)`} strokeWidth={index % 8 === 0 ? 1.2 : 0.72} opacity={strand.opacity} />
          })}
        </g>
      </g>
    </svg>
  )
}
