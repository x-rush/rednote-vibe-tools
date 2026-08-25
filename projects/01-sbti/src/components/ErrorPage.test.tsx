import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import rawContent from '../content/content.json'
import { validateContent } from '../content/validate'
import { ErrorPage } from './ErrorPage'

const guide = validateContent(rawContent).content.experience.guide

describe('ErrorPage storage recovery', () => {
  it.each([
    ['cleared', 'storageCleared', '返回首页'],
    ['unavailable', 'storageUnavailable', '仅在本次继续'],
    ['write-failed', 'storageWriteFailed', '在内存中继续'],
  ] as const)('renders accurate %s recovery copy', (recoveryKind, lineKey, action) => {
    const html = renderToStaticMarkup(
      <ErrorPage message="技术详情" reason="storage" recoveryKind={recoveryKind} guide={guide} onRecover={vi.fn()} />,
    )

    expect(html).toContain(guide.recovery[lineKey])
    expect(html).toContain(action)
  })

  it('never renders internal diagnostics on a content recovery screen', () => {
    const html = renderToStaticMarkup(
      <ErrorPage message="$.content.resultTypes: missing type RTLS" reason="content" guide={guide} onRecover={vi.fn()} />,
    )

    expect(html).not.toContain('RTLS')
    expect(html).not.toContain('$.content')
    expect(html).toContain('内容包未能安全读取，请重新加载。')
  })
})
