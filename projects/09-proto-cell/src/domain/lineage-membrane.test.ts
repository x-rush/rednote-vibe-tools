import { describe, expect, it } from 'vitest'
import { createEntity } from '../entities/factory'
import { membraneContour, membraneSilhouette, physicalMembrane } from './membrane'
import { fullyContains } from '../game/containment'

const forms = ['form-primal-cell', 'form-colony-body', 'form-ciliate-composite'] as const
const player = (lineage: string) => createEntity({ id: 'player', role: 'player', faction: 'player', radius: 100, mass: 10000, membrane: 100, energy: 100, maxSpeed: 50, visualRecipeId: `visual-lineage-${lineage}` }, { id: 'player', position: { x: 0, y: 0 }, velocity: { x: 1, y: 0 } })

describe('lineage membrane anatomy', () => {
  it('allows the first and second encounter reversal for every inherited body', () => {
    for (const [form, size, enemyId, enemyRadius] of [
      ['form-primal-cell', 30, 'predator-azure-ring', 22],
      ['form-colony-body', 64, 'predator-fiber-stalker', 50],
    ] as const) {
      const rival = createEntity({ id: enemyId, role: 'predator', faction: 'hostile', radius: enemyRadius, mass: enemyRadius ** 2, membrane: 100, energy: 100, maxSpeed: 50, visualRecipeId: 'visual-test' }, { id: 'rival', position: { x: 0, y: 0 }, velocity: { x: 1, y: 0 } })
      for (const lineage of ['dart', 'bastion', 'bloom']) {
        const mature = player(lineage)
        mature.body.radius = size
        for (const time of [0, 600, 1200, 1800, 2400]) {
          for (const heading of [0, Math.PI / 4, Math.PI / 2, Math.PI * 0.75]) {
            rival.velocity = { x: Math.cos(heading), y: Math.sin(heading) }
            expect(fullyContains(physicalMembrane(mature, form, time), physicalMembrane(rival, form, time)), `${lineage}:${form}:${time}:${heading}`).toBe(true)
          }
        }
      }
    }
  })
  it('lets every final lineage engulf the tier rival at the actual maximum size', () => {
    const rival = createEntity({ id: 'predator-chamber-maw', role: 'predator', faction: 'hostile', radius: 105, mass: 11025, membrane: 100, energy: 100, maxSpeed: 50, visualRecipeId: 'visual-predator-chamber-maw' }, { id: 'rival', position: { x: 0, y: 0 }, velocity: { x: 1, y: 0 } })
    for (const lineage of ['dart', 'bastion', 'bloom']) {
      const mature = player(lineage)
      mature.body.radius = 176
      for (const time of [0, 600, 1200, 1800, 2400]) {
        for (const heading of [0, Math.PI / 4, Math.PI / 2]) {
          rival.velocity = { x: Math.cos(heading), y: Math.sin(heading) }
          expect(fullyContains(physicalMembrane(mature, 'form-ciliate-composite', time), physicalMembrane(rival, 'form-ciliate-composite', time)), `${lineage}:${time}:${heading}`).toBe(true)
        }
      }
    }
  })
  it('retains three genuinely different silhouettes at every evolutionary stage', () => {
    for (const form of forms) {
      const contours = ['dart', 'bastion', 'bloom'].map((lineage) => physicalMembrane(player(lineage), form, 1200).contour)
      expect(new Set(contours.map((contour) => JSON.stringify(contour))).size).toBe(3)
      for (const contour of contours) expect(contour.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true)
    }
  })
  it('keeps dart directional, bastion broad and bloom scalloped at hatching', () => {
    const contour = (lineage: string) => membraneContour(membraneSilhouette(player(lineage), forms[0]), 0, 'player')
    const extent = (points: ReturnType<typeof contour>) => ({ x: Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x)), y: Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y)) })
    const dart = extent(contour('dart'))
    const bastion = extent(contour('bastion'))
    // Keep a broad enough shoulder to swallow the round first-tier rival at cap.
    expect(dart.x / dart.y).toBeGreaterThan(1.25)
    expect(bastion.y).toBeGreaterThan(dart.y * 1.18)
    const bloomRadii = contour('bloom').map((p) => Math.hypot(p.x, p.y))
    expect(Math.max(...bloomRadii) - Math.min(...bloomRadii)).toBeGreaterThan(0.16)
  })
  it('changes each lineage membrane through both later stages without exceeding lifecycle radius', () => {
    for (const lineage of ['dart', 'bastion', 'bloom']) {
      const silhouettes = forms.map((form) => membraneSilhouette(player(lineage), form))
      expect(new Set(silhouettes).size).toBe(3)
      for (const shape of silhouettes) for (const point of membraneContour(shape, 0, 'player')) expect(Math.hypot(point.x, point.y)).toBeLessThanOrEqual(1.02)
    }
  })
})
