import { useId } from 'react'
import { WINDOW_PORTAL, projectSash, quadPoints } from './geometry'

interface WindowLayerProps { readonly openProgress: number; readonly shakeProgress: number }

const clamp = (value: number) => Math.min(1, Math.max(0, value))
const smoothstep = (value: number) => {
  const amount = clamp(value)
  return amount * amount * (3 - 2 * amount)
}

const exteriorStars = [
  [242, 205, 1.2], [288, 190, 0.8], [324, 232, 1.1], [266, 276, 0.7],
  [314, 319, 1.4], [238, 350, 0.9], [296, 397, 0.8], [332, 444, 1.2],
] as const
function crossbarPoints(openProgress: number, ratio: number) {
  const sash = projectSash(openProgress)
  const left = { x: sash.topLeft.x + (sash.bottomLeft.x - sash.topLeft.x) * ratio, y: sash.topLeft.y + (sash.bottomLeft.y - sash.topLeft.y) * ratio }
  const right = { x: sash.topRight.x + (sash.bottomRight.x - sash.topRight.x) * ratio, y: sash.topRight.y + (sash.bottomRight.y - sash.topRight.y) * ratio }
  return `${left.x},${left.y} ${right.x},${right.y}`
}

function sashSlicePoints(openProgress: number, upperRatio: number, lowerRatio: number) {
  const sash = projectSash(openProgress)
  const pointAt = (from: typeof sash.topLeft, to: typeof sash.bottomLeft, ratio: number) => ({
    x: from.x + (to.x - from.x) * ratio,
    y: from.y + (to.y - from.y) * ratio,
  })
  const upperLeft = pointAt(sash.topLeft, sash.bottomLeft, upperRatio)
  const upperRight = pointAt(sash.topRight, sash.bottomRight, upperRatio)
  const lowerRight = pointAt(sash.topRight, sash.bottomRight, lowerRatio)
  const lowerLeft = pointAt(sash.topLeft, sash.bottomLeft, lowerRatio)
  return `${upperLeft.x},${upperLeft.y} ${upperRight.x},${upperRight.y} ${lowerRight.x},${lowerRight.y} ${lowerLeft.x},${lowerLeft.y}`
}

export function WindowLayer({ openProgress, shakeProgress }: WindowLayerProps) {
  const ids = useId().replaceAll(':', '')
  const sash = projectSash(openProgress)
  const light = smoothstep(openProgress)
  const shakeX = Math.sin(shakeProgress * Math.PI * 6) * (1 - shakeProgress) * 2.2
  const isOpen = openProgress >= 0.55
  return (
    <svg
      className="window-layer"
      viewBox="0 0 390 844"
      aria-hidden="true"
      data-window-state={isOpen ? 'open' : 'closed'}
      data-interior-light={openProgress >= 0.65 ? 'bright' : 'dark'}
    >
      <defs>
        <linearGradient id={`${ids}-room`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#02091d" /><stop offset="0.48" stopColor="#030b24" /><stop offset="1" stopColor="#010416" /></linearGradient>
        <linearGradient id={`${ids}-floor`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#020718" /><stop offset="0.56" stopColor="#050d2b" /><stop offset="1" stopColor="#010315" /></linearGradient>
        <radialGradient id={`${ids}-sky`} cx="55%" cy="24%" r="92%"><stop stopColor="#53638c" /><stop offset="0.32" stopColor="#171d3d" /><stop offset="1" stopColor="#010413" /></radialGradient>
        <linearGradient id={`${ids}-glass`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#111834" /><stop offset="0.55" stopColor="#05091a" /><stop offset="1" stopColor="#0c1638" /></linearGradient>
        <linearGradient id={`${ids}-sash-glass`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#a9bae5" stopOpacity="0.32" /><stop offset="0.34" stopColor="#435783" stopOpacity="0.2" /><stop offset="0.62" stopColor="#111a38" stopOpacity="0.36" /><stop offset="1" stopColor="#304574" stopOpacity="0.22" /></linearGradient>
        <linearGradient id={`${ids}-frame`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d9e4ff" /><stop offset="0.3" stopColor="#8293df" /><stop offset="0.72" stopColor="#4654af" /><stop offset="1" stopColor="#17205e" /></linearGradient>
        <linearGradient id={`${ids}-beam`} x1="1" y1="0" x2="0" y2="1"><stop stopColor="#eff6ff" stopOpacity="0.86" /><stop offset="0.42" stopColor="#a8c1ff" stopOpacity="0.34" /><stop offset="1" stopColor="#5d79e8" stopOpacity="0" /></linearGradient>
        <radialGradient id={`${ids}-floor-light`} cx="58%" cy="12%" r="88%"><stop stopColor="#a7c0ff" stopOpacity="0.56" /><stop offset="0.52" stopColor="#4968c9" stopOpacity="0.16" /><stop offset="1" stopColor="#14235f" stopOpacity="0" /></radialGradient>
        <filter id={`${ids}-glow`} x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="2.6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <filter id={`${ids}-bloom`} x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="13" /></filter>
        <mask id={`${ids}-crescent`}><rect width="390" height="844" fill="black" /><circle cx="278" cy="235" r="27" fill="white" /><circle cx="289" cy="225" r="25" fill="black" /></mask>
      </defs>
      <rect width="390" height="844" fill={`url(#${ids}-room)`} />
      <path d="M0 604 L390 488 L390 844 L0 844Z" fill={`url(#${ids}-floor)`} />
      <g data-layer="interior-light" opacity={light}>
        <polygon points="348,180 348,486 48,750 0,660" fill={`url(#${ids}-beam)`} opacity="0.76" />
        <ellipse cx="174" cy="638" rx="170" ry="116" fill="#7897f2" opacity="0.27" filter={`url(#${ids}-bloom)`} />
        <path d="M0 604 L348 486 L390 550 L390 844 L0 844Z" fill={`url(#${ids}-floor-light)`} opacity="0.86" />
      </g>
      <g transform={`translate(${shakeX} 0)`}>
        <polygon points={quadPoints(WINDOW_PORTAL)} fill={`url(#${ids}-sky)`} opacity={0.28 + light * 0.72} />
        {exteriorStars.map(([x, y, radius], index) => <circle key={index} cx={x} cy={y} r={radius} fill="#eaf1ff" opacity={(0.08 + (index % 3) * 0.04) + light * 0.7} />)}
        <circle cx="278" cy="235" r="28" fill="#fbfdff" opacity={0.36 + light * 0.64} mask={`url(#${ids}-crescent)`} filter={light > 0.1 ? `url(#${ids}-glow)` : undefined} />
        <polygon points={quadPoints(WINDOW_PORTAL)} fill={`url(#${ids}-glass)`} opacity={(1 - light) * 0.64} />
        <g opacity={(1 - light) * 0.2}>
          <line x1="231" y1="157" x2="231" y2="444" stroke="#8da3d8" />
          <line x1="260" y1="163" x2="260" y2="454" stroke="#758abb" />
          <line x1="321" y1="173" x2="321" y2="476" stroke="#8298cf" />
        </g>
        <g data-layer="window-frame" filter={light > 0.24 ? `url(#${ids}-glow)` : undefined} opacity={0.56 + light * 0.34}>
          <polyline points="202,138 360,168 360,505 202,452 202,138" fill="none" stroke={`url(#${ids}-frame)`} strokeWidth="8.5" strokeLinejoin="round" />
          <polyline points="202,138 214,152 348,178 360,168" fill="#c3d0fb" opacity="0.48" />
          <polyline points="360,168 348,178 348,486 360,505" fill="#111b57" opacity="0.94" />
          <polyline points="202,452 214,438 348,486 360,505" fill="#263577" opacity="0.78" />
          <line x1="208" y1="286" x2="354" y2="322" stroke="#7789d3" strokeWidth="5.5" />
        </g>
        {openProgress > 0.04 && <polygon points={`${sash.topLeft.x + 8},${sash.topLeft.y + 13} ${sash.topRight.x + 5},${sash.topRight.y + 8} ${sash.bottomRight.x + 6},${sash.bottomRight.y + 12} ${sash.bottomLeft.x + 9},${sash.bottomLeft.y + 16}`} fill="#00020d" opacity={light * 0.48} filter={`url(#${ids}-bloom)`} />}
        <g data-layer="window-sash" filter={light > 0.28 ? `url(#${ids}-glow)` : undefined}>
          <polygon points={quadPoints(sash)} fill={`url(#${ids}-sash-glass)`} fillOpacity={0.58 - light * 0.1} stroke={`url(#${ids}-frame)`} strokeWidth={5.6 - light * 1.25} strokeLinejoin="round" />
          <polygon points={sashSlicePoints(openProgress, 0.14, 0.22)} fill="#eef4ff" opacity={0.025 + light * 0.07} />
          <polyline points={crossbarPoints(openProgress, 0.48)} stroke="#8998d5" strokeWidth={5.2 - light * 0.8} />
          <polyline points={crossbarPoints(openProgress, 0.78)} stroke="#5f70b8" strokeWidth={4.4 - light * 0.6} opacity="0.76" />
          {openProgress > 0.08 && <polyline points={`${sash.topLeft.x},${sash.topLeft.y} ${sash.topLeft.x + 8},${sash.topLeft.y + 5} ${sash.bottomLeft.x + 9},${sash.bottomLeft.y + 8} ${sash.bottomLeft.x},${sash.bottomLeft.y}`} fill="#111942" stroke="#a4b3eb" strokeWidth="2" opacity="0.88" />}
          {openProgress > 0.16 && <circle cx={sash.topLeft.x + (sash.bottomLeft.x - sash.topLeft.x) * 0.56 + 6} cy={sash.topLeft.y + (sash.bottomLeft.y - sash.topLeft.y) * 0.56} r="3.2" fill="#dce6ff" opacity={0.35 + light * 0.36} />}
        </g>
        {openProgress > 0.08 && <g fill="#c8d5ff" opacity={0.44 + light * 0.5}><circle cx="349" cy="241" r="2.5" /><circle cx="349" cy="416" r="2.5" /></g>}
      </g>
    </svg>
  )
}
