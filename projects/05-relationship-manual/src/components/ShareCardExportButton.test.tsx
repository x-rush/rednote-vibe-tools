import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ShareCardExportButton } from './ShareCardExportButton'

describe('ShareCardExportButton', () => {
  const labels = {
    label: '保存简洁长图',
    exportingLabel: '正在生成图片…',
    description: '通过小工具能力保存到手机相册，不会上传内容',
  }

  it('explains that the result is a locally generated PNG', () => {
    const html = renderToStaticMarkup(<ShareCardExportButton {...labels} exporting={false} onExport={() => undefined} />)

    expect(html).toContain('保存简洁长图')
    expect(html).toContain('保存到手机相册')
    expect(html).not.toContain('disabled')
  })

  it('prevents duplicate exports while the PNG is being generated', () => {
    const html = renderToStaticMarkup(<ShareCardExportButton {...labels} exporting onExport={() => undefined} />)

    expect(html).toContain('正在生成图片…')
    expect(html).toContain('disabled')
  })

  it('disables export when the compact card has no visible sections', () => {
    const html = renderToStaticMarkup(
      <ShareCardExportButton {...labels} exporting={false} disabled onExport={() => undefined} />,
    )

    expect(html).toContain('disabled')
  })
})
