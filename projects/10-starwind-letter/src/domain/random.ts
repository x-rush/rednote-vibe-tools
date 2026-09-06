import type { StarMessage } from '../content/messages'

export type RandomSource = () => number

export function createMulberry32(seed: number): RandomSource {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

export function chooseNextMessage(
  messages: readonly StarMessage[],
  recentIds: readonly string[],
  random: RandomSource,
): StarMessage {
  if (messages.length === 0) throw new Error('Cannot choose from an empty message list')
  const recent = new Set(recentIds)
  const eligible = messages.filter(({ id }) => !recent.has(id))
  const pool = eligible.length > 0 ? eligible : messages
  const totalWeight = pool.reduce((sum, { weight }) => sum + weight, 0)
  let cursor = Math.min(Math.max(random(), 0), 0.999999999999) * totalWeight
  for (const message of pool) {
    cursor -= message.weight
    if (cursor < 0) return message
  }
  return pool[pool.length - 1] as StarMessage
}
