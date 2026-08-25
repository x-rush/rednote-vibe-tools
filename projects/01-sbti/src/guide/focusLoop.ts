export function focusLoopTargetIndex(activeIndex: number, length: number, backwards: boolean) {
  if (length < 1) return undefined
  if (backwards && activeIndex <= 0) return length - 1
  if (!backwards && (activeIndex < 0 || activeIndex === length - 1)) return 0
  return undefined
}
