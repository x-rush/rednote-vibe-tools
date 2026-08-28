import { describe, expect, it } from 'vitest'
import content from './content.json'

describe('content envelope', () => {
  it('identifies the proto-cell zh-CN content pack', () => {
    expect(content.projectId).toBe('proto-cell')
    expect(content.meta.locale).toBe('zh-CN')
    expect(content.ui.actions.start).toBe('开始孵化')
  })
})
