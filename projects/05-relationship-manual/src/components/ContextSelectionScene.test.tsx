import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { NpcCue } from '../content/schema'
import { ContextSelectionScene } from './ContextSelectionScene'

const cue: NpcCue = {
  cueId: 'cue-landing',
  trigger: 'landing',
  pose: 'daily',
  speaker: '小满',
  roleLabel: '关系卡片整理员',
  text: '先选一段你想整理的关系。',
  primaryAction: '开始整理',
  skippable: false,
}

describe('ContextSelectionScene', () => {
  it('introduces Xiaoman before the relationship choices in mobile reading order', () => {
    const html = renderToStaticMarkup(
      <ContextSelectionScene
        cue={cue}
        eyebrow="整理对象"
        title="这一次，你想整理哪段关系？"
        body="问题保持中性，章节引子会贴近当前语境。"
        contextHint="选择后仍可重新开始"
        options={[
          { id: 'close-relationship', label: '亲密关系' },
          { id: 'friendship', label: '好友关系' },
          { id: 'family', label: '家人关系' },
        ]}
        principlesTitle="整理原则"
        principles={['不诊断', '不评分']}
        onSelect={() => undefined}
        onBack={() => undefined}
      />,
    )

    const xiaomanPosition = html.indexOf('小满，关系卡片整理员')
    const firstChoicePosition = html.indexOf('亲密关系')
    const principlesPosition = html.indexOf('整理原则')

    expect(xiaomanPosition).toBeGreaterThan(-1)
    expect(firstChoicePosition).toBeGreaterThan(xiaomanPosition)
    expect(principlesPosition).toBeGreaterThan(firstChoicePosition)
    expect(html).toContain('好友关系')
    expect(html).toContain('家人关系')
  })
})
