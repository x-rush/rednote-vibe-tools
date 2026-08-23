import { describe, expect, it } from 'vitest'
import type { PageState } from '../domain/types'
import { transitionGame } from './game-machine'

describe('semantic page state machine', () => {
  it('supports the complete normal, bankruptcy, recovery, and error paths', () => {
    const paths: [PageState, PageState][] = [
      ['landing','newGame'], ['landing','continueGame'], ['newGame','tutorial'], ['tutorial','morning'],
      ['morning','preparation'], ['preparation','opening'], ['opening','event'], ['opening','settlement'],
      ['event','settlement'], ['settlement','morning'], ['settlement','milestone'], ['settlement','bankruptcy'],
      ['settlement','finalEnding'], ['milestone','morning'], ['continueGame','morning'], ['error','landing'],
    ]
    for (const [from, to] of paths) expect(transitionGame({ page: from }, { type: 'navigate', to })).toMatchObject({ page: to })
  })

  it('routes illegal transitions to a recoverable error', () => {
    expect(transitionGame({ page: 'landing' }, { type: 'navigate', to: 'finalEnding' })).toEqual({ page: 'error', error: '不允许从 landing 进入 finalEnding' })
  })

  it('ignores a duplicated event resolution ID', () => {
    const once = transitionGame({ page: 'event' }, { type: 'resolve-event', resolutionId: 'day-1' })
    expect(once).toEqual({ page: 'settlement', lastResolutionId: 'day-1' })
    expect(transitionGame(once, { type: 'resolve-event', resolutionId: 'day-1' })).toEqual(once)
  })
})
