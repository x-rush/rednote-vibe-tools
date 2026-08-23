import { describe, expect, it } from 'vitest'
import { shopContent } from '../content'
import { basicDecision } from '../tests/fixtures'
import { createNewGame, openDay } from '../engine/simulator'
import { buildGameViewModel } from './view-model'

describe('typed game view model', () => {
  it('resolves product, stat, event, and choice copy from content', () => {
    const state = createNewGame('view', 'save-view', shopContent.content)
    const opened = openDay(state, basicDecision, shopContent.content)
    const view = buildGameViewModel(opened.state, shopContent.content)
    expect(view.title).toBe(shopContent.content.ui.landingTitle)
    expect(view.stats.map((item) => item.label)).toEqual(['资金','口碑','体力','人情'])
    expect(view.products[0]?.name).toBe('青梅饮')
    expect(view.event?.title).toBe('第一位客人')
    expect(view.event?.choices.map((item) => item.text)).toEqual(['赠一小盏','原价售出'])
  })
})
