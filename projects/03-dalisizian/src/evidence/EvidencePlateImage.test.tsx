import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EvidencePlateImage } from './EvidencePlateImage'

describe('EvidencePlateImage', () => {
  it('exposes the local fallback while initially rendering the formal plate', () => {
    const html = renderToStaticMarkup(
      <EvidencePlateImage
        primarySrc="./main.webp"
        fallbackSrc="./fallback.svg"
        fallbackAlt="证物图版回退"
        unavailableLabel="图版待核"
      />,
    )

    expect(html).toContain('src="./main.webp"')
    expect(html).toContain('data-fallback-src="./fallback.svg"')
  })

  it('renders a semantic fallback when neither image path exists', () => {
    const html = renderToStaticMarkup(<EvidencePlateImage fallbackAlt="证物图版暂缺" unavailableLabel="图版待核" />)

    expect(html).toContain('evidence-artifact-fallback')
    expect(html).toContain('图版待核')
    expect(html).toContain('证物图版暂缺')
  })
})
