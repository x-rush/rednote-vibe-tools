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

  it('rejects an ID reused across active and retired catalogs', () => {
    const duplicate = structuredClone(rawContent)
    const duplicateIndex = duplicate.content.retiredTasks.length
    duplicate.content.retiredTasks.push(structuredClone(duplicate.content.tasks[0]))
    expect(validateContent(duplicate, 'production').issues).toContainEqual({ path: `$.content.retiredTasks[${duplicateIndex}].questId`, message: '任务 ID 重复' })
  })

  it('allows multiple archived versions of one ID but rejects duplicate ID-version pairs', () => {
    const versioned = structuredClone(rawContent)
    const older = { ...structuredClone(versioned.content.legacyTasks[0]), contentVersion: '0.9.0' }
    versioned.content.legacyTasks.push(older)
    expect(validateContent(versioned, 'production').issues.some(({ message }) => message === '旧版本任务 ID 与内容版本重复')).toBe(false)
    versioned.content.legacyTasks.push(structuredClone(older))
    expect(validateContent(versioned, 'production').issues).toContainEqual({ path: `$.content.legacyTasks[${versioned.content.legacyTasks.length - 1}].contentVersion`, message: '旧版本任务 ID 与内容版本重复' })
  })

  it('rejects stale templates, mismatched XP, and unsupported cooldowns in active content', () => {
    const invalid = structuredClone(rawContent)
    invalid.content.tasks[0].description = '认真演完这段荒唐，普通日常就会短暂获得剧情。'
    invalid.content.tasks[0].xp = 99
    invalid.content.tasks[0].cooldownDays = 99
    const issues = validateContent(invalid, 'production').issues
    expect(issues).toContainEqual({ path: '$.content.tasks[0].description', message: '活跃任务不得使用旧通用文案模板' })
    expect(issues).toContainEqual({ path: '$.content.tasks[0].xp', message: 'XP 必须与难度档位一致' })
    expect(issues).toContainEqual({ path: '$.content.tasks[0].cooldownDays', message: '冷却只能为 3、7 或 14 天' })
  })

  it('rejects unapproved or stale-version active quests', () => {
    const invalid = structuredClone(rawContent)
    invalid.content.tasks[0].approved = false
    invalid.content.tasks[1].contentVersion = '1.0.0'
    const issues = validateContent(invalid, 'production').issues
    expect(issues).toContainEqual({ path: '$.content.tasks[0].approved', message: '活跃任务必须通过审核' })
    expect(issues).toContainEqual({ path: '$.content.tasks[1].contentVersion', message: '活跃任务内容版本必须与内容包一致' })
  })

  it('rejects a release whose active challenge distribution drifts', () => {
    const drifted = structuredClone(rawContent)
    const fiveMinuteQuests = drifted.content.tasks.filter((quest) => quest.timeCost === 5).slice(0, 9)
    if (fiveMinuteQuests.length !== 9) throw new Error('fixture requires nine five-minute quests')
    for (const quest of fiveMinuteQuests) quest.timeCost = 20
    expect(validateContent(drifted, 'production').issues).toContainEqual({ path: '$.content.tasks', message: '活跃任务时间、精力或难度分布不符合内容版本契约' })
  })

  it('allows expansion beyond 100 quests but rejects shrinking below the release floor', () => {
    expect(validateContent(rawContent, 'production').issues).not.toContainEqual({ path: '$.content.tasks', message: '活跃任务不得少于 100 条' })
    const undersized = structuredClone(rawContent)
    undersized.content.tasks = undersized.content.tasks.slice(0, 99)
    expect(validateContent(undersized, 'production').issues).toContainEqual({ path: '$.content.tasks', message: '活跃任务不得少于 100 条' })
  })

  it('rejects a nighttime outdoor quest when a visibility boundary is removed', () => {
    const unsafe = structuredClone(rawContent)
    const nightQuest = unsafe.content.tasks.find(({ questId }) => questId === 'quest-night-lamppost-shadow-boss')
    if (!nightQuest) throw new Error('fixture requires a nighttime quest')
    nightQuest.safetyTags = nightQuest.safetyTags.filter((tag) => tag !== 'well-lit-only')
    expect(validateContent(unsafe, 'production').issues).toContainEqual({ path: `$.content.tasks[${unsafe.content.tasks.indexOf(nightQuest)}].safetyTags`, message: '夜间户外任务缺少 well-lit-only' })
  })
})
