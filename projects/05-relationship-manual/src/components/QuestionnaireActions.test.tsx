import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { QuestionnaireActions } from './QuestionnaireActions'

const handlers = {
  showReturnToReview: false,
  onPrevious: () => undefined,
  onSkip: () => undefined,
  onNext: () => undefined,
  onReturnToReview: () => undefined,
}

describe('QuestionnaireActions', () => {
  it('renders the previous and primary actions as the two-button layout', () => {
    const html = renderToStaticMarkup(
      <QuestionnaireActions {...handlers} previousDisabled={false} allowSkip={false} isLastQuestion={false} />,
    )

    expect(html).toContain('class="action-bar"')
    expect(html).toContain('action-bar__previous')
    expect(html).toContain('action-bar__next')
    expect(html).not.toContain('action-bar--with-skip')
    expect(html).not.toContain('暂不确定')
  })

  it('marks the three-action layout and keeps skip visually secondary', () => {
    const html = renderToStaticMarkup(
      <QuestionnaireActions {...handlers} previousDisabled allowSkip isLastQuestion />,
    )

    expect(html).toContain('action-bar--with-skip')
    expect(html).toContain('action-bar__skip')
    expect(html).toContain('button--text')
    expect(html).toContain('查看回顾')
  })

  it('offers a direct return to the answer review only while editing an existing answer', () => {
    const editingHtml = renderToStaticMarkup(
      <QuestionnaireActions {...handlers} previousDisabled={false} allowSkip={false} isLastQuestion={false} showReturnToReview />,
    )
    const regularHtml = renderToStaticMarkup(
      <QuestionnaireActions {...handlers} previousDisabled={false} allowSkip={false} isLastQuestion={false} showReturnToReview={false} />,
    )

    expect(editingHtml).toContain('保存修改并返回总览')
    expect(editingHtml).toContain('action-bar--editing')
    expect(regularHtml).not.toContain('保存修改并返回总览')
  })
})
