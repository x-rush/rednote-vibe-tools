import { describe, expect, it } from 'vitest'
import content from './content.json'

describe('content envelope', () => {
  it('identifies the proto-cell zh-CN content pack', () => {
    expect(content.projectId).toBe('proto-cell')
    expect(content.meta.locale).toBe('zh-CN')
    expect(content.ui.actions.start).toBe('开始孵化')
  })

  it('owns every body-stage label used by the combat HUD', () => {
    expect([
      content.ui.hud.bodyStage_microbe,
      content.ui.hud.bodyStage_hunter,
      content.ui.hud.bodyStage_specialist,
      content.ui.hud.bodyStage_dominant,
      content.ui.hud.bodyStage_ascendant,
    ]).toEqual(['微生体', '猎食体', '特化体', '优势体', '超升体'])
  })
})
