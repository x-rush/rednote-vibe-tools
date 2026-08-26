import { useState } from 'react'
import { getNpcAsset } from '../app/npc'
import type { NpcPose } from '../content/schema'

type XiaomanStageProps = {
  pose: NpcPose
  mode: 'hero' | 'stage' | 'avatar'
  name: string
  roleLabel: string
}

export function XiaomanStage({ pose, mode, name, roleLabel }: XiaomanStageProps) {
  const [failed, setFailed] = useState(false)

  return (
    <figure className={`xiaoman-stage xiaoman-stage--${mode}`} aria-label={`${name}，${roleLabel}`}>
      <div className="xiaoman-stage__portrait">
        {!failed && <img className="xiaoman-stage__image" src={getNpcAsset(pose)} alt={`${name}的${pose === 'daily' ? '日常陪伴' : pose === 'listening' ? '专注倾听' : '温和提醒'}立绘`} onError={() => setFailed(true)} />}
        {failed && <span className="xiaoman-stage__fallback" aria-hidden="true">满</span>}
      </div>
      <figcaption><strong>{name}</strong><span>{roleLabel}</span></figcaption>
    </figure>
  )
}
