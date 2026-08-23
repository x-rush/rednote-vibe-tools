import type { SavePayload } from '../domain/types'
import type { SaveRepository } from './repository'

const DATABASE_NAME = 'xhs_bianjing_shop'
const DATABASE_VERSION = 1
const SAVE_STORE = 'saves'

const requestValue = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error ?? new Error('IndexedDB 请求失败'))
})

export class IndexedDbSaveRepository implements SaveRepository {
  private database?: Promise<IDBDatabase>

  private open() {
    this.database ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
      request.onupgradeneeded = () => {
        const database = request.result
        if (!database.objectStoreNames.contains(SAVE_STORE)) database.createObjectStore(SAVE_STORE, { keyPath: 'id' })
        if (!database.objectStoreNames.contains('eventHistory')) {
          const history = database.createObjectStore('eventHistory', { keyPath: 'id', autoIncrement: true })
          history.createIndex('saveId', 'saveId')
          history.createIndex('day', 'day')
          history.createIndex('eventId', 'eventId')
        }
        if (!database.objectStoreNames.contains('endingCollection')) database.createObjectStore('endingCollection', { keyPath: 'endingId' })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('无法打开 IndexedDB'))
    })
    return this.database
  }

  private async store(mode: IDBTransactionMode) {
    const database = await this.open()
    return database.transaction(SAVE_STORE, mode).objectStore(SAVE_STORE)
  }

  async load(id: string) { return requestValue((await this.store('readonly')).get(id)) as Promise<SavePayload | undefined> }
  async save(payload: SavePayload) { await requestValue((await this.store('readwrite')).put(payload)) }
  async remove(id: string) { await requestValue((await this.store('readwrite')).delete(id)) }
  async list() { return requestValue((await this.store('readonly')).getAll()) as Promise<SavePayload[]> }
  async clear() { await requestValue((await this.store('readwrite')).clear()) }
}
