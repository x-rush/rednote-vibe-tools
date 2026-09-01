import { describe, expect, it } from 'vitest'
import { createEntity } from '../entities/factory'
import { relationshipCue, relationshipPulse } from './feedback'

describe('pre-contact relationship feedback', () => {
  it('marks a clearly smaller target edible and a larger target dangerous', () => {
    expect(relationshipCue(entity('large', 20), entity('prey', 10))).toBe('edible')
    expect(relationshipCue(entity('large', 10), entity('prey', 20))).toBe('danger')
  })

  it('keeps relationship cues static when reduced flash is enabled', () => {
    expect(relationshipPulse(300, true)).toBe(1)
    expect(relationshipPulse(300, false)).not.toBe(1)
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
