import type { CSSProperties } from 'react'
import { assetUrl, ICON_PATHS } from '../assets/manifest'

export type IconName = keyof typeof ICON_PATHS

export function AssetIcon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <span
      className="asset-icon"
      aria-hidden="true"
      style={{
        '--icon-url': `url(${assetUrl(ICON_PATHS[name])})`,
        '--icon-size': `${size}px`,
      } as CSSProperties}
    />
  )
}
