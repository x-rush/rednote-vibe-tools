import { describe, expect, it } from 'vitest'
import { postPosterNote, savePosterToAlbum } from './minitool-bridge'

describe('XHS mini tool poster bridge', () => {
  it('writes the complete data URI to a temp file before saving to the album', async () => {
    const calls: unknown[] = []
    const bridge = {
      writeTempFile: async (options: { data: string }) => { calls.push(['write', options]); return { filePath: 'xhs-temp://poster.png' } },
      saveImageToPhotosAlbum: async (options: { filePath: string }) => { calls.push(['save', options]); return {} },
      postNote: async () => ({}),
    }

    await savePosterToAlbum('data:image/png;base64,AAA', bridge)

    expect(calls).toEqual([
      ['write', { data: 'data:image/png;base64,AAA' }],
      ['save', { filePath: 'xhs-temp://poster.png' }],
    ])
  })

  it('opens a photo note with the poster and bounded authored copy', async () => {
    let received: unknown
    const bridge = {
      writeTempFile: async () => ({ filePath: 'unused' }),
      saveImageToPhotosAlbum: async () => ({}),
      postNote: async (options: unknown) => { received = options; return {} },
    }

    await postPosterNote('data:image/png;base64,BBB', '街坊自家人', '百日灯火，街坊常坐。', bridge)

    expect(received).toEqual({
      title: '街坊自家人',
      content: '百日灯火，街坊常坐。',
      pageType: 'photo_publish',
      mediaInfo: { image_resources: [{ url: 'data:image/png;base64,BBB' }] },
    })
  })

  it('rejects native calls that resolve with a fail result', async () => {
    const saveFailure = {
      writeTempFile: async () => ({ filePath: 'xhs-temp://poster.png', errMsg: 'writeTempFile:ok' }),
      saveImageToPhotosAlbum: async () => ({ errMsg: 'saveImageToPhotosAlbum:fail auth deny' }),
      postNote: async () => ({}),
    }
    const shareFailure = {
      writeTempFile: async () => ({ filePath: 'unused' }),
      saveImageToPhotosAlbum: async () => ({}),
      postNote: async () => ({ errMsg: 'postNote:fail invalid media' }),
    }

    await expect(savePosterToAlbum('data:image/png;base64,AAA', saveFailure)).rejects.toThrow('BRIDGE_CALL_FAILED')
    await expect(postPosterNote('data:image/png;base64,BBB', '结局', '分享', shareFailure)).rejects.toThrow('BRIDGE_CALL_FAILED')
  })
})
