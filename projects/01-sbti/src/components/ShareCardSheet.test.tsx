import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import rawContent from '../content/content.json'
import { validateContent } from '../content/validate'
import type { ShareCardModel } from '../share/shareCardModel'
import { ShareCardSheet } from './ShareCardSheet'

const copy = validateContent(rawContent).content.experience.shareCard
const model: ShareCardModel = {
  eyebrow: copy.cardEyebrow,
  creatureName: '陆吾',
  typeName: '山司型',
  line: '你让纷乱之中仍有可以依循的边界。',
  chibiLine: '你最让人安心的，不是事事有答案，而是再乱的局面，到你手里也会慢慢有章法。',
  quote: '稳住值得守住的部分。',
  guideLabel: copy.guideLabel,
  guideSeal: copy.guideSeal,
  guideNote: '闻山为你留下的一句批注。',
  preferredPoles: ['应世', '察微', '衡理', '守形'],
  brand: 'SHBTI｜山海兽格测试',
  boundary: '娱乐性自我探索工具，不是专业心理测评。',
  imageSrc: './beast.webp',
  chibiSrc: './chibi.webp',
  placeholderSrc: './placeholder.webp',
  imageFocusY: 0.5,
}

describe('share card sheet', () => {
  it('opens as an accessible card-writing dialog with a live status', () => {
    const html = renderToStaticMarkup(<ShareCardSheet model={model} copy={copy} returnFocusRef={{ current: null }} onClose={vi.fn()} />)

    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain(copy.title)
    expect(html).toContain(copy.generating)
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('<canvas')
    expect(html).toContain('role="radiogroup"')
    expect(html).toContain(copy.artworkStyleLegend)
    expect(html).toContain(copy.chibiStyleLabel)
    expect(html).toContain(copy.originalStyleLabel)
    expect(html).toMatch(/<input[^>]*checked=""[^>]*value="chibi"/)
  })
})
