import { describe, expect, it } from 'vitest'
import { advanceCodex } from './codex'

describe('codex progression', () => {
  it('only advances unseen to seen to defeated-by or complete', () => {
    const seen = advanceCodex({}, 'creature-drifter', 'seen')
    const defeated = advanceCodex(seen, 'creature-drifter', 'defeated-by')
    const complete = advanceCodex(defeated, 'creature-drifter', 'complete')
    expect(advanceCodex(complete, 'creature-drifter', 'seen')).toEqual(complete)
  })

  it('does not mutate the prior codex', () => {
    const prior = { 'creature-drifter': 'seen' as const }
    expect(advanceCodex(prior, 'creature-drifter', 'complete')).not.toBe(prior)
    expect(prior['creature-drifter']).toBe('seen')
  })
})
