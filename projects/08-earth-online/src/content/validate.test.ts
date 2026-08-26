import { describe, expect, it } from 'vitest'
import rawContent from './content.json'
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
        tasks: [{ questId: 'quest-bad', title: '坏任务', description: '测试', tone: 'reckless', guildBrief: '短', category: 'rest', timeCost: 7, energyLevel: 9, locationCondition: 'private', environments: ['outdoor'], socialLevel: 'solo', costRequired: false, maxCost: 0, difficulty: 'tiny', xp: 0, goalIds: ['relax'], times: ['night'], steps: ['测试'], completionMethod: '测试', abandonRule: '可放弃', cooldownDays: 1, recentRepeatTag: 'bad', safetyTags: [], inapplicableConditions: ['unknown-condition'], acceptText: '接取', completionText: '完成', abandonText: '放弃', shareText: '分享', iconAssetId: 'BAD ASSET', relatedBadgeIds: ['badge-missing'], approved: true, contentVersion: '1.0.0' }],
      },
    }
    const paths = validateContent(invalid, 'production').issues.map(({ path }) => path)
    expect(paths).toContain('$.content.tasks[0].timeCost')
    expect(paths).toContain('$.content.tasks[0].energyLevel')
    expect(paths).toContain('$.content.tasks[0].iconAssetId')
    expect(paths).toContain('$.content.tasks[0].relatedBadgeIds[0]')
    expect(paths).toContain('$.content.tasks[0].safetyTags')
    expect(paths).toContain('$.content.tasks[0].inapplicableConditions[0]')
    expect(paths).toContain('$.content.tasks[0].tone')
    expect(paths).toContain('$.content.tasks[0].guildBrief')
  })

  it('rejects production content without the complete UI copy contract', () => {
    const missingUi = {
      schemaVersion: 1,
      contentVersion: '1.0.0',
      projectId: 'earth-online',
      meta: { title: '地球 Online', locale: 'zh-CN', updatedAt: '2026-08-23' },
      sources: [],
      content: { categories: [], goals: [], badges: [], tasks: [], filters: [], cooldown: {}, fallback: {}, safetyRules: [] },
    }
    expect(validateContent(missingUi, 'production').issues).toContainEqual({ path: '$.content.ui', message: '缺少完整 UI 文案' })
  })

  it('rejects an NPC audience without its dialogue copy', () => {
    const missingDialogue = structuredClone(rawContent) as unknown as { content: { ui: { helpDialogue?: unknown } } }
    delete missingDialogue.content.ui.helpDialogue
    expect(validateContent(missingDialogue, 'production').issues).toContainEqual({ path: '$.content.ui.helpDialogue', message: '弥拉会面对话文案不完整' })
  })

  it('rejects a HUD without explicit player and guide identity copy', () => {
    const missingHud = structuredClone(rawContent) as unknown as { content: { ui: { hud?: unknown } } }
    delete missingHud.content.ui.hud
    expect(validateContent(missingHud, 'production').issues).toContainEqual({ path: '$.content.ui.hud', message: '顶栏身份文案不完整' })
  })
})
