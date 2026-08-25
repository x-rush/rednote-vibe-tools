import { useState } from 'react'
import { getBeastAsset } from '../ui/beastAssets'

type Props = {
  code: string
  alt: string
  className?: string
  loading?: 'eager' | 'lazy'
}

export function BeastPortrait({ code, alt, className = '', loading = 'lazy' }: Props) {
  const asset = getBeastAsset(code)
  const [failed, setFailed] = useState(false)
  const classes = ['beast-portrait', failed || !asset ? 'beast-portrait--fallback' : '', className].filter(Boolean).join(' ')

  return (
    <div
      className={classes}
      style={asset?.placeholder ? { backgroundImage: `url(${asset.placeholder})` } : undefined}
    >
      {asset && !failed ? (
        <img
          src={asset.src}
          alt={alt}
          width="900"
          height="1125"
          loading={loading}
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="ink-silhouette" role="img" aria-label={alt}>
          <span className="ink-silhouette__body" />
          <span className="ink-silhouette__mist" />
        </span>
      )}
    </div>
  )
}
