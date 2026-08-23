import type {
  ConditionValue,
  DepartureContentPackage,
  SavedChecklist,
  SavedChecklistItem,
  StoragePayload,
} from '../content/schema'

export const STORAGE_KEY = 'xhs-tool:departure-checker:state:v1'
export const MAX_SAVED_CHECKLISTS = 3
const MAX_ITEMS_PER_CHECKLIST = 200

export type StorageLike = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type StorageLoadStatus = 'empty' | 'ok' | 'recovered' | 'corrupt' | 'unsupported-version'

export type StorageLoadResult = {
  status: StorageLoadStatus
  payload: StoragePayload
  recoverableRaw?: string
}

export type StorageWriteResult =
  | { ok: true }
  | { ok: false; error: 'storage-corrupt' | 'invalid-data' | 'write-failed' }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const emptyPayload = (contentVersion: string): StoragePayload => ({
  schemaVersion: 1,
  contentVersion,
  savedChecklists: [],
  updatedAt: '1970-01-01T00:00:00.000Z',
})

const isConditionValue = (value: unknown): value is ConditionValue | ConditionValue[] =>
  typeof value === 'string' || typeof value === 'boolean' || Number.isFinite(value) ||
  (Array.isArray(value) && value.length <= 50 && value.every((item) =>
    typeof item === 'string' || typeof item === 'boolean' || Number.isFinite(item),
  ))

const sanitizeItem = (value: unknown, itemIds: Set<string>): { item?: SavedChecklistItem; recovered: boolean } => {
  if (!isRecord(value) || typeof value.checked !== 'boolean') return { recovered: true }
  if (typeof value.itemId === 'string') {
    if (!itemIds.has(value.itemId)) return { recovered: true }
    return { item: { itemId: value.itemId, checked: value.checked }, recovered: false }
  }
  if (typeof value.customLabel !== 'string') return { recovered: true }
  const customLabel = value.customLabel.trim().slice(0, 30)
  if (!customLabel || /^(?:data:|blob:)/i.test(customLabel)) return { recovered: true }
  const priorities = new Set(['must', 'should', 'optional'])
  return {
    item: {
      checked: value.checked,
      customLabel,
      ...(typeof value.customPriority === 'string' && priorities.has(value.customPriority)
        ? { customPriority: value.customPriority as SavedChecklistItem['customPriority'] }
        : {}),
      ...(typeof value.customCategoryId === 'string' ? { customCategoryId: value.customCategoryId } : {}),
      ...(typeof value.customLocationId === 'string' ? { customLocationId: value.customLocationId } : {}),
    },
    recovered: customLabel !== value.customLabel,
  }
}

const sanitizeChecklist = (
  value: unknown,
  scenarioIds: Set<string>,
  itemIds: Set<string>,
): { checklist?: SavedChecklist; recovered: boolean } => {
  if (!isRecord(value) ||
      typeof value.id !== 'string' || !value.id ||
      typeof value.name !== 'string' || !value.name.trim() ||
      typeof value.scenarioId !== 'string' || !scenarioIds.has(value.scenarioId) ||
      !isRecord(value.conditions) || !Array.isArray(value.items) ||
      typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string' ||
      typeof value.contentVersion !== 'string') {
    return { recovered: true }
  }
  if (value.items.length > MAX_ITEMS_PER_CHECKLIST) return { recovered: true }
  const conditions: Record<string, ConditionValue | ConditionValue[]> = {}
  for (const [key, conditionValue] of Object.entries(value.conditions)) {
    if (!isConditionValue(conditionValue)) return { recovered: true }
    conditions[key] = conditionValue
  }
  let recovered = false
  const items: SavedChecklistItem[] = []
  for (const rawItem of value.items) {
    const result = sanitizeItem(rawItem, itemIds)
    recovered ||= result.recovered
    if (result.item) items.push(result.item)
  }
  const name = value.name.trim().slice(0, 40)
  recovered ||= name !== value.name
  return {
    checklist: {
      id: value.id,
      name,
      scenarioId: value.scenarioId,
      conditions,
      items,
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
      contentVersion: value.contentVersion,
    },
    recovered,
  }
}

const byMostRecent = (left: SavedChecklist, right: SavedChecklist) =>
  right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id)

export const createChecklistStorage = (storage: StorageLike, content: DepartureContentPackage) => {
  const scenarioIds = new Set(content.content.scenarios.map((scenario) => scenario.scenarioId))
  const itemIds = new Set(content.content.items.map((item) => item.itemId))

  const load = (): StorageLoadResult => {
    const fallback = emptyPayload(content.contentVersion)
    const raw = storage.getItem(STORAGE_KEY)
    if (raw === null) return { status: 'empty', payload: fallback }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return { status: 'corrupt', payload: fallback, recoverableRaw: raw }
    }
    if (!isRecord(parsed)) return { status: 'corrupt', payload: fallback, recoverableRaw: raw }
    if (typeof parsed.schemaVersion === 'number' && parsed.schemaVersion > 1) {
      return { status: 'unsupported-version', payload: fallback, recoverableRaw: raw }
    }
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.savedChecklists) ||
        typeof parsed.contentVersion !== 'string' || typeof parsed.updatedAt !== 'string') {
      return { status: 'corrupt', payload: fallback, recoverableRaw: raw }
    }
    let recovered = false
    const checklists: SavedChecklist[] = []
    for (const value of parsed.savedChecklists.slice(0, MAX_SAVED_CHECKLISTS)) {
      const result = sanitizeChecklist(value, scenarioIds, itemIds)
      recovered ||= result.recovered
      if (!result.checklist) return { status: 'corrupt', payload: fallback, recoverableRaw: raw }
      checklists.push(result.checklist)
    }
    recovered ||= parsed.savedChecklists.length > MAX_SAVED_CHECKLISTS
    checklists.sort(byMostRecent)
    const activeChecklistId = typeof parsed.activeChecklistId === 'string' &&
      checklists.some((checklist) => checklist.id === parsed.activeChecklistId)
      ? parsed.activeChecklistId
      : undefined
    if (parsed.activeChecklistId !== undefined && activeChecklistId === undefined) recovered = true
    return {
      status: recovered ? 'recovered' : 'ok',
      payload: {
        schemaVersion: 1,
        contentVersion: content.contentVersion,
        ...(activeChecklistId ? { activeChecklistId } : {}),
        savedChecklists: checklists,
        updatedAt: parsed.updatedAt,
      },
    }
  }

  const write = (payload: StoragePayload): StorageWriteResult => {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(payload))
      return { ok: true }
    } catch {
      return { ok: false, error: 'write-failed' }
    }
  }

  const save = (checklist: SavedChecklist): StorageWriteResult => {
    const current = load()
    if (current.status === 'corrupt' || current.status === 'unsupported-version') {
      return { ok: false, error: 'storage-corrupt' }
    }
    const sanitized = sanitizeChecklist(checklist, scenarioIds, itemIds)
    if (!sanitized.checklist || sanitized.recovered) return { ok: false, error: 'invalid-data' }
    const savedChecklists = current.payload.savedChecklists
      .filter((candidate) => candidate.id !== checklist.id)
      .concat(sanitized.checklist)
      .sort(byMostRecent)
      .slice(0, MAX_SAVED_CHECKLISTS)
    return write({
      schemaVersion: 1,
      contentVersion: content.contentVersion,
      activeChecklistId: checklist.id,
      savedChecklists,
      updatedAt: checklist.updatedAt,
    })
  }

  const remove = (checklistId: string): StorageWriteResult => {
    const current = load()
    if (current.status === 'corrupt' || current.status === 'unsupported-version') {
      return { ok: false, error: 'storage-corrupt' }
    }
    const savedChecklists = current.payload.savedChecklists.filter((checklist) => checklist.id !== checklistId)
    return write({
      schemaVersion: 1,
      contentVersion: content.contentVersion,
      ...(current.payload.activeChecklistId === checklistId ? {} :
        current.payload.activeChecklistId ? { activeChecklistId: current.payload.activeChecklistId } : {}),
      savedChecklists,
      updatedAt: new Date().toISOString(),
    })
  }

  const clear = () => storage.removeItem(STORAGE_KEY)

  return { load, save, remove, clear }
}
