export type RngState = Readonly<{ value: number }>

export function seedRng(seed: string): RngState {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return { value: hash >>> 0 }
}

export function nextRandom(state: RngState): { value: number; state: RngState } {
  const next = (state.value + 0x6d2b79f5) >>> 0
  let mixed = next
  mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
  const value = ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  return { value, state: { value: next } }
}
