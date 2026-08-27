import { describe, expect, it } from 'vitest'
import { makeState } from './fixtures'

describe('V5 fixture contract', () => {
  it('starts with a same-day frozen forecast and an unused rescue', () => {
    const state = makeState()

    expect(state).toMatchObject({
      schemaVersion: 5,
      financialHealth: { phase: 'normal', rescueUsed: false },
      dayForecast: {
        day: state.day,
        operatingDay: state.operatingDay,
        weatherId: expect.any(String),
        demandGroups: expect.any(Array),
      },
    })
  })
})
