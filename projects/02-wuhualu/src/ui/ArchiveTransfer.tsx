import type { Artifact, ArtifactSetDefinition } from '../content/types.ts'
import { ArtifactMedia } from './ArtifactMedia.tsx'
import { GuidePresence } from './GuidePresence.tsx'

type ArchiveTransferProps = {
  artifact: Artifact
  set: ArtifactSetDefinition
  position: number
  related: { artifactId: string; name: string; reason: string }[]
  guideLine: string | null
  onNext: () => void
  relatedTitle: string
  nextAction: string
  guide: { name: string; role: string; askAction: string }
}

export function ArchiveTransfer({ artifact, set, position, related, guideLine, onNext, relatedTitle, nextAction, guide }: ArchiveTransferProps) {
  return (
    <section className="archive-transfer" aria-labelledby="archive-title">
      <div className="archive-label-card">
        <ArtifactMedia artifactId={artifact.id} artifactName={artifact.name} role="thumbnail" />
        <div><p>{set.name} · {position} / 4</p><h1 id="archive-title">{artifact.name}</h1><span>{set.sealLabel}</span></div>
      </div>
      <p className="archive-copy">{artifact.unlockCopy}</p>
      {guideLine && <GuidePresence line={guideLine} guideName={guide.name} guideRole={guide.role} askLabel={guide.askAction} />}
      {related.length > 0 && <section className="related-list"><h2>{relatedTitle}</h2>{related.map(item => <article key={item.artifactId}><strong>{item.name}</strong><p>{item.reason}</p></article>)}</section>}
      <button className="primary-button" type="button" onClick={onNext}>{nextAction}</button>
    </section>
  )
}
