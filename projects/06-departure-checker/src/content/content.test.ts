import { describe, expect, it } from 'vitest'
import content from './content.json'
import { validateContent } from './validate'

const validFixture = {
  schemaVersion: 1,
  contentVersion: '1.0.0',
  projectId: 'departure-checker',
  meta: { title: '出门检查官', locale: 'zh-CN', updatedAt: '2026-08-23' },
  sources: [],
  content: {
    categories: [{ categoryId: 'category-essentials', label: '随身关键', sortOrder: 1, iconAssetId: 'icon-category-essentials' }],
    locations: [{ locationId: 'location-entryway', label: '玄关', sortOrder: 1, iconAssetId: 'icon-location-entryway' }],
    conditionDefinitions: [{ key: 'rain', label: '天气', inputType: 'boolean' }],
    scenarioQuestions: [{ questionId: 'question-rain', conditionKey: 'rain', prompt: '会下雨吗？', required: false }],
    scenarios: [{
      scenarioId: 'scenario-commute',
      name: '日常通勤',
      description: '工作日快速检查',
      iconAssetId: 'icon-scenario-commute',
      baseItemIds: ['phone'],
      questionIds: ['question-rain'],
      sortOrder: 1,
    }],
    items: [{
      itemId: 'phone',
      label: '手机',
      categoryId: 'category-essentials',
      locationId: 'location-entryway',
      entryType: 'carry',
      defaultPriority: 'must',
      dedupeKey: 'phone',
      hint: '出门前确认手机在身边',
      suggestedReason: '用于联系和查看行程',
      safetyTags: ['communication'],
      iconAssetId: 'icon-item-phone',
      officialNoticeRequired: false,
      sortOrder: 1,
      version: 1,
    }],
    rules: [{
      ruleId: 'rule-rain-phone',
      scenarioIds: ['scenario-commute'],
      all: [{ key: 'rain', operator: 'equals', value: true }],
      effect: { addItemIds: ['phone'] },
      priority: 10,
      reason: '雨天也要保持联络',
      safetyMandatory: false,
    }],
  },
} as const

const cloneFixture = (): unknown => structuredClone(validFixture)

describe('content validation', () => {
  it('accepts a complete envelope fixture', () => {
    expect(validateContent(validFixture, 'envelope')).toEqual({ success: true, issues: [] })
  })

  it('reports duplicate IDs and missing rule references with JSON paths', () => {
    const candidate = cloneFixture() as Record<string, any>
    candidate.content.items.push({ ...candidate.content.items[0] })
    candidate.content.rules[0].effect.addItemIds = ['missing-item']

    const result = validateContent(candidate, 'envelope')

    expect(result.success).toBe(false)
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'content.items[1].itemId', code: 'duplicate-id' }),
      expect.objectContaining({ path: 'content.rules[0].effect.addItemIds[0]', code: 'missing-reference' }),
    ]))
  })

  it('rejects illegal condition codes and priorities', () => {
    const candidate = cloneFixture() as Record<string, any>
    candidate.content.rules[0].all[0].key = 'unknown-condition'
    candidate.content.items[0].defaultPriority = 'urgent'

    const result = validateContent(candidate, 'envelope')

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'content.rules[0].all[0].key', code: 'invalid-condition' }),
      expect.objectContaining({ path: 'content.items[0].defaultPriority', code: 'invalid-enum' }),
    ]))
  })

  it('requires reasons for mandatory safety items and a uniform icon asset ID', () => {
    const candidate = cloneFixture() as Record<string, any>
    candidate.content.items[0].suggestedReason = ' '
    candidate.content.items[0].iconAssetId = '/images/phone.png'

    const result = validateContent(candidate, 'envelope')

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'content.items[0].suggestedReason', code: 'required-reason' }),
      expect.objectContaining({ path: 'content.items[0].iconAssetId', code: 'invalid-asset-id' }),
    ]))
  })

  it('rejects direct and indirect replacement cycles', () => {
    const candidate = cloneFixture() as Record<string, any>
    const second = { ...candidate.content.items[0], itemId: 'backup-phone', dedupeKey: 'backup-phone' }
    candidate.content.items.push(second)
    candidate.content.rules[0].effect.replacements = [
      { replaceItemId: 'phone', withItemId: 'backup-phone' },
      { replaceItemId: 'backup-phone', withItemId: 'phone' },
    ]

    const result = validateContent(candidate, 'envelope')

    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'replacement-cycle' }))
  })

  it('requires every production scenario to be able to generate an item', () => {
    const candidate = cloneFixture() as Record<string, any>
    candidate.content.scenarios[0].baseItemIds = []
    candidate.content.rules = []

    const result = validateContent(candidate, 'production')

    expect(result.issues).toContainEqual(expect.objectContaining({
      path: 'content.scenarios[0]',
      code: 'empty-scenario',
    }))
  })

  it('validates the shipped package in production mode', () => {
    const result = validateContent(content, 'production')

    expect(result.success).toBe(true)
    expect(content.content.scenarios).toHaveLength(8)
    expect(content.content.items.length).toBeGreaterThanOrEqual(60)
    expect(content.content.items.length).toBeLessThanOrEqual(90)
  })
})
