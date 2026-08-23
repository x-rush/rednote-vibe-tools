import { describe, expect, it } from 'vitest'
import { validateContent } from './validate'

describe('content validation', () => {
  it('reports readable JSON paths for a malformed envelope', () => {
    const result = validateContent({}, 'envelope')
    expect(result.ok).toBe(false)
    expect(result.issues.some(({ path }) => path === '$.projectId')).toBe(true)
    expect(result.issues.some(({ path }) => path === '$.content')).toBe(true)
  })

  it('rejects invalid quest enums, assets, badge references, and safety tags', () => {
    const invalid = {
      schemaVersion: 1, contentVersion: '1.0.0', projectId: 'earth-online',
      meta: { title: '地球 Online', locale: 'zh-CN', updatedAt: '2026-08-23' }, sources: [],
      content: {
        categories: [{ id: 'rest', name: '恢复精力', goalIds: ['relax'], assetId: 'category-rest' }], goals: [{ id: 'relax', name: '放松' }],
        badges: [], filters: [], cooldown: { recentOfferLimit: 3, historyLimit: 100 }, fallback: { categoryIds: ['rest'] }, safetyRules: [],
        tasks: [{ questId: 'quest-bad', title: '坏任务', description: '测试', category: 'rest', timeCost: 7, energyLevel: 9, locationCondition: 'private', environments: ['outdoor'], socialLevel: 'solo', costRequired: false, maxCost: 0, difficulty: 'tiny', xp: 0, goalIds: ['relax'], times: ['night'], steps: ['测试'], completionMethod: '测试', abandonRule: '可放弃', cooldownDays: 1, recentRepeatTag: 'bad', safetyTags: [], inapplicableConditions: ['unknown-condition'], acceptText: '接取', completionText: '完成', abandonText: '放弃', shareText: '分享', iconAssetId: 'BAD ASSET', relatedBadgeIds: ['badge-missing'], approved: true, contentVersion: '1.0.0' }],
      },
    }
    const paths = validateContent(invalid, 'production').issues.map(({ path }) => path)
    expect(paths).toContain('$.content.tasks[0].timeCost')
    expect(paths).toContain('$.content.tasks[0].energyLevel')
    expect(paths).toContain('$.content.tasks[0].iconAssetId')
    expect(paths).toContain('$.content.tasks[0].relatedBadgeIds[0]')
    expect(paths).toContain('$.content.tasks[0].safetyTags')
    expect(paths).toContain('$.content.tasks[0].inapplicableConditions[0]')
  })
})
