import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import type { BadgeDefinition, EarthOnlineContent, StreakState } from '../content/schema'
import { levelFromXp, unlockedBadges, updateStreak } from './progression'

const badges = (rawContent as unknown as EarthOnlineContent).content.badges

describe('adventurer progression', () => {
  it.each([[0, 1], [99, 1], [100, 2], [299, 2], [300, 3], [599, 3], [600, 4]])('maps %i XP to level %i', (xp, expected) => {
    expect(levelFromXp(xp).level).toBe(expected)
  })

  it('updates streaks using explicit calendar dates', () => {
    const empty: StreakState = { current: 0, best: 0 }
    expect(updateStreak(empty, '2026-08-24')).toEqual({ current: 1, best: 1, lastCompletionDate: '2026-08-24' })
    expect(updateStreak({ current: 2, best: 4, lastCompletionDate: '2026-08-24' }, '2026-08-24')).toEqual({ current: 2, best: 4, lastCompletionDate: '2026-08-24' })
    expect(updateStreak({ current: 2, best: 2, lastCompletionDate: '2026-08-31' }, '2026-09-01').current).toBe(3)
    expect(updateStreak({ current: 2, best: 2, lastCompletionDate: '2026-12-31' }, '2027-01-01').current).toBe(3)
    expect(updateStreak({ current: 3, best: 5, lastCompletionDate: '2026-08-20' }, '2026-08-24')).toEqual({ current: 1, best: 5, lastCompletionDate: '2026-08-24' })
  })

  it('unlocks matching badges without duplicating current unlocks', () => {
    const summary = { completedCount: 5, level: 3, streak: 3, categoryCounts: { move: 3 } }
    const unlocked = unlockedBadges(badges as BadgeDefinition[], summary, ['badge-first-quest'])
    expect(unlocked).toEqual(expect.arrayContaining(['badge-first-quest', 'badge-five-quests', 'badge-three-day-streak', 'badge-level-three', 'badge-mover']))
    expect(new Set(unlocked).size).toBe(unlocked.length)
  })
})
