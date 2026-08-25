import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { RevealSequence } from './RevealSequence'
import rawContent from '../content/content.json'
import { validateContent } from '../content/validate'
import { visibleRevealStep } from '../quiz/revealMotion'

const dimensions = validateContent(rawContent).content.dimensions

describe('RevealSequence', () => {
  const guide = {
    name: '测试守卷人',
    role: '测试身份',
    reveal: { collecting: '收卷', reading: '辨印', complete: '显形' },
  }

  it('shows all four dimension seals and the semantic end state with reduced motion', () => {
    const html = renderToStaticMarkup(
      <RevealSequence
        guide={guide}
        dimensions={dimensions}
        reducedMotion
        onComplete={vi.fn()}
      />,
    )

    for (const dimension of dimensions) expect(html).toContain(dimension.displayName)
    expect(html).not.toMatch(/>\s*(RH|TV|LE|SM)\s*</)
    expect(html).toContain('显形')
    expect(html).toContain('测试守卷人')
    expect(html).toContain('测试身份')
    expect(html).toContain('展开兽志')
    expect(html).toContain('data-state="complete"')
    expect(html).toContain('data-state="revealed"')
  })

  it('starts standard motion from the collecting state with a skip action', () => {
    const html = renderToStaticMarkup(
      <RevealSequence
        guide={guide}
        dimensions={dimensions}
        reducedMotion={false}
        onComplete={vi.fn()}
      />,
    )

    expect(html).toContain('收卷')
    expect(html).toContain('跳过显形')
    expect(html).toContain('data-state="collecting"')
    expect(html).toContain('data-state="waiting"')
  })

  it('switches an in-progress reveal to its terminal state when reduced motion turns on', () => {
    expect(visibleRevealStep('collecting', false)).toBe('collecting')
    expect(visibleRevealStep('collecting', true)).toBe('complete')
    expect(visibleRevealStep('reading', true)).toBe('complete')
  })
})
