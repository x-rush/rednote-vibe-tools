export function getWrappedFocusIndex(currentIndex: number, total: number, backward: boolean): number {
  if (total <= 0) return -1
  return (currentIndex + (backward ? -1 : 1) + total) % total
}
