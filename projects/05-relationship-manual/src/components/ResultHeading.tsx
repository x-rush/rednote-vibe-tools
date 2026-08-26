import type { NpcCue } from '../content/schema'
import { XiaomanStage } from './XiaomanStage'

type ResultHeadingProps = {
  eyebrow: string
  title: string
  body: string
  cue: NpcCue | null
}

export function ResultHeading({ eyebrow, title, body, cue }: ResultHeadingProps) {
  return (
    <header className="page-header result-heading">
      <div className="result-heading__copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1 id="result-title">{title}</h1>
        <p className="supporting-copy">{body}</p>
      </div>
      {cue && (
        <div className="result-heading__companion">
          <XiaomanStage pose={cue.pose} mode="avatar" name={cue.speaker} roleLabel={cue.roleLabel} />
          <p><strong>{cue.speaker}</strong><small>{cue.roleLabel}</small><span>{cue.text}</span></p>
        </div>
      )}
    </header>
  )
}
