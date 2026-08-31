export type GridPoint = { x: number; y: number }

export class SpatialGrid<T extends GridPoint> {
  private readonly buckets = new Map<string, T[]>()
  private readonly cellSize: number

  constructor(cellSize: number) {
    this.cellSize = cellSize
  }

  clear() {
    this.buckets.clear()
  }

  insert(item: T) {
    const key = this.key(item.x, item.y)
    const bucket = this.buckets.get(key)
    if (bucket) bucket.push(item)
    else this.buckets.set(key, [item])
  }

  insertAll(items: readonly T[]) {
    for (const item of items) this.insert(item)
  }

  query(x: number, y: number, radius: number, target: T[] = []): T[] {
    target.length = 0
    const left = Math.floor((x - radius) / this.cellSize)
    const right = Math.floor((x + radius) / this.cellSize)
    const top = Math.floor((y - radius) / this.cellSize)
    const bottom = Math.floor((y + radius) / this.cellSize)
    const radiusSquared = radius * radius

    for (let cellY = top; cellY <= bottom; cellY += 1) {
      for (let cellX = left; cellX <= right; cellX += 1) {
        const bucket = this.buckets.get(`${cellX}:${cellY}`)
        if (!bucket) continue
        for (const item of bucket) {
          const dx = item.x - x
          const dy = item.y - y
          if (dx * dx + dy * dy <= radiusSquared) target.push(item)
        }
      }
    }
    return target
  }

  private key(x: number, y: number) {
    return `${Math.floor(x / this.cellSize)}:${Math.floor(y / this.cellSize)}`
  }
}
