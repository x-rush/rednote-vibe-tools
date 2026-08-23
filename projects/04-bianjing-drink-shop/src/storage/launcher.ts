export interface LauncherState {
  activeSaveId?: string
  settings: { muted: boolean; reducedMotion: boolean }
}

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const LAUNCHER_KEY = 'xhs-tool:bianjing:state:v1'
const fallback = (): LauncherState => ({ settings: { muted: false, reducedMotion: false } })

export function loadLauncher(storage: KeyValueStorage): LauncherState {
  const raw = storage.getItem(LAUNCHER_KEY)
  if (!raw) return fallback()
  try {
    const value = JSON.parse(raw) as Partial<LauncherState>
    if (!value.settings || typeof value.settings.muted !== 'boolean' || typeof value.settings.reducedMotion !== 'boolean') return fallback()
    return { activeSaveId: typeof value.activeSaveId === 'string' ? value.activeSaveId : undefined, settings: value.settings }
  } catch { return fallback() }
}

export function saveLauncher(storage: KeyValueStorage, state: LauncherState) {
  storage.setItem(LAUNCHER_KEY, JSON.stringify(state))
}

export function clearLauncher(storage: KeyValueStorage) {
  storage.removeItem(LAUNCHER_KEY)
}
