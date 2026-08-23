import { describe, expect, it } from 'vitest'
import content from './content.json'

describe('content envelope', () => {
  it('uses the project identity and common schema envelope', () => {
    expect(content.projectId).toBe('conversation-replay')
    expect(content.schemaVersion).toBe(1)
    expect(content.meta.locale).toBe('zh-CN')
    expect(content.contentVersion).toContain('scaffold')
  })
})
