import { useEffect, useRef, useState } from 'react'
import type { RecognitionCardCopy } from '../content/types'
import { getBeastAsset } from '../ui/beastAssets'

type Props = {
  code: string
  copy: RecognitionCardCopy
}

export function BeastRecognitionCard({ code, copy }: Props) {
  const asset = getBeastAsset(code)
  const rootRef = useRef<HTMLElement>(null)
  const [failed, setFailed] = useState(false)
  const [entered, setEntered] = useState(false)
  const showImage = Boolean(asset?.chibiSrc) && !failed

  useEffect(() => {
    const root = rootRef.current
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      || document.documentElement.dataset.reducedMotion === 'true'
    if (!root || reduceMotion || !('IntersectionObserver' in window)) return

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return
      setEntered(true)
      observer.disconnect()
    }, { threshold: 0.2 })
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={rootRef}
      className={`beast-recognition-card${showImage ? '' : ' beast-recognition-card--fallback'}${entered ? ' is-entered' : ''}`}
      aria-label={copy.kicker}
    >
      <div className="beast-recognition-card__figure">
        {showImage
          ? <img src={asset!.chibiSrc} alt={copy.alt} width="768" height="768" loading="lazy" decoding="async" onError={() => setFailed(true)} />
          : <span className="beast-recognition-card__fallback" role="img" aria-label={copy.alt}>兽</span>}
      </div>
      <div className="beast-recognition-card__copy">
        <p className="eyebrow">{copy.kicker}</p>
        <strong>{copy.hook}</strong>
        <p>{copy.blessing}</p>
      </div>
      <span className="beast-recognition-card__seal" aria-hidden="true">{copy.seal}</span>
    </section>
  )
}
