import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GuidePresence } from './GuidePresence.tsx'

const props = {
  line: '先看器形，再判断它为什么被这样制造。',
  askLabel: '问许照',
  guideName: '许照',
  guideRole: '闭馆整理员',
}

describe('GuidePresence', () => {
  it('uses the full master portrait for a key dialogue stage', () => {
    const markup = renderToStaticMarkup(<GuidePresence {...props} presentation="stage" />)

    expect(markup).toContain('guide-presence--stage')
    expect(markup).toContain('guide-master-v1.webp')
    expect(markup).toContain('width="900"')
    expect(markup).toContain('height="1200"')
    expect(markup).toContain('闭馆整理员许照')
    expect(markup).not.toContain('guide-avatar-v1.webp')
  })

  it('keeps the avatar treatment for ordinary hints', () => {
    const markup = renderToStaticMarkup(<GuidePresence {...props} />)

    expect(markup).toContain('guide-presence--compact')
    expect(markup).toContain('guide-avatar-v1.webp')
    expect(markup).not.toContain('guide-master-v1.webp')
  })
})
