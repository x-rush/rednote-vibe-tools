import { describe, expect, it, vi } from 'vitest'

vi.mock('../content', () => ({
  getContent: () => {
    throw new Error('invalid content must be handled by the app shell')
  },
}))

describe('cell renderer content isolation', () => {
  it('does not validate content while the renderer module is loading', async () => {
    await expect(import('./cell')).resolves.toMatchObject({ drawCell: expect.any(Function) })
  })
})
