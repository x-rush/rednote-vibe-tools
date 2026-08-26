import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { loadContent } from '../content/validate'
import { generateChecklist, setEntryChecked } from '../domain/checklist'
import {
  diffChecklists,
  getCriticalRemaining,
  getLocationRoute,
  getScenarioQuestions,
  groupChecklist,
} from './checklistView'

const content = loadContent(rawContent)
const checklist = generateChecklist({
  scenarioId: 'scenario-short-trip',
  conditions: { overnight: true },
}, content)

describe('checklist view models', () => {
  it('resolves scenario questions and definitions in configured order', () => {
    const scenario = content.content.scenarios.find((item) => item.scenarioId === 'scenario-short-trip')
    expect(scenario).toBeDefined()
    const resolved = getScenarioQuestions(scenario!, content.content)

    expect(resolved.map((item) => item.question.questionId)).toEqual(scenario!.questionIds)
    expect(resolved.map((item) => item.definition.key)).toEqual([
      'overnight',
      'transport',
      'outdoor-activity',
      'reservation',
    ])
  })

  it('groups one shared entry set without duplicate IDs', () => {
    for (const mode of ['priority', 'category', 'location'] as const) {
      const groups = groupChecklist(
        checklist,
        mode,
        content.content.categories,
        content.content.locations,
      )
      const entryIds = groups.flatMap((group) => group.entries.map((entry) => entry.entryId))

      expect(new Set(entryIds).size).toBe(entryIds.length)
      expect(entryIds).toHaveLength(checklist.entries.length)
    }
  })

  it('keeps only unchecked must entries in last-minute mode', () => {
    const checked = setEntryChecked(checklist, checklist.sections.must[0].entryId, true)
    const remaining = getCriticalRemaining(checked)

    expect(remaining.length).toBeGreaterThan(0)
    expect(remaining.every((entry) => !entry.checked && entry.priority === 'must')).toBe(true)
    expect(remaining.some((entry) => entry.entryType === 'confirmation')).toBe(true)
    expect(remaining.some((entry) => entry.priority === 'should')).toBe(false)
  })

  it('advances to the next unfinished location and stops when complete', () => {
    const route = getLocationRoute(checklist, content.content.locations)
    const firstCurrent = route.find((stop) => stop.current)
    expect(firstCurrent?.remaining).toBeGreaterThan(0)

    const currentCompleted = firstCurrent?.entries.reduce(
      (value, entry) => setEntryChecked(value, entry.entryId, true),
      checklist,
    ) ?? checklist
    const nextCurrent = getLocationRoute(currentCompleted, content.content.locations).find((stop) => stop.current)
    expect(nextCurrent?.id).not.toBe(firstCurrent?.id)

    const allChecked = checklist.entries.reduce(
      (value, entry) => setEntryChecked(value, entry.entryId, true),
      checklist,
    )
    expect(getLocationRoute(allChecked, content.content.locations).some((stop) => stop.current)).toBe(false)
  })

  it('reports added, removed, and preserved checked IDs independently', () => {
    const beforeGenerated = generateChecklist({
      scenarioId: 'scenario-commute',
      conditions: { rain: true },
    }, content)
    const before = setEntryChecked(beforeGenerated, 'phone', true)
    const after = generateChecklist({
      scenarioId: 'scenario-commute',
      conditions: { rain: false, battery: 'low' },
    }, content)
    const diff = diffChecklists(before, after)

    expect(diff.preservedCheckedIds).toEqual(['phone'])
    expect(diff.removed.map((entry) => entry.itemId)).toContain('umbrella')
    expect(diff.added.map((entry) => entry.itemId)).toEqual(expect.arrayContaining(['power-bank', 'cable']))
    expect(diff.next.entries.find((entry) => entry.itemId === 'phone')?.checked).toBe(true)
  })

  it('keeps custom entries when conditions are regenerated', () => {
    const source = checklist.entries[0]
    const custom = {
      ...source,
      entryId: 'custom-book',
      itemId: undefined,
      label: '给朋友的书',
      categoryId: 'category-custom',
      locationId: 'location-desk',
      priority: 'should' as const,
      custom: true,
      checked: true,
    }
    const before = {
      ...checklist,
      entries: [...checklist.entries, custom],
      sections: { ...checklist.sections, should: [...checklist.sections.should, custom] },
    }
    const after = generateChecklist({
      scenarioId: 'scenario-short-trip',
      conditions: { overnight: false },
    }, content)

    expect(diffChecklists(before, after).next.entries).toContainEqual(custom)
    expect(diffChecklists(before, after).preservedCheckedIds).toContain(custom.entryId)
  })

  it('keeps stale custom metadata visible in fallback groups', () => {
    const source = checklist.entries[0]
    const custom = {
      ...source,
      entryId: 'custom-stale',
      itemId: undefined,
      categoryId: 'removed-category',
      locationId: 'removed-location',
      custom: true,
    }
    const withStaleCustom = { ...checklist, entries: [...checklist.entries, custom] }
    const categoryGroups = groupChecklist(withStaleCustom, 'category', content.content.categories, content.content.locations)
    const locationGroups = groupChecklist(withStaleCustom, 'location', content.content.categories, content.content.locations)

    expect(categoryGroups.find((group) => group.id === 'unmapped-custom')?.entries).toContain(custom)
    expect(locationGroups.find((group) => group.id === 'unplaced-custom')?.entries).toContain(custom)
  })
})
