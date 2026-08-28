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
      drawEnvironmentField(context, snapshot, camera, width, height, zoom)
      drawEventField(context, snapshot, camera, width, height, zoom)

      const drawables = snapshot.entities
        .map((entity) => toDrawable(entity, camera, width, height, zoom, displayedRadii))
        .filter((item) => item.x + item.radius * 2 > 0 && item.x - item.radius * 2 < width && item.y + item.radius * 2 > 0 && item.y - item.radius * 2 < height)
        .sort((left, right) => Number(left.entity.id === snapshot.playerId) - Number(right.entity.id === snapshot.playerId))

      for (const item of drawables) {
        if (item.entity.id === snapshot.boss?.id && snapshot.boss.phase === 'dormant') {
          drawBossArrivalTelegraph(context, item.x, item.y, item.radius, snapshot.elapsedMs)
        } else {
          drawDangerTelegraph(context, item.entity, item.x, item.y, item.radius, snapshot.elapsedMs)
        }
      }
      drawAmbientParticles(context, particles, width, height, snapshot.elapsedMs, quality)
      drawRouteRifts(context, snapshot, camera, width, height, zoom)
      for (const item of drawables) {
        drawCell(context, item.entity, item.x, item.y, item.radius, snapshot.elapsedMs)
        if (item.entity.id === snapshot.boss?.id && snapshot.boss.phase !== 'dormant') {
          drawBossPhase(context, item.x, item.y, item.radius, snapshot.boss, snapshot.elapsedMs)
        }
      }
      drawVisibilityVeil(context, snapshot.environmentField.visibility, width, height)
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

function drawEnvironmentField(
  context: CanvasRenderingContext2D,
  snapshot: WorldRenderSnapshot,
  camera: { x: number; y: number },
  width: number,
  height: number,
  zoom: number,
) {
  const field = snapshot.environmentField
  context.save()
  for (const obstacle of field.obstacles) {
    const from = {
      x: width / 2 + (obstacle.from.x - camera.x) * zoom,
      y: height / 2 + (obstacle.from.y - camera.y) * zoom,
    }
    const to = {
      x: width / 2 + (obstacle.to.x - camera.x) * zoom,
      y: height / 2 + (obstacle.to.y - camera.y) * zoom,
    }
    context.globalAlpha = 0.72
    context.strokeStyle = obstacle.adhesive ? '#89e2c5' : '#87a3be'
    context.lineWidth = obstacle.kind === 'chamber-wall' ? 8 : 5
    context.setLineDash(obstacle.adhesive ? [4, 7] : [])
    context.beginPath()
    context.moveTo(from.x, from.y)
    context.lineTo(to.x, to.y)
    context.stroke()
  }
  if (field.environmentId === 'env-acid-vesicle' && field.safeCenters.length > 0) {
    const safe = field.safeCenters[0]!
    const safeX = width / 2 + (safe.x - camera.x) * zoom
    const safeY = height / 2 + (safe.y - camera.y) * zoom
    context.globalAlpha = field.activeHazardIds.includes('hazard-acid-discharge') ? 0.2 : 0.1
    context.fillStyle = '#d94f68'
    context.beginPath()
    context.rect(0, 0, width, height)
    context.arc(safeX, safeY, 92 * zoom, 0, Math.PI * 2, true)
    context.fill('evenodd')
  }
  for (const cue of field.telegraphs) {
    const center = field.hazardCenters[cue.hazardId] ?? cue.center
    const x = width / 2 + (center.x - camera.x) * zoom
    const y = height / 2 + (center.y - camera.y) * zoom
    const radius = cue.radius * zoom
    const active = field.activeHazardIds.includes(cue.hazardId)
    const telegraphing = snapshot.elapsedMs >= cue.startsAtMs && snapshot.elapsedMs < cue.activatesAtMs
    if (!active && !telegraphing) continue
    if (field.environmentId === 'env-acid-vesicle' && cue.hazardId === 'hazard-acid-discharge') continue
    const pulse = 0.95 + Math.sin(snapshot.elapsedMs / 170) * 0.05
    context.globalAlpha = active ? 0.18 : 0.68
    context.strokeStyle = active ? '#ff806c' : '#ffe595'
    context.fillStyle = cue.hazardId.includes('acid') ? '#ce5d74' : '#7099d8'
    context.lineWidth = active ? 2 : 4
    context.setLineDash(active ? [] : [9, 8])
    context.beginPath()
    context.arc(x, y, radius * pulse, 0, Math.PI * 2)
    if (active) context.fill()
    context.stroke()
  }
  context.setLineDash([])
  context.strokeStyle = '#9dffd1'
  context.lineWidth = 3
  context.globalAlpha = 0.76
  for (const center of field.safeCenters) {
    const x = width / 2 + (center.x - camera.x) * zoom
    const y = height / 2 + (center.y - camera.y) * zoom
    context.beginPath()
    context.arc(x, y, 92 * zoom, 0, Math.PI * 2)
    context.stroke()
  }
  context.restore()
}

function drawVisibilityVeil(
  context: CanvasRenderingContext2D,
  visibility: number,
  width: number,
  height: number,
) {
  const opacity = Math.max(0, Math.min(0.38, (1 - visibility) * 0.5))
  if (opacity <= 0) return
  const gradient = context.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.12, width / 2, height / 2, Math.max(width, height) * 0.65)
  gradient.addColorStop(0, 'rgba(4, 10, 20, 0)')
  gradient.addColorStop(1, `rgba(4, 10, 20, ${opacity})`)
  context.save()
  context.fillStyle = gradient
  context.fillRect(0, 0, width, height)
  context.restore()
}

function drawBossArrivalTelegraph(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  elapsedMs: number,
) {
  context.save()
  context.globalAlpha = 0.62
  context.strokeStyle = '#9acaff'
  context.setLineDash([12, 9])
  for (let ring = 1; ring <= 3; ring += 1) {
    context.lineWidth = 4 - ring * 0.7
    context.beginPath()
    context.arc(x, y, radius * (1.25 + ring * 0.28 + Math.sin(elapsedMs / 240 + ring) * 0.04), 0, Math.PI * 2)
    context.stroke()
  }
  context.restore()
}

function drawEventField(
  context: CanvasRenderingContext2D,
  snapshot: WorldRenderSnapshot,
  camera: { x: number; y: number },
  width: number,
  height: number,
  zoom: number,
) {
  const event = snapshot.activeEvent
  if (!event || event.phase === 'expired') return
  const x = width / 2 + (event.center.x - camera.x) * zoom
  const y = height / 2 + (event.center.y - camera.y) * zoom
  const radius = event.variant.radius * zoom
  const pulse = 0.94 + Math.sin(snapshot.elapsedMs / 180) * 0.04
  context.save()
  context.globalAlpha = event.phase === 'telegraph' ? 0.5 : 0.22
  context.strokeStyle = '#ffe08b'
  context.fillStyle = '#ffd36a'
  context.lineWidth = event.phase === 'telegraph' ? 3 : 1.5
  context.setLineDash(event.phase === 'telegraph' ? [10, 9] : [])
  context.beginPath()
  context.arc(x, y, radius * pulse, 0, Math.PI * 2)
  context.stroke()
  if (event.phase === 'active') context.fill()
  if (event.phase === 'active') {
    const flow = event.aiSignals[0]?.flow ?? { x: 0, y: 0 }
    const flowLength = Math.hypot(flow.x, flow.y)
    if (flowLength > 0) {
      const direction = { x: flow.x / flowLength, y: flow.y / flowLength }
      context.globalAlpha = 0.46
      context.strokeStyle = '#fff2b5'
      context.setLineDash([5, 7])
      for (let lane = -2; lane <= 2; lane += 1) {
        const perpendicular = { x: -direction.y * lane * radius * 0.16, y: direction.x * lane * radius * 0.16 }
        context.beginPath()
        context.moveTo(x + perpendicular.x - direction.x * radius * 0.45, y + perpendicular.y - direction.y * radius * 0.45)
        context.lineTo(x + perpendicular.x + direction.x * radius * 0.45, y + perpendicular.y + direction.y * radius * 0.45)
        context.stroke()
      }
    }
  }
  context.restore()
}

function drawRouteRifts(
  context: CanvasRenderingContext2D,
  snapshot: WorldRenderSnapshot,
  camera: { x: number; y: number },
  width: number,
  height: number,
  zoom: number,
) {
  for (const [index, rift] of snapshot.routeRifts.entries()) {
    if (snapshot.elapsedMs < rift.opensAtMs - 12_000) continue
    const x = width / 2 + (rift.position.x - camera.x) * zoom
    const y = height / 2 + (rift.position.y - camera.y) * zoom
    const radius = rift.radius * zoom
    const open = snapshot.elapsedMs >= rift.opensAtMs
    const pulse = 0.82 + Math.sin(snapshot.elapsedMs / 340 + index) * 0.12
    context.save()
    context.globalAlpha = open ? 0.88 : 0.42
    context.strokeStyle = index === 0 ? '#8dffcf' : '#ffca78'
    context.lineWidth = open ? 3 : 1.5
    context.setLineDash(open ? [] : [6, 8])
    context.beginPath()
    context.arc(x, y, radius * pulse, 0, Math.PI * 2)
    context.stroke()
    context.globalAlpha *= 0.3
    context.beginPath()
    context.arc(x, y, radius * 0.62, 0, Math.PI * 2)
    context.fillStyle = context.strokeStyle
    context.fill()
    drawRiftIntel(context, x, y, radius, rift)
    context.restore()
  }
}

function drawRiftIntel(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  rift: WorldRenderSnapshot['routeRifts'][number],
) {
  const size = Math.max(7, Math.min(14, radius * 0.22))
  const iconRadius = radius * 0.72

  context.globalAlpha = 1
  context.lineWidth = 2
  context.setLineDash([])

  const hazardX = x
  const hazardY = y - iconRadius
  context.strokeStyle = '#ff806c'
  context.fillStyle = '#391a23'
  context.beginPath()
  context.moveTo(hazardX, hazardY - size)
  context.lineTo(hazardX + size, hazardY + size * 0.8)
  context.lineTo(hazardX - size, hazardY + size * 0.8)
  context.closePath()
  context.fill()
  context.stroke()
  context.beginPath()
  if (rift.hazardId.includes('acid')) {
    context.arc(hazardX, hazardY + size * 0.25, size * 0.23, 0, Math.PI * 2)
  } else {
    context.moveTo(hazardX - size * 0.18, hazardY - size * 0.45)
    context.lineTo(hazardX + size * 0.12, hazardY)
    context.lineTo(hazardX - size * 0.1, hazardY + size * 0.48)
  }
  context.stroke()

  const resourceX = x - iconRadius * 0.82
  const resourceY = y + iconRadius * 0.58
  context.strokeStyle = '#91fff1'
  context.fillStyle = '#123a3c'
  if (rift.resourceId.includes('sugar')) {
    for (const offset of [-0.42, 0.42]) {
      context.beginPath()
      context.arc(resourceX + offset * size, resourceY, size * 0.52, 0, Math.PI * 2)
      context.fill()
      context.stroke()
    }
  } else {
    context.beginPath()
    context.moveTo(resourceX, resourceY - size)
    context.lineTo(resourceX + size * 0.72, resourceY)
    context.lineTo(resourceX, resourceY + size)
    context.lineTo(resourceX - size * 0.72, resourceY)
    context.closePath()
    context.fill()
    context.stroke()
  }

  const affinityX = x + iconRadius * 0.82
  const affinityY = resourceY
  context.strokeStyle = '#c6a8ff'
  context.fillStyle = '#2a2047'
  if (rift.affinityIconId.includes('armor')) {
    context.beginPath()
    context.moveTo(affinityX, affinityY - size)
    context.lineTo(affinityX + size * 0.78, affinityY - size * 0.55)
    context.lineTo(affinityX + size * 0.55, affinityY + size * 0.45)
    context.lineTo(affinityX, affinityY + size)
    context.lineTo(affinityX - size * 0.55, affinityY + size * 0.45)
    context.lineTo(affinityX - size * 0.78, affinityY - size * 0.55)
    context.closePath()
    context.fill()
    context.stroke()
  } else {
    context.beginPath()
    context.moveTo(affinityX, affinityY + size)
    context.lineTo(affinityX, affinityY - size * 0.25)
    context.quadraticCurveTo(affinityX - size, affinityY - size, affinityX - size * 0.78, affinityY + size * 0.08)
    context.moveTo(affinityX, affinityY - size * 0.2)
    context.quadraticCurveTo(affinityX + size, affinityY - size, affinityX + size * 0.78, affinityY + size * 0.08)
    context.stroke()
  }
}

function drawBossPhase(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  boss: NonNullable<WorldRenderSnapshot['boss']>,
  elapsedMs: number,
) {
  context.save()
  const pulse = 1 + Math.sin(elapsedMs / 130) * 0.045
  if (boss.phase === 'feeding') {
    const ratio = boss.outerMembrane / Math.max(1, boss.outerMembraneMax)
    context.strokeStyle = '#88dcff'
    context.globalAlpha = 0.42 + ratio * 0.42
    context.lineWidth = 3 + ratio * 3
    context.beginPath()
    context.arc(x, y, radius * 1.18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio)
    context.stroke()
  } else {
    const ratio = boss.coreIntegrity / Math.max(1, boss.coreIntegrityMax)
    context.strokeStyle = boss.phase === 'enraged' ? '#ff5e78' : '#ffe189'
    context.globalAlpha = 0.82
    context.lineWidth = boss.phase === 'enraged' ? 5 : 3
    context.setLineDash(boss.phase === 'exposed' ? [5, 5] : [])
    context.beginPath()
    context.arc(x, y, radius * (0.52 * pulse), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio)
    context.stroke()
    if (boss.phase === 'enraged') {
      for (let index = 0; index < 8; index += 1) {
        const angle = index / 8 * Math.PI * 2 + elapsedMs / 700
        context.beginPath()
        context.moveTo(x + Math.cos(angle) * radius * 1.06, y + Math.sin(angle) * radius * 1.06)
        context.lineTo(x + Math.cos(angle) * radius * 1.34, y + Math.sin(angle) * radius * 1.34)
        context.stroke()
      }
    }
  }
  context.restore()
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
