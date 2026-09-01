import { describe, expect, it } from 'vitest'
import { getContent } from '../content'
import { createEcologyDirector, stepEcologyDirector } from './ecology-director'

function simulateEcology(options: { seed: number; durationMs: number; runOrdinal?: number }) {
  const content = getContent()
  const budget = content.ecologyBudgets.find((item) => item.environmentId === 'env-clear-drop')!
  let state = createEcologyDirector(budget, options.seed, options.runOrdinal ?? 3, content.firstRunAssist, 0)
  const minimum = { ...state.summary.population }
  const maximum = { ...state.summary.population }
  const distances: number[] = []
  const opportunities: string[] = []
  let firstNearbyEdibleAtMs: number | undefined

  for (let atMs = 1000; atMs <= options.durationMs; atMs += 1000) {
    const result = stepEcologyDirector(state, {
      atMs,
      playerPosition: { x: 320, y: 550 },
      viewportRadius: 320,
      nearbyEdibleCount: 0,
      visibleEntities: [],
    })
    state = result.state
    for (const role of Object.keys(state.summary.population) as Array<keyof typeof state.summary.population>) {
      minimum[role] = Math.min(minimum[role], state.summary.population[role])
      maximum[role] = Math.max(maximum[role], state.summary.population[role])
    }
    for (const command of result.commands) {
      if (command.type === 'materialize-group') {
        distances.push(command.distance)
        if ((command.role === 'resource' || command.role === 'prey') && command.distance <= 160 && firstNearbyEdibleAtMs === undefined) firstNearbyEdibleAtMs = atMs
      }
      if (command.type === 'start-opportunity') opportunities.push(command.opportunityId)
    }
  }
  return { minimum, maximum, distances, opportunities, firstNearbyEdibleAtMs }
}

describe('population ecology director', () => {
  it('maintains a food-chain pyramid without spawning every entity near the player', () => {
    const result = simulateEcology({ seed: 727, durationMs: 180_000 })

    expect(result.minimum.resource).toBeGreaterThan(result.maximum.hunter)
    expect(result.distances.some((distance) => distance > 320)).toBe(true)
  })

  it('does not repeat an opportunity inside the last three scenes', () => {
    const scenes = simulateEcology({ seed: 727, durationMs: 90_000 }).opportunities
    expect(scenes.length).toBeGreaterThanOrEqual(4)
    for (let index = 3; index < scenes.length; index += 1) {
      expect(scenes.slice(index - 3, index)).not.toContain(scenes[index])
    }
  })

  it('guarantees nearby edible food by five seconds in the first three runs', () => {
    for (const runOrdinal of [0, 1, 2]) {
      const result = simulateEcology({ seed: 727, durationMs: 5000, runOrdinal })
      expect(result.firstNearbyEdibleAtMs).toBeLessThanOrEqual(5000)
    }
  })
})
