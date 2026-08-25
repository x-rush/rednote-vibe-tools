import type { SetCollectionViewModel } from '../game/catalog.ts'
import { ArtifactMedia } from './ArtifactMedia.tsx'

export function SetCollection({ groups, onOpenArtifact }: { groups: readonly SetCollectionViewModel[]; onOpenArtifact: (id: string) => void }) {
  return (
    <div className="set-collection">
      {groups.map((group, index) => (
        <section key={group.id} className="set-cabinet" aria-labelledby={`set-${group.id}`}>
          <header><div><p>第 {index + 1} 柜 · 已归档 {group.archivedCount} / 4</p><h2 id={`set-${group.id}`}>{group.name}</h2></div><span className={group.complete ? 'mini-seal complete' : 'mini-seal'}>{group.sealLabel}</span></header>
          <p className="set-description">{group.description}</p>
          <ul className="collection-grid">
            {group.artifacts.map(artifact => (
              <li key={artifact.id}>
                <button className="collection-card" type="button" onClick={() => onOpenArtifact(artifact.id)} aria-label={artifact.unlocked ? `打开${artifact.name}档案` : `查看${artifact.name}整理状态`}>
                  {artifact.unlocked
                    ? <ArtifactMedia artifactId={artifact.id} artifactName={artifact.name} role="thumbnail" />
                    : <div className="locked-archive-slot" role="img" aria-label={`${artifact.name}档案尚未解锁`}><span aria-hidden="true" /></div>}
                  <strong>{artifact.unlocked ? artifact.name : '尚未解锁'}</strong>
                  <small>{artifact.unlocked ? `${artifact.bestStars} / 3 星` : artifact.period}</small>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
