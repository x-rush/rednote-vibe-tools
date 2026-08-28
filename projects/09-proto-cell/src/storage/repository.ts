import { createDefaultSave, decodeSave, encodeSave, type SaveDataV1, type SaveIssue, type SaveSettings } from './codec'

export type IndexedDbDriver = {
  open(): Promise<void>
  read(store: string, key: string): Promise<unknown>
  write(store: string, key: string, value: unknown): Promise<void>
  clear(store: string): Promise<void>
}

export type SettingsStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export type RepositoryMode = 'persistent' | 'session'
export type RepositoryResult = { mode: RepositoryMode; value: SaveDataV1; issues: SaveIssue[] }

export type GameRepository = {
  load(): Promise<RepositoryResult>
  save(value: SaveDataV1): Promise<RepositoryResult>
  clear(): Promise<void>
  exportJson(): Promise<string>
  importJson(raw: string): Promise<RepositoryResult>
  recoveryPayload(): unknown
}

const SETTINGS_KEY = 'proto-cell:settings'
const CURRENT_KEY = 'current'
const RECOVERY_KEY = 'rejected'

export function createRepository(
  driver: IndexedDbDriver = createBrowserIndexedDb(safeIndexedDb()),
  settingsStorage: SettingsStorage = safeSettingsStorage(),
): GameRepository {
  let mode: RepositoryMode = 'persistent'
  let current = createDefaultSave()
  let recovery: unknown
  let opened = false

  return {
    async load() {
      try {
        await ensureOpen()
        const rejected = await driver.read('recovery', RECOVERY_KEY)
        if (rejected !== undefined) recovery = safeRecoveryPayload(rejected)
        const raw = await driver.read('save', CURRENT_KEY)
        const settings = loadSettings(settingsStorage, current.settings)
        if (raw === undefined) {
          current = { ...createDefaultSave(), settings }
          return result([])
        }
        const decoded = decodeSave({ ...(isRecord(raw) ? raw : {}), settings })
        if (!decoded.value) {
          await preserve(raw, decoded.issues)
          mode = 'session'
          current = { ...createDefaultSave(), settings }
          return result(decoded.issues)
        }
        current = decoded.value
        mode = 'persistent'
        return result([])
      } catch (error) {
        mode = 'session'
        recovery = safeRecoveryPayload(recoveryFrom(error) ?? recovery ?? structuredClone(current))
        current = { ...current, settings: loadSettings(settingsStorage, current.settings) }
        return result([{ path: '$', code: 'storage-unavailable', message: 'persistent storage is unavailable' }])
      }
    },
    async save(value) {
      const decoded = decodeSave(value)
      if (!decoded.value) {
        await preserve(value, decoded.issues)
        return result(decoded.issues)
      }
      current = decoded.value
      saveSettings(settingsStorage, current.settings)
      if (mode === 'persistent') {
        try {
          await ensureOpen()
          await driver.write('save', CURRENT_KEY, withoutSettings(current))
      } catch (error) {
        mode = 'session'
        recovery = safeRecoveryPayload(recoveryFrom(error) ?? structuredClone(value))
        }
      }
      return result([])
    },
    async clear() {
      recovery = undefined
      current = createDefaultSave()
      try {
        settingsStorage.removeItem(SETTINGS_KEY)
      } catch {
        // Settings remain session-only when the host storage rejects access.
      }
      try {
        await ensureOpen()
        await driver.clear('save')
        await driver.clear('recovery')
        mode = 'persistent'
      } catch {
        mode = 'session'
      }
    },
    async exportJson() {
      return encodeSave(current)
    },
    async importJson(raw) {
      const decoded = decodeSave(raw)
      if (!decoded.value) {
        await preserve(raw, decoded.issues)
        return result(decoded.issues)
      }
      return this.save(decoded.value)
    },
    recoveryPayload() {
      return recovery
    },
  }

  async function ensureOpen() {
    if (opened) return
    await driver.open()
    opened = true
  }

  async function preserve(payload: unknown, issues?: SaveIssue[]) {
    recovery = safeRecoveryPayload(payload, issues)
    if (mode !== 'persistent') return
    try {
      await ensureOpen()
      await driver.write('recovery', RECOVERY_KEY, recovery)
    } catch {
      mode = 'session'
    }
  }

  function result(issues: SaveIssue[]): RepositoryResult {
    return { mode, value: structuredClone(current), issues }
  }
}

export function createBrowserIndexedDb(factory: IDBFactory | undefined, databaseName = 'proto-cell'): IndexedDbDriver {
  let database: IDBDatabase | undefined
  const open = async () => {
    if (database) return
    if (!factory) throw new DOMException('IndexedDB unavailable', 'UnavailableError')
    database = await new Promise<IDBDatabase>((resolve, reject) => {
      // Version 2 adds the recovery store for installations created before
      // rejected-import recovery shipped.
      const request = factory.open(databaseName, 2)
      let blocked = false
      request.onupgradeneeded = () => {
        const next = request.result
        if (!next.objectStoreNames.contains('save')) next.createObjectStore('save')
        if (!next.objectStoreNames.contains('recovery')) next.createObjectStore('recovery')
      }
      request.onsuccess = () => {
        const next = request.result
        if (blocked) {
          next.close()
          return
        }
        next.onversionchange = () => {
          next.close()
          if (database === next) database = undefined
        }
        resolve(next)
      }
      request.onerror = () => reject(request.error ?? new DOMException('IndexedDB open failed', 'UnavailableError'))
      request.onblocked = () => {
        blocked = true
        reject(new DOMException('IndexedDB open blocked', 'UnavailableError'))
      }
    })
  }
  const transaction = async <T>(storeName: string, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) => {
    await open()
    if (!database) throw new DOMException('IndexedDB unavailable', 'UnavailableError')
    return new Promise<T>((resolve, reject) => {
      const activeTransaction = database!.transaction(storeName, mode)
      const request = operation(activeTransaction.objectStore(storeName))
      let requestResult: T
      request.onsuccess = () => { requestResult = request.result }
      request.onerror = () => reject(request.error ?? new DOMException('IndexedDB request failed', 'UnavailableError'))
      activeTransaction.oncomplete = () => resolve(requestResult)
      activeTransaction.onerror = () => reject(activeTransaction.error ?? new DOMException('IndexedDB transaction failed', 'UnavailableError'))
      activeTransaction.onabort = () => reject(activeTransaction.error ?? new DOMException('IndexedDB transaction aborted', 'AbortError'))
    })
  }
  return {
    open,
    read: (store, key) => transaction(store, 'readonly', (objectStore) => objectStore.get(key)),
    write: async (store, key, value) => { await transaction(store, 'readwrite', (objectStore) => objectStore.put(value, key)) },
    clear: async (store) => { await transaction(store, 'readwrite', (objectStore) => objectStore.clear()) },
  }
}

function withoutSettings(value: SaveDataV1): Omit<SaveDataV1, 'settings'> {
  const { settings: _settings, ...structured } = value
  return structured
}

function loadSettings(storage: SettingsStorage, fallback: SaveSettings): SaveSettings {
  try {
    const raw = storage.getItem(SETTINGS_KEY)
    if (!raw) return { ...fallback }
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return { ...fallback }
    return {
      music: typeof parsed.music === 'boolean' ? parsed.music : fallback.music,
      sfx: typeof parsed.sfx === 'boolean' ? parsed.sfx : fallback.sfx,
      reducedMotion: typeof parsed.reducedMotion === 'boolean' ? parsed.reducedMotion : fallback.reducedMotion,
      reducedFlash: typeof parsed.reducedFlash === 'boolean' ? parsed.reducedFlash : fallback.reducedFlash,
      lowParticles: typeof parsed.lowParticles === 'boolean' ? parsed.lowParticles : fallback.lowParticles,
      reducedShake: typeof parsed.reducedShake === 'boolean' ? parsed.reducedShake : fallback.reducedShake,
      graphics: parsed.graphics === 'high' || parsed.graphics === 'balanced' || parsed.graphics === 'low' ? parsed.graphics : fallback.graphics,
    }
  } catch {
    return { ...fallback }
  }
}

function saveSettings(storage: SettingsStorage, settings: SaveSettings) {
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // The repository remains usable in session mode.
  }
}

function recoveryFrom(error: unknown): unknown {
  return isRecord(error) ? error.recoveryPayload : undefined
}

function safeIndexedDb(): IDBFactory | undefined {
  try {
    return globalThis.indexedDB
  } catch {
    return undefined
  }
}

function safeSettingsStorage(): SettingsStorage {
  try {
    if (globalThis.localStorage) return globalThis.localStorage
  } catch {
    // Restricted origins use an in-memory settings facade.
  }
  return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }
}

function safeRecoveryPayload(payload: unknown, knownIssues?: SaveIssue[]): unknown {
  const issues = knownIssues ?? decodeSave(payload).issues
  if (issues.some((issue) => issue.code === 'media-not-allowed' || issue.code === 'too-large')) {
    return {
      kind: 'rejected-save',
      issues: issues.map(({ path, code, message }) => ({ path, code, message })),
    }
  }
  return payload
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
