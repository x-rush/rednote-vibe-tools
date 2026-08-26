import type { NpcCue, RelationshipChapter } from '../content/schema'
import { DialoguePanel } from './DialoguePanel'
import { XiaomanStage } from './XiaomanStage'

type ChapterIntroProps = {
  chapter: RelationshipChapter
  cue: NpcCue
  contextLead: string
  completedQuestionCount: number
  onContinue: () => void
  onSkip: () => void
}

export function ChapterIntro({ chapter, cue, contextLead, completedQuestionCount, onContinue, onSkip }: ChapterIntroProps) {
  return (
    <section className="page page--chapter-intro" aria-labelledby="chapter-title">
      <div className="chapter-folder">
        <span className="chapter-folder__tab">FILE {chapter.folderLabel}</span>
        <p className="eyebrow">深夜信笺编辑部 · 第 {chapter.folderLabel} 章</p>
        <h1 id="chapter-title">{chapter.title}</h1>
        <p className="chapter-folder__lead">{contextLead}</p>
        <span className="chapter-folder__count">已整理 {completedQuestionCount} / 21</span>
      </div>
      <div className="chapter-stage">
        <XiaomanStage pose={cue.pose} mode="stage" name={cue.speaker} roleLabel={cue.roleLabel} />
        <DialoguePanel cue={cue} onPrimary={onContinue} onSecondary={onSkip} />
      </div>
    </section>
  )
}
