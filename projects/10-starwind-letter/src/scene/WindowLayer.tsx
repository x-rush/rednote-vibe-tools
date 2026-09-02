import { useId } from 'react'
import { projectWindowLightCast, ROOM_FLOOR_EDGE, WINDOW_FRAME, WINDOW_PORTAL, WINDOW_SASH, WINDOW_SASH_FRAME, quadPoints } from './geometry'

interface WindowLayerProps { readonly revealProgress: number }

const clamp = (value: number) => Math.min(1, Math.max(0, value))
const smoothstep = (value: number) => value * value * (3 - 2 * value)

const starDepths = [
  [[225, 177, 0.55], [242, 204, 0.4], [272, 184, 0.48], [301, 213, 0.38], [333, 196, 0.54], [236, 249, 0.38], [286, 272, 0.46], [326, 254, 0.35], [251, 306, 0.52], [312, 338, 0.42], [232, 377, 0.38], [287, 404, 0.45], [329, 433, 0.36], [251, 421, 0.3]],
  [[232, 190, 0.82], [259, 226, 0.72], [296, 193, 0.66], [326, 230, 0.88], [237, 281, 0.7], [276, 301, 0.58], [320, 291, 0.9], [250, 346, 0.6], [300, 371, 0.78], [337, 356, 0.62], [235, 408, 0.86], [275, 435, 0.62], [321, 454, 0.78]],
  [[249, 181, 1.25], [317, 205, 1.1], [227, 230, 1.05], [302, 250, 1.35], [339, 281, 0.92], [242, 322, 1.18], [323, 331, 1.42], [274, 385, 1.08], [335, 402, 1.2], [250, 449, 1.34], [307, 463, 0.96]],
] as const

const floorDust = [[70, 730, 1.4], [104, 692, 0.8], [153, 676, 1.2], [207, 650, 0.7], [266, 625, 1], [310, 602, 0.65], [43, 783, 0.7], [188, 746, 0.55], [113, 767, 0.52], [238, 697, 0.66], [286, 741, 0.48], [53, 807, 0.58], [329, 667, 0.45], [159, 791, 0.62]] as const

const tyndallMotes = Array.from({ length: 46 }, (_, index) => {
  const depth = ((index * 37) % 97) / 96
  const drift = ((index * 19) % 23) - 11
  return {
    x: 307 - depth * 194 + drift,
    y: 263 + depth * 438 + (index % 5) * 7,
    radius: 0.28 + (index % 4) * 0.12,
    opacity: 0.2 + (index % 6) * 0.08,
  }
})

function starPath(x: number, y: number, radius: number) {
  return `M ${x} ${y - radius * 2.5} L ${x + radius * 0.42} ${y - radius * 0.42} L ${x + radius * 2.5} ${y} L ${x + radius * 0.42} ${y + radius * 0.42} L ${x} ${y + radius * 2.5} L ${x - radius * 0.42} ${y + radius * 0.42} L ${x - radius * 2.5} ${y} L ${x - radius * 0.42} ${y - radius * 0.42} Z`
}

export function WindowLayer({ revealProgress }: WindowLayerProps) {
  const ids = useId().replaceAll(':', '')
  const light = smoothstep(clamp(revealProgress))
  const cast = projectWindowLightCast(light)
  const frameOutline = `${quadPoints(WINDOW_FRAME)} ${WINDOW_FRAME.topLeft.x},${WINDOW_FRAME.topLeft.y}`
  const topFrameFace = {
    topLeft: WINDOW_FRAME.topLeft, topRight: WINDOW_FRAME.topRight,
    bottomRight: WINDOW_PORTAL.topRight, bottomLeft: WINDOW_PORTAL.topLeft,
  }
  const rightFrameFace = {
    topLeft: WINDOW_PORTAL.topRight, topRight: WINDOW_FRAME.topRight,
    bottomRight: WINDOW_FRAME.bottomRight, bottomLeft: WINDOW_PORTAL.bottomRight,
  }
  const bottomFrameFace = {
    topLeft: WINDOW_PORTAL.bottomLeft, topRight: WINDOW_PORTAL.bottomRight,
    bottomRight: WINDOW_FRAME.bottomRight, bottomLeft: WINDOW_FRAME.bottomLeft,
  }

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
          <stop stopColor="#030713" />
          <stop offset="0.48" stopColor="#070c24" />
          <stop offset="1" stopColor="#01030d" />
        </linearGradient>
        <linearGradient id={`${ids}-floor`} x1="0.9" y1="0" x2="0.1" y2="1">
          <stop stopColor="#0b1333" />
          <stop offset="0.48" stopColor="#070d27" />
          <stop offset="1" stopColor="#020412" />
        </linearGradient>
        <radialGradient id={`${ids}-sky`} cx="45%" cy="22%" r="94%">
          <stop stopColor="#171b2a" />
          <stop offset="0.26" stopColor="#0a0d18" />
          <stop offset="0.58" stopColor="#040610" />
          <stop offset="1" stopColor="#010207" />
        </radialGradient>
        <radialGradient id={`${ids}-mist`} cx="50%" cy="42%" r="58%">
          <stop stopColor="#b9caff" stopOpacity="0.13" />
          <stop offset="0.52" stopColor="#657bc2" stopOpacity="0.035" />
          <stop offset="1" stopColor="#344b9c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${ids}-frame`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#f2f4ff" />
          <stop offset="0.18" stopColor="#aebde9" />
          <stop offset="0.6" stopColor="#58699f" />
          <stop offset="1" stopColor="#1f2a55" />
        </linearGradient>
        <linearGradient id={`${ids}-beam-upper`} x1="0.78" y1="0" x2="0.16" y2="1">
          <stop stopColor="#fbfdff" stopOpacity="0.5" />
          <stop offset="0.38" stopColor="#c9d8ff" stopOpacity="0.23" />
          <stop offset="1" stopColor="#7898f0" stopOpacity="0.018" />
        </linearGradient>
        <linearGradient id={`${ids}-beam-lower`} x1="0.84" y1="0" x2="0.06" y2="1">
          <stop stopColor="#f8fbff" stopOpacity="0.43" />
          <stop offset="0.42" stopColor="#b8cbff" stopOpacity="0.2" />
          <stop offset="1" stopColor="#6d87dc" stopOpacity="0.015" />
        </linearGradient>
        <linearGradient id={`${ids}-floor-glow`} x1="0.76" y1="0" x2="0.12" y2="1">
          <stop stopColor="#f3f7ff" stopOpacity="0.38" />
          <stop offset="0.5" stopColor="#b9ccff" stopOpacity="0.25" />
          <stop offset="1" stopColor="#778fd8" stopOpacity="0.1" />
        </linearGradient>
        <radialGradient id={`${ids}-moon`} cx="34%" cy="30%" r="72%">
          <stop stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#f5f5ff" />
          <stop offset="0.8" stopColor="#d8e0ff" />
          <stop offset="1" stopColor="#9faddd" />
        </radialGradient>
        <filter id={`${ids}-moon-soft`} x="-220%" y="-220%" width="540%" height="540%"><feGaussianBlur stdDeviation="16" /></filter>
        <filter id={`${ids}-moon-aura`} x="-180%" y="-180%" width="460%" height="460%"><feGaussianBlur stdDeviation="7" /></filter>
        <filter id={`${ids}-star-glow`} x="-300%" y="-300%" width="700%" height="700%">
          <feGaussianBlur stdDeviation="1.7" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id={`${ids}-beam-soft`} x="-25%" y="-20%" width="150%" height="150%"><feGaussianBlur stdDeviation="2.4" /></filter>
        <filter id={`${ids}-floor-soft`} x="-15%" y="-18%" width="130%" height="140%"><feGaussianBlur stdDeviation="2.6" /></filter>
        <filter id={`${ids}-ambient-soft`} x="-35%" y="-50%" width="170%" height="200%"><feGaussianBlur stdDeviation="22" /></filter>
        <mask id={`${ids}-crescent`}>
          <rect width="390" height="844" fill="black" />
          <circle cx="281" cy="230" r="29" fill="white" />
          <circle cx="292" cy="219" r="27" fill="black" />
        </mask>
        <clipPath id={`${ids}-portal`}><polygon points={quadPoints(WINDOW_PORTAL)} /></clipPath>
      </defs>

      <rect width="390" height="844" fill={`url(#${ids}-room)`} />
      <path d={`M0 ${ROOM_FLOOR_EDGE.left.y} L390 ${ROOM_FLOOR_EDGE.right.y} L390 844 L0 844Z`} fill={`url(#${ids}-floor)`} />
      <ellipse cx="190" cy="682" rx="190" ry="118" fill="#718bd8" opacity={light * 0.055} filter={`url(#${ids}-ambient-soft)`} />

      <g data-layer="volumetric-moonlight" opacity={light} filter={`url(#${ids}-beam-soft)`} style={{ mixBlendMode: 'screen' }}>
        {cast.airBeams.map((beam, index) => (
          <polygon key={`beam-${index}`} data-layer="tyndall-beam" points={quadPoints(beam)} fill={`url(#${ids}-${index === 0 ? 'beam-upper' : 'beam-lower'})`} />
        ))}
      </g>
      <g data-layer="tyndall-dust" opacity={light * 0.84} filter={`url(#${ids}-star-glow)`}>
        {tyndallMotes.map((mote, index) => (
          <circle key={index} className="beam-mote" cx={mote.x} cy={mote.y} r={mote.radius} fill="#e7efff" opacity={mote.opacity} style={{ animationDelay: `${-index * 0.19}s` }} />
        ))}
      </g>
      <g data-layer="floor-window-projection" opacity={light * 0.9}>
        <g filter={`url(#${ids}-floor-soft)`} style={{ mixBlendMode: 'screen' }}>
          {cast.floorPanes.map((pane, index) => (
            <polygon key={`floor-pane-${index}`} data-layer="floor-window-pane" points={quadPoints(pane)} fill={`url(#${ids}-floor-glow)`} opacity={index === 0 ? 0.9 : 0.78} />
          ))}
        </g>
        {cast.frameShadows.map((shadow, index) => (
          <polygon key={`frame-shadow-${index}`} data-layer="projected-window-frame-shadow" points={quadPoints(shadow)} fill="#02050f" opacity="0.46" />
        ))}
        <polygon data-layer="projected-sash-shadow" points={quadPoints(cast.sashShadow)} fill="#02050f" opacity="0.52" />
      </g>

      <g clipPath={`url(#${ids}-portal)`} opacity={light}>
        <polygon data-sky-tone="near-black" points={quadPoints(WINDOW_PORTAL)} fill={`url(#${ids}-sky)`} />
        <ellipse data-layer="star-mist" cx="287" cy="296" rx="94" ry="205" fill={`url(#${ids}-mist)`} />
        {starDepths.map((stars, depth) => (
          <g key={depth} data-layer="starfield-depth" opacity={0.42 + depth * 0.23} filter={depth === 2 ? `url(#${ids}-star-glow)` : undefined}>
            {stars.map(([x, y, radius], index) => depth === 2
              ? <path key={index} className="sky-star sky-star--bright" d={starPath(x, y, radius)} fill={index % 4 === 0 ? '#fff0c7' : '#f7f8ff'} style={{ animationDelay: `${-(index * 0.41 + depth)}s` }} />
              : <circle key={index} className="sky-star" cx={x} cy={y} r={radius} fill={depth === 0 ? '#a8bcfa' : '#e4ebff'} style={{ animationDelay: `${-(index * 0.53 + depth)}s` }} />
            )}
          </g>
        ))}

        <circle data-layer="moon-halo" cx="281" cy="230" r="58" fill="#7f9fff" opacity="0.14" filter={`url(#${ids}-moon-soft)`} />
        <circle data-layer="moon-halo" cx="281" cy="230" r="42" fill="#bdccff" opacity="0.2" filter={`url(#${ids}-moon-aura)`} />
        <circle data-layer="moon-halo" cx="281" cy="230" r="33" fill="#f0f3ff" opacity="0.075" filter={`url(#${ids}-moon-aura)`} />
        <g data-layer="moon-crescent" mask={`url(#${ids}-crescent)`} filter={`url(#${ids}-star-glow)`}>
          <circle cx="281" cy="230" r="29" fill={`url(#${ids}-moon)`} />
          <circle cx="266" cy="242" r="3.3" fill="#aebce4" opacity="0.25" />
          <circle cx="271" cy="214" r="2" fill="#c4ceec" opacity="0.32" />
          <circle cx="283" cy="250" r="4.6" fill="#bac4e3" opacity="0.16" />
          <path d="M257 244 Q267 256 282 258" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.48" />
        </g>
      </g>

      <g data-layer="fixed-window-frame" opacity={0.24 + light * 0.74}>
        <polyline points={frameOutline} fill="none" stroke="#172044" strokeWidth="14" strokeLinejoin="round" />
        <polyline points={frameOutline} fill="none" stroke={`url(#${ids}-frame)`} strokeWidth="8.5" strokeLinejoin="round" />
        <polygon points={quadPoints(topFrameFace)} fill="#e8edff" opacity="0.56" />
        <polygon points={quadPoints(rightFrameFace)} fill="#17244e" opacity="0.96" />
        <polygon points={quadPoints(bottomFrameFace)} fill="#354878" opacity="0.86" />
        <line x1={WINDOW_SASH_FRAME.left.x} y1={WINDOW_SASH_FRAME.left.y} x2={WINDOW_SASH_FRAME.right.x} y2={WINDOW_SASH_FRAME.right.y} stroke="#344471" strokeWidth="10" />
        <line x1={WINDOW_SASH.left.x} y1={WINDOW_SASH.left.y} x2={WINDOW_SASH.right.x} y2={WINDOW_SASH.right.y} stroke="#97a6d2" strokeWidth="6" />
        <line x1={WINDOW_SASH.left.x} y1={WINDOW_SASH.left.y} x2={WINDOW_SASH.right.x} y2={WINDOW_SASH.right.y} stroke="#edf2ff" strokeWidth="1.2" opacity="0.6" />
        <line x1={WINDOW_FRAME.topLeft.x} y1={WINDOW_FRAME.topLeft.y} x2={WINDOW_FRAME.topRight.x} y2={WINDOW_FRAME.topRight.y} stroke="#ffffff" strokeWidth="1.1" opacity="0.5" />
      </g>

      <g data-layer="floor-moon-dust" opacity={light * 0.72} filter={`url(#${ids}-star-glow)`}>
        {floorDust.map(([x, y, radius], index) => (
          <path key={index} className="floor-star" d={starPath(x, y, radius)} fill={index % 3 === 0 ? '#ffeec1' : '#dfe9ff'} style={{ animationDelay: `${-index * 0.47}s` }} />
        ))}
      </g>
    </svg>
  )
}
