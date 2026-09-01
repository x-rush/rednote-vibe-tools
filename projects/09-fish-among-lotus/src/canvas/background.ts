export type BackgroundFileError = 'type' | 'size'
const MAX_BACKGROUND_BYTES = 15 * 1024 * 1024

export function validateBackgroundFile(file: Pick<File, 'type' | 'size'>): BackgroundFileError | null {
  if (!file.type.startsWith('image/')) return 'type'
  if (file.size > MAX_BACKGROUND_BYTES) return 'size'
  return null
}
