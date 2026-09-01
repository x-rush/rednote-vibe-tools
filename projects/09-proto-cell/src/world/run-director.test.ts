import { describe, expect, it } from 'vitest'
import { getContent } from '../content'
import type { GameEvent } from '../game/interactions'
import { createRunDirector, stepRunDirector } from './run-director'

function forceFirstMigration(seed: number) {
  const content = getContent()
  let state = createRunDirector(content.journey, seed, 3, content.firstRunAssist)
  state = stepRunDirector(state, { atMs: 45_000 }).state
  state = stepRunDirector(state, { atMs: 60_000 }).state
  const result = stepRunDirector(state, { atMs: 72_000 })
  return result.events.find((event): event is Extract<GameEvent, { type: 'migration-forced' }> => event.type === 'migration-forced')!
}

describe('deterministic run director', () => {
  it('advances a scale tier only after pressure and its encounter resolve', () => {
    const content = getContent()
    const state = createRunDirector(content.scaleTiers, 727, 0, content.firstRunAssist)
    const waiting = stepRunDirector(state, { atMs: 150_000, pressureReady: true, encounterResolved: false })
    expect(waiting.state.tierIndex).toBe(0)
    const ready = stepRunDirector(state, { atMs: 150_000, pressureReady: true, encounterResolved: true })
    expect(ready.state).toMatchObject({ tierIndex: 0, phase: 'transition' })
    expect(ready.events).toContainEqual(expect.objectContaining({ type: 'tier-encounter-resolved', tierIndex: 0 }))
  })

  it('finishes after the ciliate encounter instead of entering a fourth stage', () => {
    const content = getContent()
    const final = { ...createRunDirector(content.scaleTiers, 727, 0, content.firstRunAssist), tierIndex: 2, stageIndex: 2, phase: 'encounter' as const }
    expect(stepRunDirector(final, { atMs: 600_000, pressureReady: true, encounterResolved: true }).state.phase).toBe('complete')
  })

  it('warns, offers migration, and forces a route by the collapse deadline', () => {
    const content = getContent()
    let state = createRunDirector(content.journey, 727, 3, content.firstRunAssist)

    const warning = stepRunDirector(state, { atMs: 45_000 })
    expect(warning.state.phase).toBe('warning')
    expect(warning.events).toEqual([expect.objectContaining({ type: 'collapse-warning', stageIndex: 1 })])

    const offered = stepRunDirector(warning.state, { atMs: 60_000 })
    expect(offered.state.phase).toBe('choosing')
    expect(offered.events).toContainEqual(expect.objectContaining({ type: 'migration-ready', stageIndex: 1 }))

    const forced = stepRunDirector(offered.state, { atMs: 72_000 })
    expect(forced.events).toContainEqual(expect.objectContaining({ type: 'migration-forced' }))
    expect(forced.events).toContainEqual(expect.objectContaining({ type: 'route-selected' }))
    expect(forced.state.stageIndex).toBe(1)
  })

  it('chooses the same fallback route for the same seed', () => {
    const first = forceFirstMigration(727)
    const second = forceFirstMigration(727)

    expect(first.destinationEnvironmentId).toBe(second.destinationEnvironmentId)
    expect(first.routeId).toBe(second.routeId)
  })

  it('starts the collapse warning earlier during the first three runs', () => {
    const content = getContent()
    const state = createRunDirector(content.journey, 727, 0, content.firstRunAssist)

    expect(stepRunDirector(state, { atMs: 42_000 }).state.phase).toBe('warning')
  })

  it('accepts an offered route once and rejects an unknown route', () => {
    const content = getContent()
    let state = createRunDirector(content.journey, 727, 3, content.firstRunAssist)
    state = stepRunDirector(state, { atMs: 45_000 }).state
    state = stepRunDirector(state, { atMs: 60_000 }).state

    const ignored = stepRunDirector(state, { atMs: 60_001, selectedRouteId: 'journey-route-missing' })
    expect(ignored.events).toEqual([])
    expect(ignored.state.stageIndex).toBe(0)

    const selected = stepRunDirector(ignored.state, { atMs: 60_002, selectedRouteId: content.journey.stages[0].routeOffers[0].id })
    expect(selected.events).toEqual([expect.objectContaining({ type: 'route-selected', routeId: 'journey-route-algae-feast' })])
    expect(selected.state.stageIndex).toBe(1)

    expect(stepRunDirector(selected.state, { atMs: 60_002, selectedRouteId: content.journey.stages[0].routeOffers[0].id }).events).toEqual([])
  })
})
