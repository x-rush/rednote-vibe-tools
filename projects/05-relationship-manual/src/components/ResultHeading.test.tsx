import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { NpcCue } from '../content/schema'
import { ResultHeading } from './ResultHeading'

const cue: NpcCue = {
  cueId: 'cue-binding',
  trigger: 'binding',
  pose: 'daily',
  speaker: '小满',
  roleLabel: '关系卡片整理员',
  text: '七只文件夹都整理好了，留下的每句话仍然可以继续修改。',
  primaryAction: '查看说明书',
  skippable: false,
}

describe('ResultHeading', () => {
  it('keeps Xiaoman inside the result heading instead of creating a separate page band', () => {
    const html = renderToStaticMarkup(
      <ResultHeading eyebrow="你的说明书已整理好" title="可以继续修改的表达" body="分享前请再次确认内容。" cue={cue} />,
    )

    expect(html).toContain('result-heading__companion')
    expect(html.indexOf('可以继续修改的表达')).toBeLessThan(html.indexOf('小满，关系卡片整理员'))
    expect(html).toContain(cue.text)
  })

  it('keeps the result title available when the companion cue is missing', () => {
    const html = renderToStaticMarkup(
      <ResultHeading eyebrow="已完成" title="仍可查看的说明书" body="核心结果不会依赖角色资源。" cue={null} />,
    )

    expect(html).toContain('仍可查看的说明书')
    expect(html).not.toContain('result-heading__companion')
  })
})
