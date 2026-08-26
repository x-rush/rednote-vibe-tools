import { useEffect, useRef } from 'react'
import type { ConditionValue, Scenario } from '../content/schema'
import type { ResolvedScenarioQuestion } from './checklistView'
import { GuidePortrait } from './GuidePortrait'

type ConditionWizardProps = {
  scenario: Scenario
  resolvedQuestions: ResolvedScenarioQuestion[]
  questionIndex: number
  conditions: Record<string, ConditionValue | ConditionValue[]>
  onBackHome: () => void
  onPrevious: () => void
  onAnswer: (key: string, value: ConditionValue | ConditionValue[]) => void
  onSkip: (key: string) => void
  onClearCondition: (key: string) => void
  onSetCondition: (key: string, value: ConditionValue | ConditionValue[]) => void
}

const numberPresets = [30, 90, 180]

export function ConditionWizard({
  scenario,
  resolvedQuestions,
  questionIndex,
  conditions,
  onBackHome,
  onPrevious,
  onAnswer,
  onSkip,
  onClearCondition,
  onSetCondition,
}: ConditionWizardProps) {
  const questionTitleRef = useRef<HTMLHeadingElement>(null)
  const previousQuestionIndex = useRef(questionIndex)
  useEffect(() => {
    if (previousQuestionIndex.current === questionIndex) return
    previousQuestionIndex.current = questionIndex
    questionTitleRef.current?.focus()
  }, [questionIndex])

  const resolved = resolvedQuestions[questionIndex]
  if (!resolved) return null
  const { question, definition } = resolved
  const current = conditions[definition.key]
  const validCustomNumber = typeof current === 'number'
    && current >= (definition.min ?? -Infinity)
    && current <= (definition.max ?? Infinity)

  const toggleMultiple = (value: ConditionValue) => {
    const selected = Array.isArray(current) ? current : []
    onSetCondition(
      definition.key,
      selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value],
    )
  }

  return (
    <main className="app-shell condition-screen">
      <header className="page-header">
        <button className="back-button" type="button" onClick={onBackHome}>返回场景</button>
        <p>{scenario.name} · {questionIndex + 1} / {resolvedQuestions.length}</p>
      </header>
      <div className="question-progress" aria-hidden="true"><i style={{ width: `${((questionIndex + 1) / resolvedQuestions.length) * 100}%` }} /></div>
      <GuidePortrait variant="wizard">
        <p className="eyebrow">路岚陪你补条件</p>
        <strong>第 {questionIndex + 1} 步</strong>
        <p>先确认这一个条件。</p>
      </GuidePortrait>
      <section className="condition-question" aria-labelledby="question-title">
        <p className="eyebrow">{definition.label}</p>
        <h1 id="question-title" ref={questionTitleRef} tabIndex={-1}>{question.prompt}</h1>
        <p className="lede">不确定可以跳过，基础清单仍会生成。</p>

        <div className="option-grid answer-options">
          {definition.inputType === 'boolean' && [
            { value: true, label: '是，需要' },
            { value: false, label: '不用' },
          ].map((option) => (
            <button
              className={`choice-button ${current === option.value ? 'active' : ''}`}
              aria-pressed={current === option.value}
              type="button"
              key={String(option.value)}
              onClick={() => onAnswer(definition.key, option.value)}
            >{option.label}</button>
          ))}

          {definition.inputType === 'single' && definition.options?.map((option) => (
            <button
              className={`choice-button ${current === option.value ? 'active' : ''}`}
              aria-pressed={current === option.value}
              type="button"
              key={String(option.value)}
              onClick={() => onAnswer(definition.key, option.value)}
            >{option.label}</button>
          ))}

          {definition.inputType === 'multiple' && definition.options?.map((option) => (
            <button
              className={`choice-button ${Array.isArray(current) && current.includes(option.value) ? 'active' : ''}`}
              aria-pressed={Array.isArray(current) && current.includes(option.value)}
              type="button"
              key={String(option.value)}
              onClick={() => toggleMultiple(option.value)}
            >{option.label}</button>
          ))}
        </div>

        {definition.inputType === 'multiple' && (
          <button
            className="primary-button answer-confirm-button"
            type="button"
            disabled={!Array.isArray(current) || current.length === 0}
            onClick={() => onAnswer(definition.key, current)}
          >选好了，继续</button>
        )}

        {definition.inputType === 'number' && (
          <div className="number-question">
            <div className="option-grid answer-options compact-options">
              {numberPresets.filter((value) => value >= (definition.min ?? 0) && value <= (definition.max ?? Infinity)).map((value) => (
                <button
                  className={`choice-button ${current === value ? 'active' : ''}`}
                  aria-pressed={current === value}
                  type="button"
                  key={value}
                  onClick={() => onAnswer(definition.key, value)}
                >{value} 分钟</button>
              ))}
            </div>
            <label className="number-input"><span>其他时长（分钟）</span><input type="number" min={definition.min} max={definition.max} value={typeof current === 'number' ? current : ''} onChange={(event) => {
              if (event.target.value === '') onClearCondition(definition.key)
              else onSetCondition(definition.key, Number(event.target.value))
            }} /></label>
            <button
              className="primary-button answer-confirm-button"
              type="button"
              disabled={!validCustomNumber}
              onClick={() => validCustomNumber && onAnswer(definition.key, current)}
            >使用这个时长</button>
          </div>
        )}
      </section>
      <footer className={`sticky-bar wizard-navigation ${questionIndex === 0 ? 'single-action' : ''}`}>
        {questionIndex > 0 && <button className="secondary-button" type="button" onClick={onPrevious}>上一题</button>}
        <button className="secondary-button" type="button" onClick={() => onSkip(definition.key)}>跳过此题</button>
      </footer>
    </main>
  )
}
