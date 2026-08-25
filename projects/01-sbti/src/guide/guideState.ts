import type { StorageLike } from '../storage/storage'

export const GUIDE_STORAGE_KEY = 'xhs-tool:sbti:guide:v1'
const CURRENT_GUIDE_VERSION = 1

type StoredGuideState = {
  guideVersion: number
  dismissed: boolean
}

function loadGuideState(storage: StorageLike): StoredGuideState | undefined {
  try {
    const stored = storage.getItem(GUIDE_STORAGE_KEY)
    if (stored === null) return undefined
    const value: unknown = JSON.parse(stored)
    if (
      typeof value !== 'object'
      || value === null
      || !('guideVersion' in value)
      || !('dismissed' in value)
      || typeof value.guideVersion !== 'number'
      || typeof value.dismissed !== 'boolean'
    ) return undefined
    return value as StoredGuideState
  } catch {
    return undefined
  }
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
}
