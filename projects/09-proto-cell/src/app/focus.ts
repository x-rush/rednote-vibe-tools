export function wrappedModalFocusIndex(
  currentIndex: number,
  controlCount: number,
  backwards: boolean,
): number | undefined {
  if (controlCount <= 0) return undefined
  if (backwards && currentIndex <= 0) return controlCount - 1
  if (!backwards && currentIndex >= controlCount - 1) return 0
  return undefined
}
