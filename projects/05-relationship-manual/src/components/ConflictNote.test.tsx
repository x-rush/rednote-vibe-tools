import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { NpcCue } from '../content/schema'
import { ConflictNote } from './ConflictNote'

const cue: NpcCue = {
  cueId: 'cue-conflict', trigger: 'conflict', relationshipContext: 'close-relationship',
  conflictRuleId: 'close-merge-talk-and-space', pose: 'reminder', speaker: '小满',
  roleLabel: '关系卡片整理员', text: '两种需要可以并存。', primaryAction: '采用合并建议',
  secondaryAction: '保留原选择', skippable: true,
}

describe('ConflictNote', () => {
  it('offers distinct adopt, preserve, and decide-later actions', () => {
    const html = renderToStaticMarkup(
      <ConflictNote cue={cue} onAdopt={() => undefined} onPreserve={() => undefined} onClose={() => undefined} />,
    )

    expect(html).toContain('采用合并建议')
    expect(html).toContain('保留原选择')
    expect(html).toContain('稍后决定')
  })
})
