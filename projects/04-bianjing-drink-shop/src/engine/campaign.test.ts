import { describe, expect, it } from 'vitest'
import type { CampaignDefinition } from '../content/schema'
import {
  calendarDayAfterTurns,
  calendarDayForOperatingDay,
  campaignChapter,
  operatingDayForCalendarDay,
  remainingOperatingDays,
} from './campaign'

const campaign: CampaignDefinition = {
  totalCalendarDays: 100,
  operatingDays: [1, 4, 7, 10, 14, 18, 22, 26, 30, 34, 38, 42, 46, 50, 54, 58, 62, 66, 70, 74, 78, 82, 85, 88, 90, 92, 94, 96, 98, 100],
  milestoneOperatingDays: [7, 15, 23],
  chapters: [
    { chapterId: 'chapter-opening', title: '支起炉火', operatingDayRange: [1, 7] },
    { chapterId: 'chapter-neighbors', title: '街坊认门', operatingDayRange: [8, 15] },
    { chapterId: 'chapter-pressure', title: '风浪入账', operatingDayRange: [16, 23] },
    { chapterId: 'chapter-finale', title: '百日收官', operatingDayRange: [24, 30] },
  ],
}

describe('thirty-turn campaign timeline', () => {
  it('maps every playable turn to a strictly increasing calendar day ending at one hundred', () => {
    const days = Array.from({ length: 30 }, (_, index) => calendarDayForOperatingDay(index + 1, campaign))

    expect(days).toEqual(campaign.operatingDays)
    expect(days.every((day, index) => index === 0 || day > days[index - 1])).toBe(true)
    expect(days.at(-1)).toBe(100)
  })

  it.each([
    [1, 1],
    [2, 2],
    [18, 6],
    [99, 30],
    [100, 30],
  ])('maps legacy calendar day %i to playable turn %i without moving backwards', (calendarDay, operatingDay) => {
    expect(operatingDayForCalendarDay(calendarDay, campaign)).toBe(operatingDay)
  })

  it('advances authored delays in playable turns and clamps them to the finale', () => {
    expect(calendarDayAfterTurns(18, 2, campaign)).toBe(26)
    expect(calendarDayAfterTurns(98, 3, campaign)).toBe(100)
  })

  it('reports chapter boundaries and remaining playable decisions', () => {
    expect(campaignChapter(7, campaign)?.chapterId).toBe('chapter-opening')
    expect(campaignChapter(8, campaign)?.chapterId).toBe('chapter-neighbors')
    expect(campaignChapter(24, campaign)?.chapterId).toBe('chapter-finale')
    expect(remainingOperatingDays(1, campaign)).toBe(29)
    expect(remainingOperatingDays(30, campaign)).toBe(0)
  })
})
