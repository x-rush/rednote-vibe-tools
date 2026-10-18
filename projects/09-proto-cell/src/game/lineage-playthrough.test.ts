import { describe, expect, it } from 'vitest'
import { runHeadless } from '../tests/playthrough'
import { createDefaultSave } from '../storage/codec'
import { unlockNode } from '../progression/genes'

describe('normal lineage food-chain runs', () => {
  it.each([
    { seed: 727, lineageArchetypeId: 'lineage-dart' },
    { seed: 728, lineageArchetypeId: 'lineage-bastion' },
    { seed: 729, lineageArchetypeId: 'lineage-bloom' },
  ])('$lineageArchetypeId reaches and defeats the third-tier rival from a fresh run (seed $seed)', (options) => {
    // A flagellum-bearing parent has unlocked this free node; its offspring keeps that earned gene pool.
    const parentalGenes = unlockNode(createDefaultSave().progression, 'gene-origin-primal')
    const report = runHeadless({ ...options, durationMs: 720_000, policy: 'balanced', inheritedOrganelleIds: ['organelle-flagellum'], unlockedIds: parentalGenes.unlockedIds })
    expect(report.initialRecipeId).toBe(`visual-${options.lineageArchetypeId}`)
    expect(report.invalidNumbers).toEqual([])
    expect(report.stageSignature, JSON.stringify({ time: report.simulatedMs, morphology: report.morphologySignature, ecosystem: report.finalEcosystem })).toBe('1>2>3')
    expect(report.endingId, JSON.stringify({ time: report.simulatedMs, state: report.finalEcosystem })).toBeDefined()
    expect(report.keyEvents.filter((event) => event.type === 'mutation-selected')).toHaveLength(6)
    expect(report.morphologySignature).toContain('organelle-flagellum:')
    expect(report.keyEvents.filter((event) => event.type === 'engulfed' && event.predatorId === 'player' && event.preyId.startsWith('encounter-'))).toHaveLength(3)
    expect(report.consumedCarryoverIds.some((id) => report.fleeingCarryoverIds.includes(id))).toBe(true)
    expect(report.leviathanPhases).toEqual(expect.arrayContaining(['armored', 'exposed', 'consumed']))
    expect(report.keyEvents).toContainEqual(expect.objectContaining({ type: 'engulfed', preyId: 'encounter-2', finisher: true, reversal: true }))
    const finisher = report.keyEvents.find((event) => event.type === 'engulfed' && event.finisher)!
    expect(report.keyEvents.filter((event) => event.type === 'mutation-ready' && event.atMs >= finisher.atMs && event.atMs - finisher.atMs < 1500)).toEqual([])
    expect(report.finaleStartedAtMs).toBeDefined()
    expect(report.simulatedMs - report.finaleStartedAtMs!).toBeGreaterThanOrEqual(1499)
    expect(report.finaleMembraneStable).toBe(true)
  }, 60_000)
})
