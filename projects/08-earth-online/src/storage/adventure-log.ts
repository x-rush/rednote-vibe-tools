import type { QuestCategory, QuestHistoryEntry, UnsuitableReason } from '../content/schema'

export type QuestFeedback = { questId: string; category: QuestCategory; reason: UnsuitableReason; active: boolean; updatedAt: string }
export type QuestFeedbackInput = Omit<QuestFeedback, 'active'>
export interface AdventureLogRepository {
  list(limit?: number): Promise<QuestHistoryEntry[]>
  append(entry: QuestHistoryEntry): Promise<void>
  recordFeedback(input: QuestFeedbackInput): Promise<void>
  undoFeedback(questId: string, updatedAt: string): Promise<void>
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
    async recordFeedback(input) { feedback.set(input.questId, { ...input, active: true }) },
    async undoFeedback(questId, updatedAt) { const current = feedback.get(questId); if (current) feedback.set(questId, { ...current, active: false, updatedAt }) },
    async listFeedback() { return [...feedback.values()] },
    async clear() { entries = []; feedback.clear() },
  }
}

export function createIndexedDbAdventureLog(indexedDb: IDBFactory): AdventureLogRepository {
  let database: Promise<IDBDatabase> | undefined
  const getDatabase = () => {
    if (!database) database = openDatabase(indexedDb).catch((error: unknown) => { database = undefined; throw error })
    return database
  }
  return {
    async list(limit = 100) {
      const db = await getDatabase()
      const values = await requestResult<QuestHistoryEntry[]>(db.transaction('adventureLogs').objectStore('adventureLogs').getAll())
      return values.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt)).slice(-limit)
    },
    async append(entry) {
      const db = await getDatabase()
      await transactionDone(db, 'adventureLogs', (store) => store.put(entry))
    },
    async recordFeedback(input) {
      const db = await getDatabase()
      const transaction = db.transaction('questFeedback', 'readwrite')
      const store = transaction.objectStore('questFeedback')
      store.put({ ...input, active: true })
      await waitForTransaction(transaction)
    },
    async undoFeedback(questId, updatedAt) {
      const db = await getDatabase()
      const transaction = db.transaction('questFeedback', 'readwrite')
      const store = transaction.objectStore('questFeedback')
      const current = await requestResult<QuestFeedback | undefined>(store.get(questId))
      if (current) store.put({ ...current, active: false, updatedAt })
      await waitForTransaction(transaction)
    },
    async listFeedback() {
      const db = await getDatabase()
      return requestResult<QuestFeedback[]>(db.transaction('questFeedback').objectStore('questFeedback').getAll())
    },
    async clear() {
      const db = await getDatabase()
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
