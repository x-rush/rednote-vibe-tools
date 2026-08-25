import { useState } from 'react'
import { getRuntimeArtifactAssets, selectClueAsset } from './artifact-assets.ts'

type ArtifactMediaRole = 'clue' | 'reveal' | 'thumbnail' | 'silhouette'

type ArtifactMediaProps = {
  artifactId: string
  artifactName: string
  role: ArtifactMediaRole
  revealedClueCount?: number
  eager?: boolean
  showNature?: boolean
  className?: string
}

function roleSource(role: ArtifactMediaRole, artifactId: string, revealedClueCount: number): string | undefined {
  const assets = getRuntimeArtifactAssets(artifactId)
  if (!assets) return undefined
  if (role === 'clue') return selectClueAsset(artifactId, revealedClueCount)
  if (role === 'thumbnail') return assets.thumbnail
  if (role === 'silhouette') return assets.silhouette
  return assets.reveal
}

export function ArtifactMedia({
  artifactId,
  artifactName,
  role,
  revealedClueCount = 1,
  eager = false,
  showNature = false,
  className = '',
}: ArtifactMediaProps) {
  const assets = getRuntimeArtifactAssets(artifactId)
  const primary = roleSource(role, artifactId, revealedClueCount)
  const [mediaState, setMediaState] = useState<{ key: string | undefined; source: string | undefined; failed: boolean }>(() => ({ key: primary, source: primary, failed: false }))
  const source = mediaState.key === primary ? mediaState.source : primary
  const failed = mediaState.key === primary ? mediaState.failed : false

  const handleError = () => {
    if (assets && source !== assets.silhouette) {
      setMediaState({ key: primary, source: assets.silhouette, failed: false })
      return
    }
    setMediaState({ key: primary, source: undefined, failed: true })
  }

  const alt = role === 'clue' ? '当前藏品的局部观察线索，不包含答案文字' : `${artifactName}的艺术化文物图像`

  return (
    <figure className={`artifact-media artifact-media--${role} ${className}`.trim()}>
      {source && assets && !failed
        ? <img src={source} alt={alt} width={assets.width} height={assets.height} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={handleError} />
        : <div className="artifact-media__fallback" role="img" aria-label={`${artifactName}图像暂不可用`}><span aria-hidden="true" /><p>图像暂不可用，请根据文字线索继续判断</p></div>}
      {showNature && assets && <figcaption><span>图像性质</span><strong>{assets.nature}</strong><small>用于互动辨识，不替代馆藏实物照片</small></figcaption>}
    </figure>
  )
}
