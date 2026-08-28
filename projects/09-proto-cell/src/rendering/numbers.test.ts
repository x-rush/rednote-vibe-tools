import { describe, expect, it } from 'vitest'
import { createNumberFeed } from './numbers'

describe('arcade number feed', () => {
  it('aggregates same-kind gains inside 180ms', () => {
    const feed = createNumberFeed({ aggregateMs: 180, maxVisible: 8 })
    feed.push({ kind: 'biomass', amount: 8, entityId: 'player', atMs: 100 })
    feed.push({ kind: 'biomass', amount: 5, entityId: 'player', atMs: 240 })

    expect(feed.visible()).toMatchObject([{ kind: 'biomass', amount: 13, chain: 2 }])
  })

  it('keeps different kinds separate and caps visible effects', () => {
    const feed = createNumberFeed({ aggregateMs: 180, maxVisible: 2 })
    feed.push({ kind: 'biomass', amount: 2, entityId: 'player', atMs: 0 })
    feed.push({ kind: 'damage', amount: 3, entityId: 'player', atMs: 10 })
    feed.push({ kind: 'block', amount: 4, entityId: 'player', atMs: 20 })

    expect(feed.visible().map((item) => item.kind)).toEqual(['damage', 'block'])
  })
})
