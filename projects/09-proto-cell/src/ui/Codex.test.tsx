import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { getContent } from '../content'
import { Codex } from './Codex'

describe('ecology codex navigation', () => {
  it('places the return control before the long entry list', () => {
    const html = renderToStaticMarkup(
      <Codex content={getContent()} progress={{}} onClose={() => undefined} />,
    )

    const returnControl = html.indexOf('返回培养舱')
    const firstEntry = html.indexOf('<article')
    expect(returnControl).toBeGreaterThan(-1)
    expect(returnControl).toBeLessThan(firstEntry)
  })
})
