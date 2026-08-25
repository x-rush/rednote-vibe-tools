export type MiniToolAlbumBridge = {
  writeTempFile(options: { data: string }): Promise<{ filePath: string }>
  saveImageToPhotosAlbum(options: { filePath: string }): Promise<{ errMsg?: string }>
}

type MiniToolWindow = Window & {
  xhs?: { miniTool?: unknown }
}

export function getPhotoAlbumBridge(): MiniToolAlbumBridge | undefined {
  if (typeof window === 'undefined') return undefined
  const bridge = (window as MiniToolWindow).xhs?.miniTool
  return isPhotoAlbumAvailable(bridge) ? bridge : undefined
}

export function isPhotoAlbumAvailable(value: unknown): value is MiniToolAlbumBridge {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<MiniToolAlbumBridge>
  return typeof candidate.writeTempFile === 'function' && typeof candidate.saveImageToPhotosAlbum === 'function'
}

export async function saveCardToPhotoAlbum(dataUri: string, bridge = getPhotoAlbumBridge()): Promise<{ ok: true }> {
  if (!/^data:image\/png;base64,/i.test(dataUri)) throw new Error('分享卡必须使用完整的 PNG data URI')
  if (!bridge) throw new Error('当前环境不支持保存到相册')
  const { filePath } = await bridge.writeTempFile({ data: dataUri })
  if (!filePath) throw new Error('临时图片路径为空')
  await bridge.saveImageToPhotosAlbum({ filePath })
  return { ok: true }
}
