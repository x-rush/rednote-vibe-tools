import type { ChapterDefinition, GuideCopy, Question } from '../content/types'
import { ChoiceSlip } from './ChoiceSlip'
import { GuidePresence } from './guide/GuidePresence'
import { VolumeProgress } from './VolumeProgress'

export type QuizPageProps = {
  question: Question
  chapter: ChapterDefinition
  guide: GuideCopy
  guideLine: string
  current: number
  total: number
  selectedOptionId?: string
  message?: string
  onChoose: (optionId: string) => void
  onPrevious: () => void
  onNext: () => void
  onSubmit: () => void
  onGuideOpen: (trigger: HTMLButtonElement) => void
}

export function QuizPage(props: QuizPageProps) {
  const isLast = props.current === props.total
  return (
    <main className="page page--quiz">
      <header className="quiz-header">
        <div><p className="eyebrow">第 {props.chapter.order} 章 · {props.chapter.name}</p><p className="chapter-description">{props.chapter.description}</p></div>
        <span aria-label={`第 ${props.current} 题，共 ${props.total} 题`}>{props.current}/{props.total}</span>
      </header>
      <VolumeProgress current={props.current} total={props.total} />
      <GuidePresence
        name={props.guide.name}
        role={props.guide.role}
        line={props.guideLine}
        compact
        accent={Boolean(props.selectedOptionId)}
        onOpen={props.onGuideOpen}
      />
      <form onSubmit={(event) => {
        event.preventDefault()
        if (isLast) props.onSubmit()
        else props.onNext()
      }}>
        <fieldset className="question-fieldset">
          <legend>{props.question.prompt}</legend>
          <div className="option-list">
            {props.question.options.map((option) => (
              <ChoiceSlip
                name={props.question.id}
                optionId={option.id}
                text={option.text}
                selected={props.selectedOptionId === option.id}
                onChoose={props.onChoose}
                key={option.id}
              />
            ))}
          </div>
        </fieldset>
        {props.message && <p className="form-message" role="alert">{props.message}</p>}
        <div className="button-row">
          <button type="button" className="button button--quiet" onClick={props.onPrevious} disabled={props.current === 1}>上一题</button>
          <button type="submit" className="button button--primary" disabled={!props.selectedOptionId}>
            <span className="button__state" key={!props.selectedOptionId ? 'waiting' : isLast ? 'final' : 'ready'}>
              {!props.selectedOptionId ? '请先选择一种行动' : isLast ? '收卷，让兽格显形' : '落印，下一问'}
            </span>
          </button>
        </div>
      </form>
    </main>
  )
}
