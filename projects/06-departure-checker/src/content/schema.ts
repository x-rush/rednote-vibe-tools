export type ContentLocale = 'zh-CN'
export type ChecklistPriority = 'must' | 'should' | 'optional'
export type ChecklistEntryType = 'carry' | 'confirmation'
export type ConditionKey = string
export type ConditionValue = string | boolean | number
export type ConditionInputType = 'boolean' | 'single' | 'multiple' | 'number'
export type RuleOperator = 'equals' | 'not-equals' | 'gt' | 'gte' | 'lt' | 'lte' | 'includes' | 'truthy'

export type ContentMeta = {
  title: string
  locale: ContentLocale
  updatedAt: string
}

export type SourceRecord = {
  id: string
  title: string
  level: 'A' | 'B' | 'C' | 'F'
  note?: string
}

export type ChecklistCategory = {
  categoryId: string
  label: string
  sortOrder: number
  iconAssetId: string
}

export type ChecklistLocation = {
  locationId: string
  label: string
  sortOrder: number
  iconAssetId: string
}

export type ConditionOption = {
  value: ConditionValue
  label: string
}

export type ConditionDefinition = {
  key: ConditionKey
  label: string
  inputType: ConditionInputType
  options?: ConditionOption[]
  min?: number
  max?: number
}

export type ScenarioQuestion = {
  questionId: string
  conditionKey: ConditionKey
  prompt: string
  helpText?: string
  required: boolean
}

export type Scenario = {
  scenarioId: string
  name: string
  description: string
  iconAssetId: string
  baseItemIds: string[]
  questionIds: string[]
  sortOrder: number
}

export type ChecklistItem = {
  itemId: string
  label: string
  categoryId: string
  locationId: string
  entryType: ChecklistEntryType
  defaultPriority: ChecklistPriority
  dedupeKey: string
  hint: string
  suggestedReason: string
  safetyTags: string[]
  iconAssetId: string
  officialNoticeRequired: boolean
  sortOrder: number
  version: number
}

export type RuleCondition = {
  key: ConditionKey
  operator: RuleOperator
  value?: ConditionValue | ConditionValue[]
}

export type PriorityChange = {
  itemId: string
  priority: ChecklistPriority
}

export type ReplacementEffect = {
  replaceItemId: string
  withItemId: string
}

export type ConflictEffect = {
  itemIds: string[]
  keepItemId: string
}

export type RuleEffect = {
  addItemIds?: string[]
  removeItemIds?: string[]
  upgrades?: PriorityChange[]
  downgrades?: PriorityChange[]
  replacements?: ReplacementEffect[]
  conflicts?: ConflictEffect[]
}

export type ChecklistRule = {
  ruleId: string
  scenarioIds?: string[]
  all?: RuleCondition[]
  any?: RuleCondition[]
  effect: RuleEffect
  priority: number
  reason: string
  safetyMandatory: boolean
}

export type DepartureContent = {
  categories: ChecklistCategory[]
  locations: ChecklistLocation[]
  conditionDefinitions: ConditionDefinition[]
  scenarioQuestions: ScenarioQuestion[]
  scenarios: Scenario[]
  items: ChecklistItem[]
  rules: ChecklistRule[]
}

export type DepartureContentPackage = {
  schemaVersion: 1
  contentVersion: string
  projectId: 'departure-checker'
  meta: ContentMeta
  sources: SourceRecord[]
  content: DepartureContent
}

export type ChecklistEntry = {
  entryId: string
  itemId?: string
  label: string
  categoryId: string
  locationId: string
  entryType: ChecklistEntryType
  priority: ChecklistPriority
  reasons: string[]
  hint: string
  safetyTags: string[]
  iconAssetId: string
  officialNoticeRequired: boolean
  checked: boolean
  sourceRuleIds: string[]
  sortOrder: number
  custom: boolean
}

export type GeneratedChecklist = {
  scenarioId: string
  contentVersion: string
  conditions: Record<ConditionKey, ConditionValue | ConditionValue[]>
  entries: ChecklistEntry[]
  sections: {
    must: ChecklistEntry[]
    should: ChecklistEntry[]
    optional: ChecklistEntry[]
    confirmations: ChecklistEntry[]
  }
}

export type SavedChecklistItem = {
  itemId?: string
  checked: boolean
  customLabel?: string
  customPriority?: ChecklistPriority
  customCategoryId?: string
  customLocationId?: string
}

export type SavedChecklist = {
  id: string
  name: string
  scenarioId: string
  conditions: Record<ConditionKey, ConditionValue | ConditionValue[]>
  items: SavedChecklistItem[]
  createdAt: string
  updatedAt: string
  contentVersion: string
}

export type StoragePayload = {
  schemaVersion: 1
  contentVersion: string
  activeChecklistId?: string
  savedChecklists: SavedChecklist[]
  updatedAt: string
}
