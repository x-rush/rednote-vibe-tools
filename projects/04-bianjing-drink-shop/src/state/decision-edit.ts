import type { DailyDecision, MenuDecision, OperatingMode } from '../domain/types'

export function changeOperatingMode(
  current: DailyDecision,
  operatingMode: OperatingMode,
  fallbackMenu: MenuDecision[],
): DailyDecision {
  if (operatingMode === 'rest') return { ...current, operatingMode, menu: [] }
  return {
    ...current,
    operatingMode,
    menu: current.menu.length >= 3 ? current.menu : fallbackMenu,
  }
}
