import { describe, expect, it } from 'vitest'
import { clearLauncher, loadLauncher, saveLauncher, type KeyValueStorage } from './launcher'

class MemoryKeys implements KeyValueStorage {
  values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

describe('launcher localStorage envelope', () => {
  it('round-trips settings and removes only the exact project key', () => {
    const storage = new MemoryKeys()
    storage.setItem('xhs-tool:other:state:v1', 'keep')
    saveLauncher(storage, { activeSaveId: 'save-one', settings: { muted: true, reducedMotion: false } })
    expect(loadLauncher(storage)).toEqual({ activeSaveId: 'save-one', settings: { muted: true, reducedMotion: false } })
    clearLauncher(storage)
    expect(storage.getItem('xhs-tool:other:state:v1')).toBe('keep')
  })

  it('falls back safely from corrupt JSON', () => {
    const storage = new MemoryKeys()
    storage.setItem('xhs-tool:bianjing:state:v1', '{bad')
    expect(loadLauncher(storage)).toEqual({ settings: { muted: false, reducedMotion: false } })
  })
})
