import { createRef } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PosterPreview } from './EndingPosterPanel'

describe('ending poster controls', () => {
  it('renders a real 3:4 canvas with native album and note actions', () => {
    const html = renderToStaticMarkup(<PosterPreview
      canvasRef={createRef<HTMLCanvasElement>()}
      copy={{ posterImageAlt: '百日经营总结图', posterSave: '保存到相册', posterShare: '去小红书分享', posterClose: '收起总结图' }}
      bridgeAvailable
      busy={false}
      onSave={() => {}}
      onShare={() => {}}
      onClose={() => {}}
    />)

    expect(html).toContain('width="1080"')
    expect(html).toContain('height="1440"')
    expect(html).toContain('aria-label="百日经营总结图"')
    expect(html).toContain('保存到相册')
    expect(html).toContain('去小红书分享')
    expect(html).toContain('收起总结图')
    expect(html).not.toContain('download=')
  })

  it('disables native-only actions outside the mini tool bridge', () => {
    const html = renderToStaticMarkup(<PosterPreview
      canvasRef={createRef<HTMLCanvasElement>()}
      copy={{ posterImageAlt: '百日经营总结图', posterSave: '保存到相册', posterShare: '去小红书分享', posterClose: '收起总结图', posterBridgeHint: '请在真机中保存或分享。' }}
      bridgeAvailable={false}
      busy={false}
      onSave={() => {}}
      onShare={() => {}}
      onClose={() => {}}
    />)

    expect(html.match(/disabled=""/g)).toHaveLength(2)
    expect(html).toContain('请在真机中保存或分享。')
  })
})
