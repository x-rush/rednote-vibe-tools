import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { GuidePresence } from './GuidePresence'
import { focusLoopTargetIndex } from '../../guide/focusLoop'
import { GuideSheet } from './GuideSheet'

describe('Wenshan guide surfaces', () => {
  it('loops focus forward and backward at modal boundaries', () => {
    expect(focusLoopTargetIndex(-1, 2, false)).toBe(0)
    expect(focusLoopTargetIndex(-1, 2, true)).toBe(1)
    expect(focusLoopTargetIndex(1, 2, false)).toBe(0)
    expect(focusLoopTargetIndex(0, 2, true)).toBe(1)
    expect(focusLoopTargetIndex(0, 2, false)).toBeUndefined()
  })

  it('renders an actionable identity with the current guide line', () => {
    const html = renderToStaticMarkup(
      <GuidePresence name="闻山" role="山海司守卷人" line="卷已备好" onOpen={vi.fn()} />,
    )

    expect(html).toContain('<button')
    expect(html).toContain('guide-presence')
    expect(html).toContain('闻山')
    expect(html).toContain('山海司守卷人')
    expect(html).toContain('卷已备好')
  })

  it('renders a labelled modal with every supplied line and a close control', () => {
    const html = renderToStaticMarkup(
      <GuideSheet
        title="阅卷说明"
        name="闻山"
        role="山海司守卷人"
        lines={['第一句', '第二句']}
        onClose={vi.fn()}
      />,
    )

    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('阅卷说明')
    expect(html).toContain('第一句')
    expect(html).toContain('第二句')
    expect(html).toContain('山海司守卷人 · 闻山')
    expect(html).toContain('关闭')
  })

  it('renders a non-interactive presence when no open action is supplied', () => {
    const html = renderToStaticMarkup(
      <GuidePresence name="闻山" role="山海司守卷人" line="正在收卷" />,
    )

    expect(html).toContain('<aside')
    expect(html).not.toContain('<button')
  })
})
