import { describe, expect, it } from 'vitest'
import { shopContent } from '../content'
import { seedRng } from '../domain/rng'
import { makeState } from '../tests/fixtures'
import { createDayForecast, withDayForecast } from './forecast'

describe('frozen morning forecast', () => {
  const content = shopContent.content

  it('deterministically selects one eligible weather and market signal for the day', () => {
    const initial = makeState({ day: 26, dayForecast: undefined, rngState: seedRng('forecast-26') })
    const first = createDayForecast(initial, content)
    const replay = createDayForecast(initial, content)

    expect(first).toEqual(replay)
    expect(first.forecast.day).toBe(26)
    expect(first.forecast.demandGroups).toHaveLength(content.demandSegments.length)
    expect(first.forecast.demandGroups.every((group) => group.expectedCustomers >= 0 && group.actualCustomers >= 0)).toBe(true)

    const signal = content.marketSignals.find((item) => item.signalId === first.forecast.marketSignalId)
    expect(signal).toBeDefined()
    expect(signal?.dayRange[0]).toBeLessThanOrEqual(26)
    expect(signal?.dayRange[1]).toBeGreaterThanOrEqual(26)
    expect(signal?.seasonIds).toContain(first.forecast.seasonId)
    expect(signal?.weatherIds).toContain(first.forecast.weatherId)
  })

  it('keeps the same forecast and RNG when the current day is already frozen', () => {
    const initial = makeState()
    const frozen = withDayForecast(initial, content)

    expect(frozen).toBe(initial)
    expect(frozen.dayForecast).toBe(initial.dayForecast)
    expect(frozen.rngState).toBe(initial.rngState)
  })

  it('replaces a stale forecast exactly once and advances the RNG', () => {
    const initial = { ...makeState(), day: 11 }
    const refreshed = withDayForecast(initial, content)
    const repeated = withDayForecast(refreshed, content)

    expect(refreshed).not.toBe(initial)
    expect(refreshed.dayForecast?.day).toBe(11)
    expect(refreshed.rngState).not.toEqual(initial.rngState)
    expect(repeated).toBe(refreshed)
  })
})
