import type { CampaignChapterDefinition, CampaignDefinition } from '../content/schema'

const clampOperatingDay = (operatingDay: number, campaign: CampaignDefinition) =>
  Math.min(campaign.operatingDays.length, Math.max(1, Math.trunc(operatingDay)))

export function calendarDayForOperatingDay(operatingDay: number, campaign: CampaignDefinition): number {
  return campaign.operatingDays[clampOperatingDay(operatingDay, campaign) - 1]
}

export function operatingDayForCalendarDay(calendarDay: number, campaign: CampaignDefinition): number {
  const firstNotEarlier = campaign.operatingDays.findIndex((day) => day >= calendarDay)
  return firstNotEarlier === -1 ? campaign.operatingDays.length : firstNotEarlier + 1
}

export function calendarDayAfterTurns(calendarDay: number, turns: number, campaign: CampaignDefinition): number {
  const current = operatingDayForCalendarDay(calendarDay, campaign)
  return calendarDayForOperatingDay(current + Math.max(0, Math.trunc(turns)), campaign)
}

export function remainingOperatingDays(operatingDay: number, campaign: CampaignDefinition): number {
  return Math.max(0, campaign.operatingDays.length - clampOperatingDay(operatingDay, campaign))
}

export function campaignChapter(operatingDay: number, campaign: CampaignDefinition): CampaignChapterDefinition | undefined {
  return campaign.chapters.find((chapter) =>
    operatingDay >= chapter.operatingDayRange[0] && operatingDay <= chapter.operatingDayRange[1])
}
