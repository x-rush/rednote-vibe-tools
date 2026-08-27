export interface MiniToolBridge {
  writeTempFile(options: { data: string }): Promise<{ filePath?: string; errMsg?: string }>
  saveImageToPhotosAlbum(options: { filePath: string }): Promise<{ errMsg?: string }>
  postNote(options: {
    title?: string
    content?: string
    pageType?: 'photo_publish'
    mediaInfo: { image_resources: { url: string }[] }
  }): Promise<{ errMsg?: string }>
}

declare global {
  interface Window {
    xhs?: { miniTool?: MiniToolBridge }
  }
}

export function getMiniToolBridge(): MiniToolBridge | undefined {
  return typeof window === 'undefined' ? undefined : window.xhs?.miniTool
}

function requireDataUri(data: string) {
  if (!/^data:image\/png;base64,/i.test(data)) throw new Error('INVALID_POSTER_DATA')
}

function requireBridgeSuccess(result: { errMsg?: string }) {
  if (/:fail(?:\s|$)/i.test(result.errMsg ?? '')) throw new Error('BRIDGE_CALL_FAILED')
}

export async function savePosterToAlbum(data: string, bridge = getMiniToolBridge()): Promise<void> {
  requireDataUri(data)
  if (!bridge) throw new Error('BRIDGE_UNAVAILABLE')
  const temporary = await bridge.writeTempFile({ data })
  requireBridgeSuccess(temporary)
  if (!temporary.filePath) throw new Error('TEMP_FILE_FAILED')
  requireBridgeSuccess(await bridge.saveImageToPhotosAlbum({ filePath: temporary.filePath }))
}

export async function postPosterNote(data: string, title: string, content: string, bridge = getMiniToolBridge()): Promise<void> {
  requireDataUri(data)
  if (!bridge) throw new Error('BRIDGE_UNAVAILABLE')
  requireBridgeSuccess(await bridge.postNote({
    title: title.slice(0, 20),
    content: content.slice(0, 1000),
    pageType: 'photo_publish',
    mediaInfo: { image_resources: [{ url: data }] },
  }))
}
