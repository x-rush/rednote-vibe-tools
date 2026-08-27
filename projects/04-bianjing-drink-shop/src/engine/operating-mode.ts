import type { DailyDecision, OperatingMode } from '../domain/types'

export function resolveOperatingMode(decision: DailyDecision): OperatingMode {
  return decision.operatingMode
}
