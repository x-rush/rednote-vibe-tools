import { useState } from 'react'

export type EvidencePlateImageProps = {
  primarySrc?: string
  fallbackSrc?: string
  fallbackAlt: string
}

export function EvidencePlateImage({ primarySrc, fallbackSrc, fallbackAlt }: EvidencePlateImageProps) {
  const initialSrc = primarySrc ?? fallbackSrc
  const [src, setSrc] = useState(initialSrc)
  const [unavailable, setUnavailable] = useState(!initialSrc)

  if (unavailable || !src) {
    return <div className="evidence-artifact-fallback"><b>图版暂缺</b><p>{fallbackAlt}</p></div>
  }

  return <img
    src={src}
    data-fallback-src={fallbackSrc}
    alt=""
    decoding="async"
    onError={() => {
      if (fallbackSrc && src !== fallbackSrc) {
        setSrc(fallbackSrc)
        return
      }
      setUnavailable(true)
    }}
  />
}
