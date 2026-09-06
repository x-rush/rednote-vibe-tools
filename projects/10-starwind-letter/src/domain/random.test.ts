import { describe, expect, it } from 'vitest'
import type { StarMessage } from '../content/messages'
import { chooseNextMessage, createMulberry32 } from './random'

const messages: readonly StarMessage[] = Array.from({ length: 12 }, (_, index) => ({
  id: `calm-${String(index + 1).padStart(2, '0')}`,
  text: `星语${index + 1}`,
  mood: 'calm',
  weight: 1,
}))

describe('star message selection', () => {
  it('excludes the recent eight ids without mutating the source list', () => {
    const originalIds = messages.map(({ id }) => id)
    const recent = messages.slice(0, 8).map(({ id }) => id)
    const selected = chooseNextMessage(messages, recent, () => 0)
    expect(recent).not.toContain(selected.id)
    expect(selected.id).toBe('calm-09')
    expect(messages.map(({ id }) => id)).toEqual(originalIds)
  })

  it('falls back to the full pool when every id is recent', () => {
    const selected = chooseNextMessage(messages, messages.map(({ id }) => id), () => 0.999)
    expect(selected.id).toBe('calm-12')
  })

  it('produces a repeatable seeded sequence', () => {
    const first = createMulberry32(42)
    const second = createMulberry32(42)
    expect(Array.from({ length: 4 }, first)).toEqual(Array.from({ length: 4 }, second))
  })
})
