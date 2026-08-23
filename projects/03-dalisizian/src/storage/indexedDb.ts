import type { CaseRecordName, CaseRecordStore } from './types'

const DATABASE_NAME = 'xhs_zi_an_lu'
const DATABASE_VERSION = 1

type StoredRecord<T> = { caseId: string; value: T }

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains('caseProgress')) database.createObjectStore('caseProgress', { keyPath: 'caseId' })
      if (!database.objectStoreNames.contains('caseVerdicts')) database.createObjectStore('caseVerdicts', { keyPath: 'caseId' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
    request.onblocked = () => reject(new Error('IndexedDB upgrade blocked'))
  })
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

export function createIndexedDbCaseRecordStore(factory: IDBFactory = window.indexedDB): CaseRecordStore {
  const database = openDatabase(factory)
  const getStore = async (name: CaseRecordName, mode: IDBTransactionMode) => (await database).transaction(name, mode).objectStore(name)
  return {
    async get<T>(store: CaseRecordName, caseId: string) {
      const record = await requestResult<StoredRecord<T> | undefined>((await getStore(store, 'readonly')).get(caseId))
      return record?.value
    },
    async put<T>(store: CaseRecordName, caseId: string, value: T) {
      await requestResult((await getStore(store, 'readwrite')).put({ caseId, value }))
    },
    async delete(store, caseId) {
      await requestResult((await getStore(store, 'readwrite')).delete(caseId))
    },
    async clear() {
      const db = await database
      await Promise.all((['caseProgress', 'caseVerdicts'] as CaseRecordName[]).map((store) => requestResult(db.transaction(store, 'readwrite').objectStore(store).clear())))
    },
  }
}
