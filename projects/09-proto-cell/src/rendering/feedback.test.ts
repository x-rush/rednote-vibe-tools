import { describe, expect, it, vi } from 'vitest'
import { createEntity } from '../entities/factory'
import { createRelationshipFrame, relationshipCue, relationshipPulse } from './feedback'

describe('pre-contact relationship feedback', () => {
  it('prepares the player bounds once for a crowd while retaining exact cues', () => {
    const player = entity('large', 176)
    const targets = Array.from({ length: 20 }, (_, index) => entity(`small-${index}`, 8))
    const context = { formId: 'form-ciliate-composite', elapsedMs: 1200 } as const
    const minimum = vi.spyOn(Math, 'min')
    try {
      const frame = createRelationshipFrame(player, context)
      const actual = targets.map(frame), frameWork = minimum.mock.calls.length
      minimum.mockClear()
      const expected = targets.map((target) => relationshipCue(player, target, context))
      expect(actual).toEqual(expected)
      expect(frameWork).toBeLessThan(minimum.mock.calls.length / 2)
    } finally { minimum.mockRestore() }
  })
  it('marks a clearly smaller target edible and a larger target dangerous', () => {
    expect(relationshipCue(entity('large', 20), entity('prey', 10))).toBe('edible')
    expect(relationshipCue(entity('large', 10), entity('prey', 20))).toBe('danger')
  })

  it('keeps relationship cues static when reduced flash is enabled', () => {
    expect(relationshipPulse(300, true)).toBe(1)
    expect(relationshipPulse(300, false)).not.toBe(1)
  })

  it('switches a former hunter to food after radius growth even if biomass is preserved', () => {
    const player = entity('large', 12)
    const hunter = entity('hunter', 22)
    expect(relationshipCue(player, hunter)).toBe('danger')
    player.body.radius = 30
    expect(player.mass).toBe(144)
    expect(relationshipCue(player, hunter)).toBe('edible')
    hunter.mass = 10_000
    expect(relationshipCue(player, hunter)).toBe('edible')
  })

  it('keeps similarly sized and inactive organisms unmarked', () => {
    const player = entity('large', 20)
    const rival = entity('rival', 20)
    expect(relationshipCue(player, rival)).toBe('neutral')
    rival.status = 'engulfed'
    rival.body.radius = 3
    expect(relationshipCue(player, rival)).toBe('neutral')
  })

  it('does not promise a ciliate can swallow a target larger than its short axis', () => {
    const player = entity('large', 124)
    const encounter = entity('encounter', 105)
    encounter.role = 'predator'
    const context = { formId: 'form-ciliate-composite', elapsedMs: 1200 } as const
    expect(relationshipCue(player, encounter)).toBe('edible')
    expect(relationshipCue(player, encounter, context)).toBe('neutral')
    player.body.radius = 176
    expect(relationshipCue(player, encounter, context)).toBe('edible')
    const frame = createRelationshipFrame(player, context)
    expect(frame(encounter)).toBe('edible')
    expect(frame(encounter)).toBe('edible')
  })

  it('retains true first-tier hunter reversal and symmetric danger cues', () => {
    const player = entity('large', 12)
    const ring = entity('ring', 22)
    ring.role = 'predator'
    const context = { formId: 'form-primal-cell', elapsedMs: 1200 } as const
    expect(relationshipCue(player, ring, context)).toBe('danger')
    player.body.radius = 30
    expect(relationshipCue(player, ring, context)).toBe('edible')
  })
})

function entity(id: string, radius: number) {
  return createEntity({
    id,
    role: id === 'large' ? 'player' : 'prey',
    faction: id === 'large' ? 'player' : 'neutral',
    radius,
    mass: radius ** 2,
    membrane: 10,
    energy: 10,
    maxSpeed: 40,
    visualRecipeId: 'visual-test',
  }, { id, position: { x: 0, y: 0 } })
}
