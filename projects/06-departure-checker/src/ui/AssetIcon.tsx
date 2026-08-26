import { useState } from 'react'
import { assetPathFor } from './assets'

type AssetIconProps = {
  assetId: string
  label?: string
  className?: string
}

export function AssetIcon({ assetId, label, className = '' }: AssetIconProps) {
  const path = assetPathFor(assetId)
  const [failedPath, setFailedPath] = useState<string>()

  if (!path || failedPath === path) return null

  return (
    <img
      className={className}
      src={path}
      alt={label ?? ''}
      onError={() => setFailedPath(path)}
    />
  )
}
