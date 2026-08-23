import type {
  ChecklistEntry,
  ChecklistItem,
  ChecklistPriority,
  ConditionValue,
  DepartureContentPackage,
  GeneratedChecklist,
  SavedChecklist,
} from '../content/schema'
import { ruleMatches } from '../content/validate'

export type GenerateChecklistInput = {
  scenarioId: string
  conditions: Record<string, ConditionValue | ConditionValue[]>
}

type Candidate = {
  item: ChecklistItem
  reasons: string[]
  sourceRuleIds: string[]
  protectionPriority: number
  firstSeen: number
  priority: ChecklistPriority
}

const PRIORITY_RANK: Record<ChecklistPriority, number> = { must: 0, should: 1, optional: 2 }

const appendUnique = (target: string[], values: string[]) => {
  for (const value of values) {
    if (value && !target.includes(value)) target.push(value)
  }
}

const buildSections = (entries: ChecklistEntry[]): GeneratedChecklist['sections'] => ({
  must: entries.filter((entry) => entry.entryType === 'carry' && entry.priority === 'must'),
  should: entries.filter((entry) => entry.entryType === 'carry' && entry.priority === 'should'),
  optional: entries.filter((entry) => entry.entryType === 'carry' && entry.priority === 'optional'),
  confirmations: entries.filter((entry) => entry.entryType === 'confirmation'),
})

const toEntry = (candidate: Candidate): ChecklistEntry => ({
  entryId: candidate.item.itemId,
  itemId: candidate.item.itemId,
  label: candidate.item.label,
  categoryId: candidate.item.categoryId,
  locationId: candidate.item.locationId,
  entryType: candidate.item.entryType,
  priority: candidate.priority,
  reasons: candidate.reasons,
  hint: candidate.item.hint,
  safetyTags: candidate.item.safetyTags,
  iconAssetId: candidate.item.iconAssetId,
  officialNoticeRequired: candidate.item.officialNoticeRequired,
  checked: false,
  sourceRuleIds: candidate.sourceRuleIds,
  sortOrder: candidate.item.sortOrder,
  custom: false,
})

export const generateChecklist = (
  input: GenerateChecklistInput,
  contentPackage: DepartureContentPackage,
): GeneratedChecklist => {
  const { content } = contentPackage
  const scenario = content.scenarios.find((candidate) => candidate.scenarioId === input.scenarioId)
  if (!scenario) throw new Error(`未知场景：${input.scenarioId}`)

  const itemIndex = new Map(content.items.map((item) => [item.itemId, item]))
  const matchedRules = content.rules
    .filter((rule) => ruleMatches(rule, input.scenarioId, input.conditions))
    .sort((left, right) => left.priority - right.priority || left.ruleId.localeCompare(right.ruleId))
  const rawCandidates = new Map<string, Candidate>()
  let sequence = 0

  const addItem = (itemId: string, reason?: string, ruleId?: string, safetyPriority = -1) => {
    const item = itemIndex.get(itemId)
    if (!item) return
    const existing = rawCandidates.get(itemId)
    if (existing) {
      if (reason) appendUnique(existing.reasons, [reason])
      if (ruleId) appendUnique(existing.sourceRuleIds, [ruleId])
      existing.protectionPriority = Math.max(existing.protectionPriority, safetyPriority)
      return
    }
    rawCandidates.set(itemId, {
      item,
      reasons: [item.suggestedReason, ...(reason ? [reason] : [])],
      sourceRuleIds: ruleId ? [ruleId] : [],
      protectionPriority: safetyPriority,
      firstSeen: sequence++,
      priority: safetyPriority >= 0 ? 'must' : item.defaultPriority,
    })
  }

  for (const itemId of scenario.baseItemIds) addItem(itemId)
  for (const rule of matchedRules) {
    for (const itemId of rule.effect.addItemIds ?? []) {
      addItem(itemId, rule.reason, rule.ruleId, rule.safetyMandatory ? rule.priority : -1)
    }
  }

  const preferredIds = new Set<string>()
  for (const rule of [...matchedRules].reverse()) {
    for (const replacement of rule.effect.replacements ?? []) preferredIds.add(replacement.withItemId)
    for (const conflict of rule.effect.conflicts ?? []) preferredIds.add(conflict.keepItemId)
  }
  const deduped = new Map<string, Candidate>()
  for (const candidate of [...rawCandidates.values()].sort((left, right) => left.firstSeen - right.firstSeen)) {
    const key = candidate.item.dedupeKey
    const existing = deduped.get(key)
    if (!existing) {
      deduped.set(key, candidate)
      continue
    }
    const useCandidate = preferredIds.has(candidate.item.itemId) && !preferredIds.has(existing.item.itemId)
    const target = useCandidate ? candidate : existing
    const merged = useCandidate ? existing : candidate
    appendUnique(target.reasons, merged.reasons)
    appendUnique(target.sourceRuleIds, merged.sourceRuleIds)
    target.protectionPriority = Math.max(target.protectionPriority, merged.protectionPriority)
    target.firstSeen = Math.min(target.firstSeen, merged.firstSeen)
    deduped.set(key, target)
  }
  const selected = new Map([...deduped.values()].map((candidate) => [candidate.item.itemId, candidate]))

  const canRemove = (candidate: Candidate, rulePriority: number) =>
    candidate.protectionPriority < 0 || rulePriority >= candidate.protectionPriority

  for (const rule of [...matchedRules].reverse()) {
    for (const itemId of rule.effect.removeItemIds ?? []) {
      const candidate = selected.get(itemId)
      if (candidate && canRemove(candidate, rule.priority)) selected.delete(itemId)
    }
    for (const replacement of rule.effect.replacements ?? []) {
      const replaced = selected.get(replacement.replaceItemId)
      if (!replaced || !canRemove(replaced, rule.priority)) continue
      selected.delete(replacement.replaceItemId)
      addItem(replacement.withItemId, rule.reason, rule.ruleId, rule.safetyMandatory ? rule.priority : -1)
      const target = rawCandidates.get(replacement.withItemId)
      if (target) {
        appendUnique(target.reasons, replaced.reasons)
        appendUnique(target.sourceRuleIds, replaced.sourceRuleIds)
        target.firstSeen = Math.min(target.firstSeen, replaced.firstSeen)
        selected.set(replacement.withItemId, target)
      }
    }
    for (const conflict of rule.effect.conflicts ?? []) {
      if (!selected.has(conflict.keepItemId)) continue
      for (const itemId of conflict.itemIds) {
        if (itemId === conflict.keepItemId) continue
        const candidate = selected.get(itemId)
        if (candidate && canRemove(candidate, rule.priority)) selected.delete(itemId)
      }
      const kept = selected.get(conflict.keepItemId)
      if (kept) {
        appendUnique(kept.reasons, [rule.reason])
        appendUnique(kept.sourceRuleIds, [rule.ruleId])
      }
    }
  }

  type PriorityProposal = { value: ChecklistPriority; rulePriority: number }
  const proposals = new Map<string, PriorityProposal>()
  for (const rule of matchedRules) {
    for (const change of [...(rule.effect.upgrades ?? []), ...(rule.effect.downgrades ?? [])]) {
      const current = proposals.get(change.itemId)
      if (!current || rule.priority > current.rulePriority ||
          (rule.priority === current.rulePriority && PRIORITY_RANK[change.priority] < PRIORITY_RANK[current.value])) {
        proposals.set(change.itemId, { value: change.priority, rulePriority: rule.priority })
      }
    }
  }
  for (const candidate of selected.values()) {
    if (candidate.protectionPriority >= 0) {
      candidate.priority = 'must'
    } else {
      candidate.priority = proposals.get(candidate.item.itemId)?.value ?? candidate.item.defaultPriority
    }
  }

  const entries = [...selected.values()]
    .sort((left, right) => {
      const leftType = left.item.entryType === 'confirmation' ? 1 : 0
      const rightType = right.item.entryType === 'confirmation' ? 1 : 0
      return leftType - rightType ||
        PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority] ||
        left.item.sortOrder - right.item.sortOrder ||
        left.firstSeen - right.firstSeen ||
        left.item.itemId.localeCompare(right.item.itemId)
    })
    .map(toEntry)

  return {
    scenarioId: input.scenarioId,
    contentVersion: contentPackage.contentVersion,
    conditions: structuredClone(input.conditions),
    entries,
    sections: buildSections(entries),
  }
}

export const restoreChecklist = (
  saved: SavedChecklist,
  generated: GeneratedChecklist,
): GeneratedChecklist => {
  const checkedById = new Map(
    saved.items.filter((item) => item.itemId).map((item) => [item.itemId as string, item.checked]),
  )
  const entries = generated.entries.map((entry) => ({
    ...entry,
    checked: entry.itemId ? (checkedById.get(entry.itemId) ?? false) : false,
  }))
  saved.items.forEach((item, index) => {
    if (item.itemId || !item.customLabel?.trim()) return
    const label = item.customLabel.trim().slice(0, 30)
    entries.push({
      entryId: `custom-${index}-${label}`,
      label,
      categoryId: item.customCategoryId ?? 'category-custom',
      locationId: item.customLocationId ?? 'location-entryway',
      entryType: 'carry',
      priority: item.customPriority ?? 'optional',
      reasons: ['你添加的自定义项目'],
      hint: '自定义项目只在本机保存短文本',
      safetyTags: [],
      iconAssetId: 'icon-item-custom',
      officialNoticeRequired: false,
      checked: item.checked,
      sourceRuleIds: [],
      sortOrder: 10000 + index,
      custom: true,
    })
  })
  return { ...generated, entries, sections: buildSections(entries) }
}

export const resetChecklist = (checklist: GeneratedChecklist): GeneratedChecklist => {
  const entries = checklist.entries.map((entry) => ({ ...entry, checked: false }))
  return { ...checklist, entries, sections: buildSections(entries) }
}

export const setEntryChecked = (
  checklist: GeneratedChecklist,
  entryId: string,
  checked: boolean,
): GeneratedChecklist => {
  const entries = checklist.entries.map((entry) => entry.entryId === entryId ? { ...entry, checked } : entry)
  return { ...checklist, entries, sections: buildSections(entries) }
}
