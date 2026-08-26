import type { NpcCue, RelationshipQuestion } from '../content/schema'
import type { TopicArtwork } from '../app/presentation'
import { XiaomanStage } from './XiaomanStage'

type QuestionSheetProps = {
  question: RelationshipQuestion
  selectedIds: string[]
  activeTopic: TopicArtwork
  topicIndex: number
  questionIndex: number
  questionCount: number
  npcCue?: NpcCue | null
  showNpcMessage?: boolean
  onSelect: (optionId: string) => void
}

export function QuestionSheet({ question, selectedIds, activeTopic, topicIndex, questionIndex, questionCount, npcCue, showNpcMessage = false, onSelect }: QuestionSheetProps) {
  const selectionHint = question.multiple
    ? `可以选择 ${question.selectionLimit.min}–${question.selectionLimit.max} 项；每种需要都值得认真对待。`
    : '请选择此刻最贴近你的一项；每种表达都值得尊重。'

  return (
    <article className="question-sheet paper-sheet">
      <header className="question-sheet__header">
        <div className="topic-heading">
          <span className="topic-heading__icon"><img src={activeTopic.iconUrl} alt="" /></span>
          <span><small>主题 {topicIndex + 1} / 7</small><strong>{activeTopic.description}</strong></span>
          {npcCue && !showNpcMessage && <span className="question-sheet__npc question-sheet__npc--quiet"><XiaomanStage pose={npcCue.pose} mode="avatar" name={npcCue.speaker} roleLabel={npcCue.roleLabel} /></span>}
        </div>
        <span className="question-count">{String(questionIndex + 1).padStart(2, '0')} / {questionCount}</span>
        {npcCue && showNpcMessage && (
          <div className="question-sheet__npc question-sheet__npc-message">
            <XiaomanStage pose={npcCue.pose} mode="avatar" name={npcCue.speaker} roleLabel={npcCue.roleLabel} />
            <p>{npcCue.text}</p>
          </div>
        )}
      </header>
      <progress max={questionCount} value={questionIndex + 1} aria-label="问卷进度" />
      <div className="question-sheet__body">
        <p className="margin-note">没有标准答案<br />选最贴近当下的一项</p>
        <p className="question-sheet__scene">{question.sceneLead}</p>
        <h1 id="question-title">{question.prompt}</h1>
        <p className="supporting-copy">{selectionHint}</p>
        <fieldset className="option-list">
          <legend className="sr-only">{question.prompt}</legend>
          {question.options.map((option, index) => {
            const checked = selectedIds.includes(option.optionId)
            return (
              <label className={`option-card${checked ? ' option-card--selected' : ''}`} key={option.optionId}>
                <input type={question.multiple ? 'checkbox' : 'radio'} name={question.questionId} checked={checked} onChange={() => onSelect(option.optionId)} />
                <span className="option-card__letter">{String.fromCharCode(65 + index)}</span>
                <span className="option-card__copy"><strong>{option.text}</strong><small>{option.subtitle}</small></span>
                <span className="option-card__mark" aria-hidden="true">✓</span>
              </label>
            )
          })}
        </fieldset>
      </div>
    </article>
  )
}
