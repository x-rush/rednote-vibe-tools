import { describe, expect, it } from 'vitest'
import { shopContent } from '../content'
import type { SavePayload } from '../domain/types'
import { createNewGame } from '../engine/simulator'
import { MemorySaveRepository } from './repository'

const save = (id: string): SavePayload => ({ schemaVersion: 5, contentVersion: shopContent.contentVersion, id, updatedAt: '2026-08-24T00:00:00.000Z', current: createNewGame(id, id, shopContent.content) })

describe('save repository', () => {
  it('keeps new games isolated and clears only this repository', async () => {
    const repository = new MemorySaveRepository()
    await repository.save(save('save-one'))
    await repository.save(save('save-two'))
    expect((await repository.list()).map((item) => item.id)).toEqual(['save-one', 'save-two'])
    await repository.remove('save-one')
    expect(await repository.load('save-one')).toBeUndefined()
    expect((await repository.load('save-two'))?.id).toBe('save-two')
    await repository.clear()
    expect(await repository.list()).toEqual([])
  })
})
