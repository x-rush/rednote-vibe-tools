import { describe, expect, it, vi } from 'vitest'
import { createEntity } from '../entities/factory'
import { fullyContains } from '../game/containment'
import { membraneContour, membranePoint, physicalMembrane } from './membrane'

const make = (id: string, radius: number, x = 0, y = 0) => createEntity({
  id, role: id === 'player' ? 'player' : 'prey', faction: id === 'player' ? 'player' : 'neutral',
  radius, mass: radius * radius, membrane: 100, energy: 100, maxSpeed: 100, visualRecipeId: 'visual-origin-primal-cell',
}, { id, position: { x, y }, velocity: { x: 1, y: 0 } })

describe('shared visible and physical membrane', () => {
  it('retains the exact former identity-and-angle hash across unicode IDs and angles', () => {
    for (const id of ['old:enemy', '细胞🧬', '']) for (const angle of [-2.1, 0.38, 1.8, 5.2]) for (const time of [210, 460, 1200]) {
      let hash = 0
      const key = `${id}:${Math.round(angle * 1000)}`
      for (let index = 0; index < key.length; index += 1) hash = Math.imul(hash ^ key.charCodeAt(index), 33)
      const phase = (hash >>> 0) / 4_294_967_296 * Math.PI * 2
      const wave = Math.sin(angle * 3 + time / 420 + phase) * 0.018
      const radius = Math.max(0.94, Math.min(1, 0.94 + wave + Math.cos(angle * 4) * 0.035))
      expect(membranePoint('hunter', angle, time, id)).toEqual({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * 0.97 })
    }
  })
  it('amortizes stable organism phases without freezing its living outline', () => {
    const hash = vi.spyOn(Math, 'imul')
    try {
      const first = membranePoint('hunter', 0.38, 210, 'phase-cache-regression')
      expect(hash.mock.calls.length).toBeGreaterThan(0)
      hash.mockClear()
      const later = membranePoint('hunter', 0.38, 460, 'phase-cache-regression')
      expect(hash.mock.calls).toHaveLength(0)
      expect(later).not.toEqual(first)
      for (let index = 0; index < 600; index += 1) membranePoint('hunter', 0.38, 210, `evicted-${index}`)
      expect(membranePoint('hunter', 0.38, 210, 'phase-cache-regression')).toEqual(first)
    } finally { hash.mockRestore() }
  })
  it('lets the mature starter colony contain its real fiber rival through pulse and relative swimming headings', () => {
    const player = make('player', 64)
    const rival = createEntity({ id: 'predator-fiber-stalker', role: 'predator', faction: 'hostile', radius: 50, mass: 2500, membrane: 100, energy: 100, maxSpeed: 50, visualRecipeId: 'visual-predator-fiber-stalker' }, {
      id: 'encounter-1', position: { x: 0, y: 0 }, velocity: { x: 1, y: 0 },
    })
    for (const time of [0, 600, 1200, 1800, 2400]) {
      for (const heading of Array.from({ length: 8 }, (_, index) => index * Math.PI / 4)) {
        rival.velocity = { x: Math.cos(heading), y: Math.sin(heading) }
        expect(fullyContains(physicalMembrane(player, 'form-colony-body', time), physicalMembrane(rival, 'form-colony-body', time)), `${time}:${heading}`).toBe(true)
      }
    }
  })

  it('does not swallow prey entirely outside the visible ciliate short axis', () => {
    const player = make('player', 100)
    const prey = make('prey', 10, 0, 85)
    // This reproduces the old false positive: a circle says fully enclosed.
    expect(fullyContains(player.body, prey.body)).toBe(true)
    expect(fullyContains(physicalMembrane(player, 'form-ciliate-composite', 0), prey.body)).toBe(false)
    prey.position = { x: 0, y: 45 }
    prey.body = make('prey', 10, 0, 45).body
    expect(fullyContains(physicalMembrane(player, 'form-ciliate-composite', 0), prey.body)).toBe(true)
  })

  it('rotates the narrow containment axis with the visible swimming heading', () => {
    const player = make('player', 100)
    player.velocity = { x: 0, y: 1 }
    const body = physicalMembrane(player, 'form-ciliate-composite', 0)
    expect(fullyContains(body, make('prey', 6, 0, 82).body)).toBe(true)
    expect(fullyContains(body, make('prey', 6, 82, 0).body)).toBe(false)
  })

  it('respects the joined colony indentation instead of the old enclosing circle', () => {
    const player = make('player', 100)
    const prey = make('prey', 4, -86, 0)
    expect(fullyContains(player.body, prey.body)).toBe(true)
    expect(fullyContains(physicalMembrane(player, 'form-colony-body', 0), prey.body)).toBe(false)
    expect(fullyContains(physicalMembrane(player, 'form-colony-body', 0), make('prey', 8).body)).toBe(true)
  })

  it('bounds every transformed contour vertex, including pulse, strain and heading', () => {
    for (const formId of ['form-primal-cell', 'form-colony-body', 'form-ciliate-composite'] as const) {
      const player = make('player', 100, 145, 265)
      player.velocity = { x: 100, y: 70 }
      const body = physicalMembrane(player, formId, 1750)
      expect(body.contour).toHaveLength(66)
      expect(body.center).toEqual(player.position)
      for (const point of body.contour) expect(Math.hypot(point.x - body.center.x, point.y - body.center.y)).toBeLessThanOrEqual(body.radius + 1e-8)
      // The helper returns transient geometry without mutating the lifecycle body.
      expect(player.body.radius).toBe(100)
    }
    expect(membraneContour('hunter', 0, 'rival')).toHaveLength(54)
  })
})
