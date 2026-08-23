import type { QuestHistoryEntry } from '../content/schema'

export type QuestFeedback = { questId: string; unsuitableCount: number; lastUnsuitableAt: string }
export interface AdventureLogRepository {
  list(limit?: number): Promise<QuestHistoryEntry[]>
  append(entry: QuestHistoryEntry): Promise<void>
  recordFeedback(questId: string, status: 'swapped' | 'abandoned', at: string): Promise<void>
  listFeedback(): Promise<QuestFeedback[]>
  clear(): Promise<void>
}

export class StorageUnavailableError extends Error {
  readonly code = 'storage-unavailable'
  constructor() { super('本机长期冒险日志当前不可用') }
}

export function createMemoryAdventureLog(): AdventureLogRepository {
  let entries: QuestHistoryEntry[] = []
  const feedback = new Map<string, QuestFeedback>()
  return {
    async list(limit = 100) { return entries.slice(-limit) },
    async append(entry) { entries = [...entries, entry].slice(-100) },
    async recordFeedback(questId, _status, at) { const current = feedback.get(questId); feedback.set(questId, { questId, unsuitableCount: (current?.unsuitableCount ?? 0) + 1, lastUnsuitableAt: at }) },
    async listFeedback() { return [...feedback.values()] },
    async clear() { entries = []; feedback.clear() },
  }
}

export function createIndexedDbAdventureLog(indexedDb: IDBFactory): AdventureLogRepository {
  const database = openDatabase(indexedDb)
  return {
    async list(limit = 100) {
      const db = await database
      const values = await requestResult<QuestHistoryEntry[]>(db.transaction('adventureLogs').objectStore('adventureLogs').getAll())
      return values.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt)).slice(-limit)
    },
    async append(entry) {
      const db = await database
      await transactionDone(db, 'adventureLogs', (store) => store.put(entry))
    },
    async recordFeedback(questId, _status, at) {
      const db = await database
      const transaction = db.transaction('questFeedback', 'readwrite')
      const store = transaction.objectStore('questFeedback')
      const current = await requestResult<QuestFeedback | undefined>(store.get(questId))
      store.put({ questId, unsuitableCount: (current?.unsuitableCount ?? 0) + 1, lastUnsuitableAt: at })
      await waitForTransaction(transaction)
    },
    async listFeedback() {
      const db = await database
      return requestResult<QuestFeedback[]>(db.transaction('questFeedback').objectStore('questFeedback').getAll())
    },
    async clear() {
      const db = await database
      await Promise.all([transactionDone(db, 'adventureLogs', (store) => store.clear()), transactionDone(db, 'questFeedback', (store) => store.clear())])
    },
  }
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest
    try { request = factory.open('xhs_earth_online', 1) } catch { reject(new StorageUnavailableError()); return }
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('adventureLogs')) db.createObjectStore('adventureLogs', { keyPath: 'acceptanceId' })
      if (!db.objectStoreNames.contains('questFeedback')) db.createObjectStore('questFeedback', { keyPath: 'questId' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new StorageUnavailableError())
    request.onblocked = () => reject(new StorageUnavailableError())
  })
}

async function transactionDone(db: IDBDatabase, storeName: string, operation: (store: IDBObjectStore) => IDBRequest): Promise<void> {
  const transaction = db.transaction(storeName, 'readwrite')
  operation(transaction.objectStore(storeName))
  await waitForTransaction(transaction)
}
function waitForTransaction(transaction: IDBTransaction): Promise<void> { return new Promise((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(new StorageUnavailableError()); transaction.onabort = () => reject(new StorageUnavailableError()) }) }
function requestResult<T>(request: IDBRequest): Promise<T> { return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result as T); request.onerror = () => reject(new StorageUnavailableError()) }) }
