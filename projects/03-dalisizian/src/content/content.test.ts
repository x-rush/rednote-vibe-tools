import { describe, expect, it } from 'vitest'
import content from './content.json'

describe('content envelope', () => {
  it('ships the complete eight-case production package', () => {
    expect(content.projectId).toBe('dalisizian')
    expect(content.schemaVersion).toBe(1)
    expect(content.meta.locale).toBe('zh-CN')
    expect(content.contentVersion).toBe('1.0.0')
    expect(content.content.cases).toHaveLength(8)
    expect(content.content.characters.length).toBeGreaterThanOrEqual(4)
    expect(content.content.nodes.length).toBeGreaterThanOrEqual(144)
    expect(content.content.evidence.length).toBeGreaterThanOrEqual(32)
    expect(content.content.endings).toHaveLength(8)
  })

  it('gives every case a complete option-driven investigation contract', () => {
    for (const item of content.content.cases) {
      expect(item.characterIds.length).toBeGreaterThanOrEqual(3)
      expect(item.scenes.length).toBeGreaterThanOrEqual(3)
      expect(item.clues.length).toBeGreaterThanOrEqual(3)
      expect(item.nodeIds.length).toBeGreaterThanOrEqual(18)
      expect(item.evidenceIds.length).toBeGreaterThanOrEqual(4)
      expect(item.deductions.length).toBeGreaterThanOrEqual(3)
      expect(item.endingIds).toHaveLength(1)
      expect(item.assetIds.characterIds.length).toBe(item.characterIds.length)
      expect(item.assetIds.sceneIds.length).toBe(item.scenes.length)
      expect(item.assetIds.evidenceIds.length).toBe(item.evidenceIds.length)
    }
  })
})
