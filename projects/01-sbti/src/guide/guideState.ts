import type { StorageLike } from '../storage/storage'

export const GUIDE_STORAGE_KEY = 'xhs-tool:shbti:guide:v1'
const LEGACY_GUIDE_STORAGE_KEY = ['xhs-tool:s', 'bti:guide:v1'].join('')
const CURRENT_GUIDE_VERSION = 1

type StoredGuideState = {
  guideVersion: number
  dismissed: boolean
}

function loadGuideState(storage: StorageLike): StoredGuideState | undefined {
  let stored: string | null
  let fromLegacy = false
  try {
    stored = storage.getItem(GUIDE_STORAGE_KEY)
    if (stored === null) {
      fromLegacy = true
      stored = storage.getItem(LEGACY_GUIDE_STORAGE_KEY)
    }
  } catch {
    return undefined
  }
  if (stored === null) return undefined
  let value: unknown
  try { value = JSON.parse(stored) }
  catch { return undefined }
  if (
    typeof value !== 'object'
    || value === null
    || !('guideVersion' in value)
    || !('dismissed' in value)
    || typeof value.guideVersion !== 'number'
    || typeof value.dismissed !== 'boolean'
  ) return undefined
  const state = value as StoredGuideState
  if (fromLegacy) {
    try {
      storage.setItem(GUIDE_STORAGE_KEY, JSON.stringify(state))
      storage.removeItem(LEGACY_GUIDE_STORAGE_KEY)
    } catch { /* keep the valid legacy state for a later retry */ }
  }
  return state
}

export function isGuideUnseen(storage: StorageLike) {
  const state = loadGuideState(storage)
  return state?.guideVersion !== CURRENT_GUIDE_VERSION || state.dismissed !== true
}

export function markGuideDismissed(storage: StorageLike) {
  storage.setItem(GUIDE_STORAGE_KEY, JSON.stringify({
    guideVersion: CURRENT_GUIDE_VERSION,
    dismissed: true,
  } satisfies StoredGuideState))
}

export function clearGuideState(storage: StorageLike) {
  storage.removeItem(GUIDE_STORAGE_KEY)
  storage.removeItem(LEGACY_GUIDE_STORAGE_KEY)
}
