import { describe, expect, it } from 'vitest'
import { moveSlip, toggleLimitedSelection, undoMove } from './replayInteraction'

describe('replay desk interactions', () => {
  it('moves a slip from fact to inference and announces the result', () => {
    expect(moveSlip({ factIds: ['fact-1'], inferenceIds: [] }, 'fact-1', 'inference')).toEqual({
      factIds: [],
      inferenceIds: ['fact-1'],
      announcement: '已移到推测：fact-1',
    })
  })

  it('undoes an inference move without duplicating the slip', () => {
    const restored = undoMove({ factIds: [], inferenceIds: ['fact-1'], announcement: '' }, 'fact-1')
    expect(restored.factIds).toEqual(['fact-1'])
    expect(restored.inferenceIds).toEqual([])
  })

  it('keeps limited multi-selection stable at two items', () => {
    expect(toggleLimitedSelection(['a', 'b'], 'c', 2)).toEqual(['a', 'b'])
    expect(toggleLimitedSelection(['a', 'b'], 'a', 2)).toEqual(['b'])
    expect(toggleLimitedSelection(['a'], 'b', 2)).toEqual(['a', 'b'])
  })
})
