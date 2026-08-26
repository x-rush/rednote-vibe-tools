import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { XiaomanStage } from './XiaomanStage'

describe('XiaomanStage', () => {
  it.each(['hero', 'stage', 'avatar'] as const)('exposes the %s presentation scale to its consumer', (mode) => {
    const html = renderToStaticMarkup(
      <XiaomanStage pose="daily" mode={mode} name="小满" roleLabel="关系卡片整理员" />,
    )

    expect(html).toContain(`xiaoman-stage--${mode}`)
    expect(html).toContain('小满，关系卡片整理员')
  })
})
