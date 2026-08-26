export const NOTICE_DURATION_MS = 3_000

export function scheduleNoticeDismiss(
  notice: string | null,
  dismiss: () => void,
  duration = NOTICE_DURATION_MS,
) {
  if (!notice) return () => undefined

  const timer = globalThis.setTimeout(dismiss, duration)
  return () => globalThis.clearTimeout(timer)
}
