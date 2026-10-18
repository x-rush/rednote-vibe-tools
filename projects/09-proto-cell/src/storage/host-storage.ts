import type { IndexedDbDriver } from './repository'

type MiniTool = {
  getLaunchOptions?: () => Promise<{ miniToolEnv?: { buildVersion?: unknown } }>
  getStorageInfo?: () => Promise<{ keys: string[] }>
  getStorage?: (input: { key: string }) => Promise<{ data: string | null }>
  setStorage?: (input: { key: string; data: string }) => Promise<unknown>
  removeStorage?: (input: { key: string }) => Promise<unknown>
}
type Host = { launchOptions?: { miniToolEnv?: { buildVersion?: unknown } }; miniTool?: MiniTool }
const prefix = 'proto-cell:'

/** Native storage is authoritative on supported clients. Failures propagate to
 * the repository's visible session mode; they never silently fork the save. */
export function createHostStorageDriver(browser: IndexedDbDriver, readHost: () => Host | undefined = () => (globalThis as typeof globalThis & { xhs?: Host }).xhs): IndexedDbDriver {
  let tool: MiniTool | undefined, opened: Promise<void> | undefined, browserOpened: Promise<void> | undefined
  const openBrowser = () => browserOpened ??= browser.open()
  const open = () => opened ??= (async () => {
    const host = readHost(), candidate = host?.miniTool
    let build = Number(host?.launchOptions?.miniToolEnv?.buildVersion) || 0
    if (!build && candidate?.getLaunchOptions) {
      try { build = Number((await candidate.getLaunchOptions()).miniToolEnv?.buildVersion) || 0 } catch { /* unknown version uses the compatible browser path */ }
    }
    if (Math.floor(build / 1000) >= 9460 && candidate?.getStorage && candidate.setStorage && candidate.removeStorage && candidate.getStorageInfo) tool = candidate
    else await openBrowser()
  })()
  let operations = Promise.resolve()
  const enqueue = (operation: () => Promise<void>) => {
    const result = operations.then(operation)
    operations = result.catch(() => undefined)
    return result
  }
  const storageKey = (store: string, key: string) => `${prefix}${store}:${key}`
  return {
    open,
    usesHostStorage: () => Boolean(tool),
    async read(store, key) {
      await operations
      await open()
      if (!tool) return browser.read(store, key)
      const name = storageKey(store, key), info = await tool.getStorageInfo!()
      if (info.keys.includes(name)) {
        const response = await tool.getStorage!({ key: name })
        return response.data === null ? undefined : JSON.parse(response.data)
      }
      // One-time migration source. App persists the validated load into native storage.
      if (info.keys.includes(`${prefix}${store}:cleared`)) return undefined
      try { await openBrowser(); return await browser.read(store, key) } catch { return undefined }
    },
    write(store, key, value) { return enqueue(async () => {
      await open()
      if (!tool) return browser.write(store, key, value)
      const data = JSON.stringify(value)
      if (typeof data !== 'string' || new TextEncoder().encode(data).length > 1024 * 1024) throw new Error('Native save exceeds storage limit')
      await tool.setStorage!({ key: storageKey(store, key), data })
    }) },
    clear(store) { return enqueue(async () => {
      await open()
      if (!tool) return browser.clear(store)
      const marker = `${prefix}${store}:cleared`
      await tool.setStorage!({ key: marker, data: 'true' })
      const { keys } = await tool.getStorageInfo!()
      for (const key of keys.filter((key) => key.startsWith(`${prefix}${store}:`) && key !== marker)) await tool.removeStorage!({ key })
      // Clear the legacy source too, so a deleted save cannot migrate back.
      try { await openBrowser(); await browser.clear(store) } catch { /* native remains authoritative */ }
    }) },
  }
}
