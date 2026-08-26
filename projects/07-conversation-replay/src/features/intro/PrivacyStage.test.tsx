import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PrivacyStage } from './PrivacyStage'

describe('PrivacyStage', () => {
  it('renders three privacy guarantees and two mode actions', () => {
    const html = renderToStaticMarkup(<PrivacyStage
      companion={{
        name: '迟言',
        role: '温和编辑搭档',
        pose: 'welcome',
        featured: false,
        invitation: '开始前，我们先把保存方式说清楚。',
        reassurance: '无痕只留在当前会话；本机保存最多三份结构化复盘。',
        autonomy: '选哪一种都不影响后面的整理。',
        imageSrc: '/assets/guide/chiyan-guide-master.webp',
        fallbackSrc: '/assets/guide/chiyan-placeholder.webp',
      }}
      sections={[
        { id: 'no-upload', title: '不上传', body: '只选择大致情境和自己的体验。' },
        { id: 'no-judgment', title: '不判断对错', body: '不猜测人格、动机或关系责任。' },
        { id: 'local-only', title: '本机最多三份', body: '仅保存结构化选择和有限编辑。' },
      ]}
      primaryLabel="使用无痕模式"
      secondaryLabel="使用本机保存"
      ephemeralDescription="关闭或退出后，无痕内容会消失。"
      localDescription="仅保存结构化选择和有限编辑。"
      onEphemeral={() => undefined}
      onLocal={() => undefined}
    />)

    expect(html).toContain('privacy-stage')
    expect(html).toContain('不上传')
    expect(html).toContain('不判断对错')
    expect(html).toContain('本机最多三份')
    expect(html.match(/<button/g)).toHaveLength(2)
    expect(html).toContain('使用无痕模式')
    expect(html).toContain('使用本机保存')
    expect(html).toContain('关闭或退出后，无痕内容会消失。')
    expect(html).toContain('仅保存结构化选择和有限编辑。')
    expect(html).not.toContain('companion-note')
  })
})
