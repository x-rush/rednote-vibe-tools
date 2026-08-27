import { describe, expect, it } from 'vitest'
import type { DailyDecision } from '../domain/types'
import { changeOperatingMode } from './decision-edit'

const menu = [
  { productId: 'drink-a', prepare: 3, price: 7 },
  { productId: 'drink-b', prepare: 3, price: 8 },
  { productId: 'drink-c', prepare: 3, price: 9 },
]
const full: DailyDecision = { menu, operatingMode: 'full', strategyId: 'player' }

describe('preparation decision edits', () => {
  it('clears stock when resting and restores a valid menu when reopening', () => {
    const rest = changeOperatingMode(full, 'rest', menu)
    expect(rest).toMatchObject({ operatingMode: 'rest', menu: [] })
    expect(changeOperatingMode(rest, 'half', menu)).toMatchObject({ operatingMode: 'half', menu })
  })
})
