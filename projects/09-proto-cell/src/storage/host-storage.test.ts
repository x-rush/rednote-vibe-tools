import { expect, it, vi } from 'vitest'
import { createHostStorageDriver } from './host-storage'
import { memoryIndexedDb, memorySettingsStorage, saveFixture } from '../tests/fixtures'
import { createRepository } from './repository'

function host(buildVersion=9460000) {
  const data=new Map<string,string>()
  const miniTool={getStorageInfo:vi.fn(async()=>({keys:[...data.keys()]})),getStorage:vi.fn(async({key}:{key:string})=>({data:data.get(key)??null})),setStorage:vi.fn(async({key,data:value}:{key:string;data:string})=>{data.set(key,value)}),removeStorage:vi.fn(async({key}:{key:string})=>{data.delete(key)})}
  return {data,miniTool,launchOptions:{miniToolEnv:{buildVersion}}}
}
it('prefers supported native storage and reloads settings with the same save',async()=>{
  const xhs=host(),fallback=memoryIndexedDb(),open=vi.spyOn(fallback,'open')
  const repo=createRepository(createHostStorageDriver(fallback,()=>xhs),memorySettingsStorage())
  await repo.load();const save=saveFixture();save.settings.music=false;await repo.save(save)
  const reload=createRepository(createHostStorageDriver(memoryIndexedDb(),()=>xhs),memorySettingsStorage())
  expect((await reload.load()).value.settings.music).toBe(false)
  expect(xhs.miniTool.setStorage).toHaveBeenCalled(); expect(open.mock.calls.length).toBeLessThanOrEqual(1)
  await reload.clear();expect((await reload.load()).value.lifeArchives).toEqual([])
})
it('uses the browser path when build information is missing or too old',async()=>{
  for(const build of [0,9459999]){const xhs=host(build),fallback=memoryIndexedDb(),read=vi.spyOn(fallback,'read');const driver=createHostStorageDriver(fallback,()=>xhs);await driver.open();await driver.read('save','current');expect(read).toHaveBeenCalled();expect(xhs.miniTool.getStorageInfo).not.toHaveBeenCalled()}
})
it('preserves session fallback on a supported native write failure',async()=>{
 const xhs=host();xhs.miniTool.setStorage.mockRejectedValueOnce(Error('quota'))
 const fallback=memoryIndexedDb(),write=vi.spyOn(fallback,'write'),repo=createRepository(createHostStorageDriver(fallback,()=>xhs),memorySettingsStorage())
 await repo.load();expect((await repo.save(saveFixture())).mode).toBe('session');expect(write).not.toHaveBeenCalled()
})
it('migrates an existing browser save on the next successful native save',async()=>{
 const fallback=memoryIndexedDb(),save=saveFixture();await fallback.open();await fallback.write('save','current',save)
 const xhs=host(),repo=createRepository(createHostStorageDriver(fallback,()=>xhs),memorySettingsStorage())
 const loaded=await repo.load();expect(loaded.value.progression).toEqual(save.progression);await repo.save(loaded.value)
 const reload=createRepository(createHostStorageDriver(memoryIndexedDb(),()=>xhs),memorySettingsStorage())
 expect((await reload.load()).value.progression).toEqual(save.progression)
})
it('retains the authoritative native save if the clear marker cannot be written',async()=>{
 const xhs=host(),fallback=memoryIndexedDb(),save=saveFixture()
 const driver=createHostStorageDriver(fallback,()=>xhs);await driver.open();await driver.write('save','current',save)
 xhs.miniTool.setStorage.mockRejectedValueOnce(Error('quota'))
 await expect(driver.clear('save')).rejects.toThrow('quota')
 expect(xhs.miniTool.removeStorage).not.toHaveBeenCalled()
 expect(await driver.read('save','current')).toEqual(save)
})
it('does not resurrect legacy data after a successful clear even if legacy removal fails',async()=>{
 const xhs=host(),fallback=memoryIndexedDb();await fallback.write('save','current',saveFixture())
 vi.spyOn(fallback,'clear').mockRejectedValue(Error('unavailable'))
 const driver=createHostStorageDriver(fallback,()=>xhs);await driver.clear('save')
 expect(await createHostStorageDriver(fallback,()=>xhs).read('save','current')).toBeUndefined()
})
it('serializes native writes and clear so a slow older save cannot restore deleted progress',async()=>{
 const xhs=host(),driver=createHostStorageDriver(memoryIndexedDb(),()=>xhs);await driver.open()
 let release:()=>void=()=>{throw Error('not started')}
 xhs.miniTool.setStorage.mockImplementationOnce(({key,data})=>new Promise<void>(resolve=>{release=()=>{xhs.data.set(key,data);resolve()}}))
 const old=driver.write('save','current',{generation:1});await vi.waitFor(()=>expect(xhs.miniTool.setStorage).toHaveBeenCalledTimes(1))
 const newer=driver.write('save','current',{generation:2}),clear=driver.clear('save')
 await Promise.resolve();expect(xhs.miniTool.setStorage).toHaveBeenCalledTimes(1)
 release();await Promise.all([old,newer,clear])
 expect(await driver.read('save','current')).toBeUndefined()
 expect(xhs.miniTool.setStorage.mock.calls[1][0].data).toBe('{"generation":2}')
})
