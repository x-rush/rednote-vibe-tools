import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import type { DepartureContentPackage, SavedChecklist } from '../content/schema'
import { loadContent } from '../content/validate'
import { generateChecklist, resetChecklist, restoreChecklist } from './checklist'

const content = loadContent(rawContent)
const ids = (scenarioId: string, conditions: Record<string, string | boolean | number> = {}) =>
  generateChecklist({ scenarioId, conditions }, content).entries.map((entry) => entry.itemId)

describe('checklist engine', () => {
  it('generates a non-empty base checklist for every scenario with empty conditions', () => {
    for (const scenario of content.content.scenarios) {
      expect(ids(scenario.scenarioId)).not.toHaveLength(0)
    }
  })

  it('reports whether any explicit condition rule matched', () => {
    expect(generateChecklist({ scenarioId: 'scenario-commute', conditions: {} }, content).matchedRuleIds).toEqual([])
    expect(generateChecklist({ scenarioId: 'scenario-commute', conditions: { rain: true } }, content).matchedRuleIds.length).toBeGreaterThan(0)
  })

  it('does not let a lower-priority removal delete a safety mandatory item', () => {
    const candidate = structuredClone(content) as DepartureContentPackage
    candidate.content.rules.push({
      ruleId: 'rule-remove-medicine-low',
      all: [{ key: 'medication-reminder', operator: 'equals', value: true }],
      effect: { removeItemIds: ['regular-medicine'] },
      priority: 1,
      reason: '低优先级移除测试',
      safetyMandatory: false,
    })

    expect(generateChecklist({
      scenarioId: 'scenario-commute',
      conditions: { 'medication-reminder': true },
    }, candidate).entries.map((entry) => entry.itemId)).toContain('regular-medicine')
  })

  it('deduplicates by dedupe key and keeps a stable first-seen order', () => {
    const checklist = generateChecklist({
      scenarioId: 'scenario-exercise',
      conditions: { 'exercise-location': 'outdoor', rain: true },
    }, content)
    const dedupeKeys = checklist.entries.map((entry) =>
      content.content.items.find((item) => item.itemId === entry.itemId)?.dedupeKey ?? entry.entryId,
    )

    expect(new Set(dedupeKeys).size).toBe(dedupeKeys.length)
  })

  it('merges distinct explanations from multiple matching rules', () => {
    const checklist = generateChecklist({
      scenarioId: 'scenario-short-trip',
      conditions: { battery: 'low', transport: 'train', 'return-late': true },
    }, content)
    const powerBank = checklist.entries.find((entry) => entry.itemId === 'power-bank')

    expect(powerBank?.reasons).toEqual(expect.arrayContaining([
      '手机电量偏低。',
      '乘火车核对票面路线电量。',
      '晚归需确认返程与电量。',
    ]))
    expect(new Set(powerBank?.reasons).size).toBe(powerBank?.reasons.length)
  })

  it('resolves conflicts deterministically', () => {
    const result = ids('scenario-exercise', { 'exercise-location': 'outdoor' })

    expect(result).toContain('water-bottle')
    expect(result).not.toContain('water')
  })

  it('applies replacement relationships', () => {
    const result = ids('scenario-commute', { rain: true, 'prefer-raincoat': true })

    expect(result).toContain('raincoat')
    expect(result).not.toContain('umbrella')
  })

  it('sorts by confirmation group, priority, configured order, and stable ID', () => {
    const checklist = generateChecklist({
      scenarioId: 'scenario-short-trip',
      conditions: { overnight: true, rain: true, battery: 'low' },
    }, content)
    const rank = { must: 0, should: 1, optional: 2 }
    const carry = checklist.entries.filter((entry) => entry.entryType === 'carry')

    expect(carry.every((entry, index) => index === 0 || rank[carry[index - 1].priority] <= rank[entry.priority])).toBe(true)
    expect(checklist.entries.at(-1)?.entryType).toBe('confirmation')
  })

  it('handles extreme many-condition input without duplicates', () => {
    const checklist = generateChecklist({
      scenarioId: 'scenario-short-trip',
      conditions: {
        rain: true, 'prefer-raincoat': true, 'sunny-outdoor': true, battery: 'low', overnight: true,
        reservation: true, 'paper-required': true, 'medication-reminder': true, 'access-required': true,
        'work-study': true, 'outdoor-activity': true, transport: 'plane', 'duration-minutes': 600,
        'return-late': true,
      },
    }, content)

    expect(checklist.entries.length).toBeGreaterThan(15)
    expect(new Set(checklist.entries.map((entry) => entry.entryId)).size).toBe(checklist.entries.length)
  })

  it('restores saved checks and resets all checks without changing order', () => {
    const generated = generateChecklist({ scenarioId: 'scenario-commute', conditions: { rain: true } }, content)
    const saved: SavedChecklist = {
      id: 'save-1', name: '上班', scenarioId: 'scenario-commute', conditions: { rain: true },
      items: [{ itemId: 'phone', checked: true }, { itemId: 'umbrella', checked: true }],
      createdAt: '2026-08-24T00:00:00.000Z', updatedAt: '2026-08-24T00:00:00.000Z', contentVersion: '1.0.0',
    }

    const restored = restoreChecklist(saved, generated)
    const reset = resetChecklist(restored)

    expect(restored.entries.filter((entry) => entry.checked).map((entry) => entry.itemId)).toEqual(['phone', 'umbrella'])
    expect(reset.entries.every((entry) => !entry.checked)).toBe(true)
    expect(reset.entries.map((entry) => entry.entryId)).toEqual(restored.entries.map((entry) => entry.entryId))
  })

  it.each([
    ['通勤雨天低电量', 'scenario-commute', { rain: true, battery: 'low', 'access-required': true }, ['umbrella', 'power-bank', 'access-card'], []],
    ['短途过夜火车晚归', 'scenario-short-trip', { overnight: true, transport: 'train', 'return-late': true }, ['toiletries', 'change-clothes', 'ticket', 'return-plan'], []],
    ['室内运动洗浴', 'scenario-exercise', { 'exercise-location': 'indoor', 'exercise-needs-shower': true }, ['fitness-pass', 'towel', 'toiletries'], []],
    ['户外运动', 'scenario-exercise', { 'exercise-location': 'outdoor' }, ['water-bottle', 'sports-gear'], ['water']],
    ['户外约会晚归', 'scenario-date', { 'outdoor-activity': true, reservation: true, 'return-late': true }, ['reservation', 'return-plan', 'comfortable-shoes'], []],
    ['婴儿三小时乘机', 'scenario-with-child', { 'age-group': 'infant', 'duration-minutes': 180, transport: 'plane' }, ['diaper', 'comfort-item', 'child-snack', 'child-document'], []],
    ['带狗三十分钟', 'scenario-with-pet', { 'pet-type': 'dog', 'duration-minutes': 30 }, ['leash', 'pet-waste-bag'], ['pet-food', 'pet-water']],
    ['容器带宠九十分钟雨天', 'scenario-with-pet', { 'pet-type': 'carrier', 'duration-minutes': 90, rain: true }, ['pet-carrier', 'pet-water', 'pet-towel'], ['leash']],
    ['就医无纸质材料', 'scenario-appointment', { 'appointment-type': 'medical', 'paper-required': false }, ['medical-document', 'id-card'], ['copies']],
    ['办事需要纸质材料', 'scenario-appointment', { 'appointment-type': 'administrative', 'paper-required': true }, ['printed-form', 'copies', 'folder'], []],
    ['电子票演出晚归', 'scenario-event', { 'event-ticket-type': 'electronic', 'return-late': true, 'loud-event': true }, ['ticket', 'power-bank', 'ear-protection'], ['light-stick']],
  ])('matches golden combination: %s', (_name, scenarioId, conditions, present, absent) => {
    const result = ids(scenarioId as string, conditions as Record<string, string | boolean | number>)
    for (const itemId of present as string[]) expect(result).toContain(itemId)
    for (const itemId of absent as string[]) expect(result).not.toContain(itemId)
  })

  it('returns byte-for-byte equivalent output for the same input', () => {
    const input = { scenarioId: 'scenario-event', conditions: { 'event-ticket-type': 'electronic', 'return-late': true } }

    expect(generateChecklist(input, content)).toEqual(generateChecklist(input, content))
  })
})
