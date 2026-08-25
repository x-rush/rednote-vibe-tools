import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import rawContent from '../content/content.json'
import { validateContent } from '../content/validate'
import { QuizExperience } from './QuizExperience'

const content = validateContent(rawContent)
const question = content.content.questions[0]!
const chapter = content.content.chapters.find((item) => item.id === question.chapterId)!

describe('QuizExperience companion', () => {
  it('uses the current volume phase before selection', () => {
    const html = renderToStaticMarkup(
      <QuizExperience
        question={question}
        chapter={chapter}
        chapters={content.content.chapters}
        guide={content.content.experience.guide}
        current={1}
        total={24}
        onChoose={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onSubmit={vi.fn()}
      />,
    )
    expect(html).toContain(content.content.experience.guide.quizCompanion.phase.entry.opening)
  })

  it('uses the selected-state line after an action is chosen', () => {
    const html = renderToStaticMarkup(
      <QuizExperience
        question={question}
        chapter={chapter}
        chapters={content.content.chapters}
        guide={content.content.experience.guide}
        current={1}
        total={24}
        selectedOptionId={question.options[0].id}
        onChoose={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onSubmit={vi.fn()}
      />,
    )
    expect(html).toContain(content.content.experience.guide.quizCompanion.selected)
  })
})
