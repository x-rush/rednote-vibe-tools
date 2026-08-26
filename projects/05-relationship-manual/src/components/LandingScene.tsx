import type { NpcCue } from '../content/schema'
import { DialoguePanel } from './DialoguePanel'
import { XiaomanStage } from './XiaomanStage'

type LandingSceneProps = {
  cue: NpcCue
  title: string
  eyebrow: string
  lead: string
  privacyTitle: string
  privacyBody: string
  hasDraft: boolean
  draftAnswers: number
  questionCount: number
  onRestore: () => void
  onStart: () => void
}

export function LandingScene({ cue, title, eyebrow, lead, privacyTitle, privacyBody, hasDraft, draftAnswers, questionCount, onRestore, onStart }: LandingSceneProps) {
  const titleLines = title.split('｜')

  return (
    <div className="landing-scene">
      <header className="hero landing-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1 id="landing-title">
          {titleLines.map((line) => <span className="hero__title-line" key={line}>{line}</span>)}
        </h1>
        <p className="hero__lead">{lead}</p>
      </header>

      <div className="landing-character">
        <div className="landing-character__halo" aria-hidden="true" />
        <XiaomanStage pose={cue.pose} mode="hero" name={cue.speaker} roleLabel={cue.roleLabel} />
        <DialoguePanel cue={cue} compact />
      </div>

      <div className="landing-details">
        <div className="privacy-note">
          <span className="privacy-note__number">不做</span>
          <span><strong>{privacyTitle}</strong><p>{privacyBody}</p></span>
        </div>
        {hasDraft && (
          <div className="draft-note paper-note">
            <span className="draft-note__pin" aria-hidden="true" />
            <span><small>上次整理 · 本地草稿</small><strong>这封信已经写下 {draftAnswers} / {questionCount} 个回答。</strong></span>
          </div>
        )}
        <div className="landing-actions">
          {hasDraft && <button className="button button--secondary" type="button" onClick={onRestore}>继续上次整理</button>}
          <button className="button button--primary" type="button" onClick={onStart}>{hasDraft ? '开始一份新的整理' : cue.primaryAction}</button>
        </div>
      </div>
    </div>
  )
}
