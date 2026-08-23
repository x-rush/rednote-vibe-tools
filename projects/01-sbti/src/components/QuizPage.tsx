import type { ChapterDefinition, Question } from '../content/types'

type Props = {
  question: Question
  chapter: ChapterDefinition
  current: number
  total: number
  selectedOptionId?: string
  message?: string
  onChoose: (optionId: string) => void
  onPrevious: () => void
  onNext: () => void
  onSubmit: () => void
}

export function QuizPage(props: Props) {
  const isLast = props.current === props.total
  return (
    <main className="page page--quiz">
      <header className="quiz-header">
        <div><p className="eyebrow">第 {props.chapter.order} 章 · {props.chapter.name}</p><p className="chapter-description">{props.chapter.description}</p></div>
        <span aria-label={`第 ${props.current} 题，共 ${props.total} 题`}>{props.current}/{props.total}</span>
      </header>
      <progress value={props.current} max={props.total}>第 {props.current} 题，共 {props.total} 题</progress>
      <form onSubmit={(event) => {
        event.preventDefault()
        if (isLast) props.onSubmit()
        else props.onNext()
      }}>
        <fieldset className="question-fieldset">
          <legend>{props.question.prompt}</legend>
          <div className="option-list">
            {props.question.options.map((option) => (
              <label className={`option${props.selectedOptionId === option.id ? ' option--selected' : ''}`} key={option.id}>
                <input type="radio" name={props.question.id} value={option.id} checked={props.selectedOptionId === option.id} onChange={() => props.onChoose(option.id)} />
                <span>{option.text}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {props.message && <p className="form-message" role="alert">{props.message}</p>}
        <div className="button-row">
          <button type="button" className="button button--quiet" onClick={props.onPrevious} disabled={props.current === 1}>上一题</button>
          <button type="submit" className="button button--primary" disabled={!props.selectedOptionId}>{isLast ? '让兽格显形' : '下一题'}</button>
        </div>
      </form>
    </main>
  )
}
