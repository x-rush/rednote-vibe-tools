import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ChiyanGuide } from './ChiyanGuide'

const companion = {
  name: '迟言',
  role: '温和编辑搭档',
  pose: 'welcome' as const,
  featured: false,
  invitation: '我会陪你整理。',
  reassurance: '不用一次说完整。',
  autonomy: '决定权在你。',
  imageSrc: '/assets/guide/chiyan-welcome.webp',
  fallbackSrc: '/assets/guide/chiyan-placeholder.webp',
}

describe('ChiyanGuide', () => {
  it('uses the screen action label so the final guide step matches the next task', () => {
    const html = renderToStaticMarkup(<ChiyanGuide
      companion={companion}
      title="决定权仍在你"
      lead="这里不会替你决定。"
      step={2}
      primaryLabel="开始定位情境"
      secondaryLabel="跳过引导"
      onNext={() => undefined}
      onSkip={() => undefined}
    />)

    expect(html).toContain('开始定位情境')
    expect(html).not.toContain('开始选择情境')
  })
})
