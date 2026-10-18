import type { ProtoCellEngine } from '../../src/game/engine'
import { setPolicyIntent as fallback } from '../../src/tests/playthrough'
export function setPolicyIntent(engine: ProtoCellEngine, elapsedMs: number) {
  const world = engine.renderSnapshot()
  const player = world.entities.find((entity) => entity.id === world.playerId)
  if (!player || world.lifecycle.tierIndex !== 1 || player.body.radius >= 60) return fallback(engine, elapsedMs, 'balanced')
  const danger = world.entities.some((entity) => entity.faction === 'hostile' && entity.body.radius > player.body.radius * 0.85 && Math.hypot(entity.position.x - player.position.x, entity.position.y - player.position.y) < player.body.radius + entity.body.radius + 75)
  const meal = world.entities.filter((entity) => entity.faction !== 'player' && entity.faction !== 'hostile' && !entity.id.startsWith('carryover-') && entity.body.radius < player.body.radius * 0.6)
    .sort((a, b) => Math.hypot(a.position.x - player.position.x, a.position.y - player.position.y) - Math.hypot(b.position.x - player.position.x, b.position.y - player.position.y))[0]
  if (!meal || danger) return fallback(engine, elapsedMs, 'balanced')
  const dx = meal.position.x - player.position.x, dy = meal.position.y - player.position.y, length = Math.hypot(dx, dy) || 1
  engine.input.move({ x: dx / length * 120, y: dy / length * 120 })
}
