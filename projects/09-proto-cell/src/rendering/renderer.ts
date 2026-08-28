import { createRng } from '../domain/rng'
import type { EntityState } from '../domain/types'
import type { WorldRenderSnapshot } from '../game/engine'
import { drawCell } from './cell'
import { drawAmbientParticles, drawDangerTelegraph, drawLiquidField, type AmbientParticle, type RenderQuality } from './effects'
import type { NumberFeed } from './numbers'

export type CanvasRenderer = {
  render(snapshot: WorldRenderSnapshot, numbers: NumberFeed): void
  setQuality(quality: RenderQuality): void
  destroy(): void
}

export function createCanvasRenderer(
  canvas: HTMLCanvasElement,
  options: { quality?: RenderQuality; visualSeed?: number } = {},
): CanvasRenderer {
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D context unavailable')

  const visualRng = createRng(options.visualSeed ?? 727).fork('render-only')
  const particles: AmbientParticle[] = Array.from({ length: 64 }, () => ({
    x: visualRng.next(),
    y: visualRng.next(),
    radius: 0.8 + visualRng.next() * 2.4,
    phase: visualRng.next() * Math.PI * 2,
  }))
  const displayedRadii = new Map<string, number>()
  let quality = options.quality ?? 'balanced'
  let destroyed = false

  return {
    render(snapshot, numbers) {
      if (destroyed) return
      const { width, height } = resizeCanvas(canvas, context)
      const player = snapshot.entities.find((entity) => entity.id === snapshot.playerId)
      const camera = player?.position ?? { x: snapshot.width / 2, y: snapshot.height / 2 }
      const zoom = player ? Math.min(3.4, Math.max(1.6, 42 / player.body.radius)) : 2.4

      context.clearRect(0, 0, width, height)
      drawLiquidField(context, width, height, snapshot.elapsedMs)

      const drawables = snapshot.entities
        .map((entity) => toDrawable(entity, camera, width, height, zoom, displayedRadii))
        .filter((item) => item.x + item.radius * 2 > 0 && item.x - item.radius * 2 < width && item.y + item.radius * 2 > 0 && item.y - item.radius * 2 < height)
        .sort((left, right) => Number(left.entity.id === snapshot.playerId) - Number(right.entity.id === snapshot.playerId))

      for (const item of drawables) {
        drawDangerTelegraph(context, item.entity, item.x, item.y, item.radius, snapshot.elapsedMs)
      }
      drawAmbientParticles(context, particles, width, height, snapshot.elapsedMs, quality)
      for (const item of drawables) {
        drawCell(context, item.entity, item.x, item.y, item.radius, snapshot.elapsedMs)
      }
      numbers.draw(context, width, height, snapshot.elapsedMs)
    },
    setQuality(nextQuality) {
      quality = nextQuality
    },
    destroy() {
      destroyed = true
      displayedRadii.clear()
    },
  }
}

function resizeCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  const width = Math.max(1, canvas.clientWidth)
  const height = Math.max(1, canvas.clientHeight)
  const ratio = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
  const pixelWidth = Math.round(width * ratio)
  const pixelHeight = Math.round(height * ratio)
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth
    canvas.height = pixelHeight
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  return { width, height }
}

function toDrawable(
  entity: EntityState,
  camera: { x: number; y: number },
  width: number,
  height: number,
  zoom: number,
  displayedRadii: Map<string, number>,
) {
  const previousRadius = displayedRadii.get(entity.id) ?? entity.body.radius
  const radius = previousRadius + (entity.body.radius - previousRadius) * 0.1
  displayedRadii.set(entity.id, radius)
  return {
    entity,
    radius: radius * zoom,
    x: width / 2 + (entity.position.x - camera.x) * zoom,
    y: height / 2 + (entity.position.y - camera.y) * zoom,
  }
}
