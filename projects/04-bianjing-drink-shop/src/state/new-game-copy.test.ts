import { describe, expect, it } from 'vitest'
import { newGameLabel } from './new-game-copy'

const copy = {
  firstOpening: '开张营业',
  startAnotherShop: '另开一间铺',
}

describe('newGameLabel', () => {
  it('uses first-opening language without a save and another-shop language with a save', () => {
    expect(newGameLabel(false, copy)).toBe('开张营业')
    expect(newGameLabel(true, copy)).toBe('另开一间铺')
  })
})
