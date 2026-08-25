import { describe, expect, it } from 'vitest'
import {
  GUIDE_STORAGE_KEY,
  clearGuideState,
  isGuideUnseen,
  markGuideDismissed,
} from './guideState'

class MemoryStorage {
  values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

describe('Wenshan guide version state', () => {
  it.each([
    ['no saved state', null],
    ['malformed JSON', '{'],
    ['an older guide version', JSON.stringify({ guideVersion: 0, dismissed: true })],
    ['an incomplete state', JSON.stringify({ guideVersion: 1 })],
  ])('shows the guide for %s', (_name, stored) => {
    const storage = new MemoryStorage()
    if (stored !== null) storage.setItem(GUIDE_STORAGE_KEY, stored)

    expect(isGuideUnseen(storage)).toBe(true)
  })

  it('persists only the current version and dismissed flag', () => {
    const storage = new MemoryStorage()
    markGuideDismissed(storage)

    expect(JSON.parse(storage.getItem(GUIDE_STORAGE_KEY)!)).toEqual({
      guideVersion: 1,
      dismissed: true,
    })
    expect(isGuideUnseen(storage)).toBe(false)
  })

  it('keeps the guide recoverable when browser storage is unavailable', () => {
    const unavailable = {
      getItem() { throw new Error('blocked') },
      setItem() { throw new Error('blocked') },
      removeItem() { throw new Error('blocked') },
    }

    expect(isGuideUnseen(unavailable)).toBe(true)
  })

  it('clears only the guide key', () => {
    const storage = new MemoryStorage()
    storage.setItem(GUIDE_STORAGE_KEY, '{}')
    storage.setItem('xhs-tool:another:state:v1', 'keep')

    clearGuideState(storage)

    expect(storage.getItem(GUIDE_STORAGE_KEY)).toBeNull()
    expect(storage.getItem('xhs-tool:another:state:v1')).toBe('keep')
  })
})
