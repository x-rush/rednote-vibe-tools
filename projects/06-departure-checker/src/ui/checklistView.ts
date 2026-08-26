import type {
  ChecklistCategory,
  ChecklistEntry,
  ChecklistLocation,
  ConditionDefinition,
  DepartureContent,
  GeneratedChecklist,
  Scenario,
  ScenarioQuestion,
} from '../content/schema'

export type ChecklistViewMode = 'priority' | 'category' | 'location'

export type ChecklistGroup = {
  id: string
  label: string
  iconAssetId?: string
  entries: ChecklistEntry[]
}

export type LocationStop = ChecklistGroup & {
  remaining: number
  complete: boolean
  current: boolean
}

export type ChecklistDiff = {
  next: GeneratedChecklist
  added: ChecklistEntry[]
  removed: ChecklistEntry[]
  preservedCheckedIds: string[]
}

export type ResolvedScenarioQuestion = {
  question: ScenarioQuestion
  definition: ConditionDefinition
}

export const getScenarioQuestions = (
  scenario: Scenario,
  content: DepartureContent,
): ResolvedScenarioQuestion[] => scenario.questionIds.flatMap((questionId) => {
  const question = content.scenarioQuestions.find((candidate) => candidate.questionId === questionId)
  if (!question) return []
  const definition = content.conditionDefinitions.find((candidate) => candidate.key === question.conditionKey)
  return definition ? [{ question, definition }] : []
})

const priorityGroups = (checklist: GeneratedChecklist): ChecklistGroup[] => [
  { id: 'must', label: '必带', entries: checklist.sections.must },
  { id: 'confirmations', label: '出门前确认', entries: checklist.sections.confirmations },
  { id: 'should', label: '建议携带', entries: checklist.sections.should },
  { id: 'optional', label: '视情况携带', entries: checklist.sections.optional },
].filter((group) => group.entries.length > 0)

const contentGroups = <T extends ChecklistCategory | ChecklistLocation>(
  entries: ChecklistEntry[],
  definitions: T[],
  idFor: (definition: T) => string,
  entryIdFor: (entry: ChecklistEntry) => string,
): ChecklistGroup[] => definitions
  .map((definition) => ({
    id: idFor(definition),
    label: definition.label,
    iconAssetId: definition.iconAssetId,
    entries: entries.filter((entry) => entryIdFor(entry) === idFor(definition)),
  }))
  .filter((group) => group.entries.length > 0)

const fallbackCustomGroup = <T extends ChecklistCategory | ChecklistLocation>(
  entries: ChecklistEntry[],
  definitions: T[],
  idFor: (definition: T) => string,
  entryIdFor: (entry: ChecklistEntry) => string,
  fallback: Omit<ChecklistGroup, 'entries'>,
): ChecklistGroup[] => {
  const knownIds = new Set(definitions.map(idFor))
  const unmatched = entries.filter((entry) => entry.custom && !knownIds.has(entryIdFor(entry)))
  return unmatched.length > 0 ? [{ ...fallback, entries: unmatched }] : []
}

export const groupChecklist = (
  checklist: GeneratedChecklist,
  mode: ChecklistViewMode,
  categories: ChecklistCategory[],
  locations: ChecklistLocation[],
): ChecklistGroup[] => {
  if (mode === 'priority') return priorityGroups(checklist)
  if (mode === 'category') {
    return [
      ...contentGroups(checklist.entries, categories, (category) => category.categoryId, (entry) => entry.categoryId),
      ...fallbackCustomGroup(
        checklist.entries,
        categories,
        (category) => category.categoryId,
        (entry) => entry.categoryId,
        { id: 'unmapped-custom', label: '未分类自定义', iconAssetId: 'icon-category-custom' },
      ),
    ]
  }
  return [
    ...contentGroups(checklist.entries, locations, (location) => location.locationId, (entry) => entry.locationId),
    ...fallbackCustomGroup(
      checklist.entries,
      locations,
      (location) => location.locationId,
      (entry) => entry.locationId,
      { id: 'unplaced-custom', label: '待归位' },
    ),
  ]
}

export const getCriticalRemaining = (checklist: GeneratedChecklist): ChecklistEntry[] =>
  checklist.entries.filter((entry) => entry.priority === 'must' && !entry.checked)

export const getLocationRoute = (
  checklist: GeneratedChecklist,
  locations: ChecklistLocation[],
): LocationStop[] => {
  const groups = groupChecklist(checklist, 'location', [], locations)
  const currentId = groups.find((group) => group.entries.some((entry) => !entry.checked))?.id

  return groups.map((group) => {
    const remaining = group.entries.filter((entry) => !entry.checked).length
    return {
      ...group,
      remaining,
      complete: remaining === 0,
      current: group.id === currentId,
    }
  })
}

const sectionsFor = (entries: ChecklistEntry[]): GeneratedChecklist['sections'] => ({
  must: entries.filter((entry) => entry.entryType === 'carry' && entry.priority === 'must'),
  should: entries.filter((entry) => entry.entryType === 'carry' && entry.priority === 'should'),
  optional: entries.filter((entry) => entry.entryType === 'carry' && entry.priority === 'optional'),
  confirmations: entries.filter((entry) => entry.entryType === 'confirmation'),
})

const stableId = (entry: ChecklistEntry) => entry.itemId ?? entry.entryId

export const diffChecklists = (
  before: GeneratedChecklist,
  generated: GeneratedChecklist,
): ChecklistDiff => {
  const beforeById = new Map(before.entries.map((entry) => [stableId(entry), entry]))
  const generatedIds = new Set(generated.entries.map(stableId))
  const generatedEntries = generated.entries.map((entry) => ({
    ...entry,
    checked: beforeById.get(stableId(entry))?.checked ?? false,
  }))
  const preservedCustom = before.entries.filter((entry) => entry.custom && !generatedIds.has(stableId(entry)))
  const entries = [...generatedEntries, ...preservedCustom]
  const next = { ...generated, entries, sections: sectionsFor(entries) }

  return {
    next,
    added: generated.entries.filter((entry) => !beforeById.has(stableId(entry))),
    removed: before.entries.filter((entry) => !entry.custom && !generatedIds.has(stableId(entry))),
    preservedCheckedIds: entries.filter((entry) => entry.checked).map(stableId),
  }
}
