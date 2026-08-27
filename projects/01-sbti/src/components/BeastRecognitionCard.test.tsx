import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { RecognitionCardCopy } from '../content/types'
import { BeastRecognitionCard } from './BeastRecognitionCard'

const copy: RecognitionCardCopy = {
  kicker: '闻山认兽 · 当康',
  hook: '这可不是野猪，是报丰年的瑞兽当康。',
  blessing: '古书说它“见则天下大穰”——你不是在等好运，你走到哪里，哪里就有好日子开张。',
  seal: '丰',
  alt: 'Q版当康，豕形有牙，抬起前蹄，身旁有谷穗',
}

describe('beast recognition card', () => {
  it('renders local chibi artwork and all recognition copy', () => {
    const html = renderToStaticMarkup(<BeastRecognitionCard code="RTES" copy={copy} />)

    expect(html).toContain('/dangkang/chibi-v1.webp')
    for (const text of Object.values(copy)) expect(html).toContain(text)
  })

  it('keeps all copy and a labelled fallback when no beast mapping exists', () => {
    const html = renderToStaticMarkup(<BeastRecognitionCard code="XXXX" copy={copy} />)

    expect(html).not.toContain('<img')
    expect(html).toContain('beast-recognition-card--fallback')
    expect(html).toContain('aria-label="Q版当康，豕形有牙，抬起前蹄，身旁有谷穗"')
    expect(html).toContain(copy.hook)
    expect(html).toContain(copy.blessing)
  })
})
