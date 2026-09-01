import { useId } from 'react'
import { splitMoonlightPolygons, WINDOW_PORTAL, quadPoints } from './geometry'

interface WindowLayerProps { readonly revealProgress: number }

const clamp = (value: number) => Math.min(1, Math.max(0, value))
const smoothstep = (value: number) => value * value * (3 - 2 * value)

const exteriorStars = [
  [232, 190, 0.7], [257, 214, 1.1], [298, 185, 0.65], [327, 224, 1],
  [239, 264, 0.8], [314, 292, 1.25], [270, 327, 0.65], [334, 362, 0.9],
  [244, 390, 1.1], [304, 426, 0.7], [329, 458, 1.2],
] as const

export function WindowLayer({ revealProgress }: WindowLayerProps) {
  const ids = useId().replaceAll(':', '')
  const light = smoothstep(clamp(revealProgress))
  const [nearMoonlight, farMoonlight] = splitMoonlightPolygons(light)

  return (
    <svg
      className="window-layer"
      viewBox="0 0 390 844"
      aria-hidden="true"
      data-window-state="fixed"
      data-interior-light={revealProgress >= 0.65 ? 'bright' : 'dark'}
    >
      <defs>
        <linearGradient id={`${ids}-room`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#020716" />
          <stop offset="0.5" stopColor="#050b24" />
          <stop offset="1" stopColor="#010311" />
        </linearGradient>
        <linearGradient id={`${ids}-floor`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#020717" />
          <stop offset="0.56" stopColor="#081234" />
          <stop offset="1" stopColor="#010314" />
        </linearGradient>
        <radialGradient id={`${ids}-sky`} cx="52%" cy="22%" r="92%">
          <stop stopColor="#8194c8" />
          <stop offset="0.27" stopColor="#303961" />
          <stop offset="0.62" stopColor="#111631" />
          <stop offset="1" stopColor="#020515" />
        </radialGradient>
        <linearGradient id={`${ids}-frame`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#dae4ff" />
          <stop offset="0.3" stopColor="#8fa0dc" />
          <stop offset="0.72" stopColor="#4b5eaa" />
          <stop offset="1" stopColor="#192450" />
        </linearGradient>
        <linearGradient id={`${ids}-beam-near`} x1="1" y1="0" x2="0" y2="1">
          <stop stopColor="#f2f6ff" stopOpacity="0.48" />
          <stop offset="0.42" stopColor="#b6caff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#7892ed" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id={`${ids}-beam-far`} x1="1" y1="0" x2="0" y2="1">
          <stop stopColor="#eef4ff" stopOpacity="0.3" />
          <stop offset="1" stopColor="#768fdf" stopOpacity="0.02" />
        </linearGradient>
        <radialGradient id={`${ids}-moon`} cx="37%" cy="36%" r="70%">
          <stop stopColor="#ffffff" />
          <stop offset="0.52" stopColor="#f5f7ff" />
          <stop offset="1" stopColor="#bdcaf3" />
        </radialGradient>
        <filter id={`${ids}-moon-glow`} x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id={`${ids}-soft`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
        <mask id={`${ids}-crescent`}>
          <rect width="390" height="844" fill="black" />
          <circle cx="279" cy="231" r="30" fill="white" />
          <circle cx="291" cy="219" r="28" fill="black" />
        </mask>
      </defs>

      <rect width="390" height="844" fill={`url(#${ids}-room)`} />
      <path d="M0 604 L390 488 L390 844 L0 844Z" fill={`url(#${ids}-floor)`} />

      <g data-layer="moonlight" opacity={light}>
        <polygon data-layer="moonlight-plane" points={quadPoints(farMoonlight)} fill={`url(#${ids}-beam-far)`} />
        <polygon data-layer="moonlight-plane" points={quadPoints(nearMoonlight)} fill={`url(#${ids}-beam-near)`} />
        <ellipse cx="181" cy="655" rx="162" ry="105" fill="#91aaf5" opacity="0.14" filter={`url(#${ids}-soft)`} />
      </g>

      <polygon points={quadPoints(WINDOW_PORTAL)} fill={`url(#${ids}-sky)`} opacity={0.18 + light * 0.82} />
      <g opacity={0.06 + light * 0.9}>
        {exteriorStars.map(([x, y, radius], index) => (
          <circle key={index} cx={x} cy={y} r={radius} fill="#f5f7ff" opacity={0.54 + (index % 3) * 0.18} />
        ))}
      </g>
      <g data-layer="moon-crescent" opacity={0.14 + light * 0.86} filter={`url(#${ids}-moon-glow)`}>
        <circle cx="279" cy="231" r="31" fill={`url(#${ids}-moon)`} mask={`url(#${ids}-crescent)`} />
        <circle cx="268" cy="244" r="2" fill="#dbe4ff" opacity="0.42" />
      </g>

      <g data-layer="fixed-window-frame" opacity={0.38 + light * 0.56}>
        <polyline points="202,138 360,168 360,505 202,452 202,138" fill="none" stroke={`url(#${ids}-frame)`} strokeWidth="8.5" strokeLinejoin="round" />
        <polyline points="202,138 214,152 348,178 360,168" fill="#d5defa" opacity="0.52" />
        <polyline points="360,168 348,178 348,486 360,505" fill="#14204f" opacity="0.95" />
        <polyline points="202,452 214,438 348,486 360,505" fill="#35477d" opacity="0.82" />
        <line x1="208" y1="286" x2="354" y2="322" stroke="#8999ce" strokeWidth="6.5" />
        <line x1="211" y1="288" x2="351" y2="322" stroke="#d8e1ff" strokeWidth="1.3" opacity="0.52" />
      </g>
    </svg>
  )
}
