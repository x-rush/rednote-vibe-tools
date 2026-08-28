export type Rng = {
  next(): number
  int(min: number, maxExclusive: number): number
  fork(label: string): Rng
}

const STEP = 0x6d2b79f5

export function createRng(seed: number): Rng {
  const rootSeed = normalizeSeed(seed)
  let state = rootSeed

  return {
    next() {
      state = (state + STEP) >>> 0
      let value = state
      value = Math.imul(value ^ (value >>> 15), value | 1)
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
      return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
    },
    int(min, maxExclusive) {
      if (!Number.isInteger(min) || !Number.isInteger(maxExclusive) || maxExclusive <= min) {
        throw new RangeError('Expected an ascending integer range')
      }
      return min + Math.floor(this.next() * (maxExclusive - min))
    },
    fork(label) {
      return createRng(hashLabel(rootSeed, label))
    },
  }
}

function normalizeSeed(seed: number): number {
  return Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 0
}

function hashLabel(seed: number, label: string): number {
  let hash = (seed ^ 0x9e3779b9) >>> 0
  for (let index = 0; index < label.length; index += 1) {
    hash = Math.imul(hash ^ label.charCodeAt(index), 0x01000193) >>> 0
  }
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x85ebca6b) >>> 0
  hash ^= hash >>> 13
  return Math.imul(hash, 0xc2b2ae35) >>> 0
}
