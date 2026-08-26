import { describe, expect, it } from 'vitest'
import { resolveConditionAnswer } from './conditionFlow'

describe('resolveConditionAnswer', () => {
  it('advances after a regular answer while preserving prior conditions', () => {
    expect(resolveConditionAnswer({ rain: true }, 'battery', 'low', false)).toEqual({
      conditions: { rain: true, battery: 'low' },
      next: 'question',
    })
  })

  it('includes the final clicked answer in conditions sent to generation', () => {
    expect(resolveConditionAnswer({}, 'return-late', true, true)).toEqual({
      conditions: { 'return-late': true },
      next: 'generate',
    })
  })
})
