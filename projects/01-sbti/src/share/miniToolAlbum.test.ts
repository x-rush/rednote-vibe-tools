import { describe, expect, it, vi } from 'vitest'
import { isPhotoAlbumAvailable, saveCardToPhotoAlbum } from './miniToolAlbum'

describe('mini-tool photo album bridge', () => {
  it('writes the complete PNG data URI to a temp file before saving that local path', async () => {
    const events: string[] = []
    const bridge = {
      writeTempFile: vi.fn(async ({ data }: { data: string }) => {
        events.push(`write:${data}`)
        return { filePath: 'xhs-temp://share-card.png' }
      }),
      saveImageToPhotosAlbum: vi.fn(async ({ filePath }: { filePath: string }) => {
        events.push(`save:${filePath}`)
        return { errMsg: 'saveImageToPhotosAlbum:ok' }
      }),
    }

    await expect(saveCardToPhotoAlbum('data:image/png;base64,abc123', bridge)).resolves.toEqual({ ok: true })
    expect(events).toEqual([
      'write:data:image/png;base64,abc123',
      'save:xhs-temp://share-card.png',
    ])
  })

  it('rejects stripped base64 before invoking the native bridge', async () => {
    const bridge = {
      writeTempFile: vi.fn(),
      saveImageToPhotosAlbum: vi.fn(),
    }

    await expect(saveCardToPhotoAlbum('abc123', bridge)).rejects.toThrow('完整的 PNG data URI')
    expect(bridge.writeTempFile).not.toHaveBeenCalled()
  })

  it('reports album support only when both documented methods exist', () => {
    expect(isPhotoAlbumAvailable(undefined)).toBe(false)
    expect(isPhotoAlbumAvailable({ writeTempFile: vi.fn() })).toBe(false)
    expect(isPhotoAlbumAvailable({ writeTempFile: vi.fn(), saveImageToPhotosAlbum: vi.fn() })).toBe(true)
  })
})
