import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import rawContent from '../content/content.json'
import { validateContent } from '../content/validate'
import { ChoiceSlip } from './ChoiceSlip'
import { QuizPage } from './QuizPage'
import { VolumeProgress } from './VolumeProgress'

const content = validateContent(rawContent)

describe('quiz journey primitives', () => {
  it('renders four textual volume seals and exact question progress', () => {
    const html = renderToStaticMarkup(<VolumeProgress current={9} total={24} />)

    expect((html.match(/volume-progress__seal(?:\s|")/g) ?? [])).toHaveLength(4)
    expect(html).toContain('第 2 章 · 9 / 24')
    expect(html).toContain('入境 · 已完成')
    expect(html).toContain('寻迹 · 当前章')
    expect(html).toContain('异变 · 未开始')
    expect(html).toContain('data-state="completed"')
    expect(html).toContain('data-state="current"')
  })

  it('keeps native radio semantics for a selected action slip', () => {
    const html = renderToStaticMarkup(
      <ChoiceSlip name="q1" optionId="o1" text="先辨认足迹" selected onChoose={vi.fn()} />,
    )

    expect(html).toContain('type="radio"')
    expect(html).toContain('checked=""')
    expect(html).toContain('choice-slip--selected')
    expect(html).toContain('data-state="selected"')
    expect(html).toContain('先辨认足迹')
    expect(html).toContain('>选<')
  })

  it('does not mark an unselected action slip as chosen', () => {
    const html = renderToStaticMarkup(
      <ChoiceSlip name="q1" optionId="o2" text="先问同行者" selected={false} onChoose={vi.fn()} />,
    )

    expect(html).not.toContain('choice-slip--selected')
    expect(html).toContain('data-state="idle"')
    expect(html).not.toContain('checked=""')
  })

  it('renders the quiz as a volume with four action slips and an explicit seal action', () => {
    const question = content.content.questions[0]!
    const chapter = content.content.chapters.find((item) => item.id === question.chapterId)!
    const html = renderToStaticMarkup(
      <QuizPage
        question={question}
        chapter={chapter}
        guide={content.content.experience.guide}
        guideLine="这一页的闻山台词"
        current={1}
        total={24}
        selectedOptionId={question.options[0]!.id}
        onChoose={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onSubmit={vi.fn()}
        onGuideOpen={vi.fn()}
      />,
    )

    expect(html).toContain('volume-progress')
    expect(html).toContain('question-fieldset__prompt')
    expect((html.match(/choice-slip(?:\s|")/g) ?? [])).toHaveLength(4)
    expect(html).toContain('落印，下一问')
    expect(html).toContain('guide-presence--compact')
    expect(html).toContain('这一页的闻山台词')
    expect(html).toContain('data-accent="true"')
    expect(html).toContain('button__state')
  })
})
