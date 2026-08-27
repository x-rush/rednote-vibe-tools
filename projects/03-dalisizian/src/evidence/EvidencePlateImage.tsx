import { useState } from 'react'

export type EvidencePlateImageProps = {
  primarySrc?: string
  fallbackSrc?: string
  fallbackAlt: string
  unavailableLabel?: string
}

export function EvidencePlateImage({ primarySrc, fallbackSrc, fallbackAlt, unavailableLabel }: EvidencePlateImageProps) {
  const initialSrc = primarySrc ?? fallbackSrc
  const [src, setSrc] = useState(initialSrc)
  const [unavailable, setUnavailable] = useState(!initialSrc)

  if (unavailable || !src) {
    return unavailableLabel ? <div className="evidence-artifact-fallback"><b>{unavailableLabel}</b><p>{fallbackAlt}</p></div> : null
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
