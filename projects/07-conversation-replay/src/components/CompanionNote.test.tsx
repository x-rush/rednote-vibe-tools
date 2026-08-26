import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CompanionNote } from './CompanionNote'

describe('CompanionNote', () => {
  it('renders a companion note without chat-app semantics', () => {
    const html = renderToStaticMarkup(<CompanionNote companion={{
      name: '迟言',
      role: '温和编辑搭档',
      pose: 'attend',
      featured: true,
      invitation: '先找一个大致位置。',
      autonomy: '选最接近的一项就够了。',
      imageSrc: '/assets/guide/chiyan-attend.webp',
      fallbackSrc: '/assets/guide/chiyan-placeholder.webp',
    }} />)

    expect(html).toContain('迟言')
    expect(html).toContain('is-featured')
    expect(html).toContain('温和编辑搭档')
    expect(html).not.toContain('虚构角色')
    expect(html).toContain('先找一个大致位置。')
    expect(html).toContain('选最接近的一项就够了。')
    expect(html).not.toContain('textbox')
    expect(html).not.toContain('正在输入')
  })
})
