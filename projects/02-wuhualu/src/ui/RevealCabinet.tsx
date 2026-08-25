import type { Artifact, GuessResult } from '../content/types.ts'
import { ArtifactMedia } from './ArtifactMedia.tsx'

export function RevealCabinet({ artifact, result }: { artifact: Artifact; result: GuessResult }) {
  return (
    <section className="reveal-cabinet" aria-labelledby="reveal-title">
      <div className="cabinet-light" aria-hidden="true" />
      <p className="section-label" aria-live="polite">{result.correct ? result.feedback : artifact.wrongAnswerExplanation}</p>
      <h1 id="reveal-title">{artifact.name}</h1>
      <div className="star-result" aria-label={`${result.stars} / 3 星`}>{'★'.repeat(result.stars)}{'☆'.repeat(3 - result.stars)}</div>
      <ArtifactMedia artifactId={artifact.id} artifactName={artifact.name} role="reveal" eager showNature />
      <div className="evidence-strip"><span>识别证据</span><p>{artifact.highlight}</p></div>
    </section>
  )
}
