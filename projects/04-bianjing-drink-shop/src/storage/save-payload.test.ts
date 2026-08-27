import { describe, expect, it } from 'vitest'
import { shopContent } from '../content'
import { createNewGame } from '../engine/simulator'
import { decodeSave } from './save-codec'
import { createSavePayload } from './save-payload'

describe('createSavePayload', () => {
  it('writes a new V5 game in a V5 envelope that can be restored without migration', () => {
    const state = createNewGame('persist-seed', 'save-persist', shopContent.content)
    const payload = createSavePayload(state, undefined, '2026-08-27T00:00:00.000Z')

    expect(payload.schemaVersion).toBe(5)
    expect(decodeSave(JSON.stringify(payload), shopContent.content)).toMatchObject({
      status: 'ok',
      payload: { current: { saveId: 'save-persist', schemaVersion: 5 } },
    })
  })
})
