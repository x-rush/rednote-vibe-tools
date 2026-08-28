import { createRng } from '../domain/rng'
import type { EntityState } from '../domain/types'
import type { WorldRenderSnapshot } from '../game/engine'
import { cellVisualProfile, drawCell } from './cell'
import { drawAmbientParticles, drawDangerTelegraph, drawLiquidField, type AmbientParticle, type RenderQuality } from './effects'
import type { NumberFeed } from './numbers'
import { assetPath } from '../content/assets'
import rawContent from '../content/content.json'

export type CanvasRenderer = {
  render(snapshot: WorldRenderSnapshot, numbers: NumberFeed): void
  playerScreenPosition(): { x: number; y: number }
  setQuality(quality: RenderQuality): void
  destroy(): void
}

export function createCameraTracker(): {
  update(player: Pick<EntityState, 'position' | 'velocity'>, elapsedMs: number): { x: number; y: number }
} {
  let position: { x: number; y: number } | undefined
  let previousPlayerPosition: { x: number; y: number } | undefined
  let previousElapsedMs = 0
  return {
    update(player, elapsedMs) {
      const teleported = previousPlayerPosition
        ? Math.hypot(player.position.x - previousPlayerPosition.x, player.position.y - previousPlayerPosition.y) > 240
        : false
      previousPlayerPosition = { ...player.position }
      if (!position || elapsedMs < previousElapsedMs || teleported) {
        position = { ...player.position }
        previousElapsedMs = elapsedMs
        return { ...position }
      }
      const deltaMs = Math.min(50, Math.max(1, elapsedMs - previousElapsedMs))
      previousElapsedMs = elapsedMs
      const target = {
        x: player.position.x + player.velocity.x * 0.2,
        y: player.position.y + player.velocity.y * 0.2,
      }
      const blend = 1 - Math.exp(-deltaMs / 125)
      position = {
        x: position.x + (target.x - position.x) * blend,
        y: position.y + (target.y - position.y) * blend,
      }
      return { ...position }
    },
  }
}

export function worldTextureOffset(
  camera: { x: number; y: number },
  _tile: { width: number; height: number },
  parallax: number,
): { x: number; y: number } {
  return {
    x: camera.x === 0 ? 0 : -camera.x * parallax,
    y: camera.y === 0 ? 0 : -camera.y * parallax,
  }
}

export function createZoomTracker(): { update(radius: number, elapsedMs: number): number } {
  let zoom: number | undefined
  let previousElapsedMs = 0
  return {
    update(radius, elapsedMs) {
      const target = Math.min(3.4, Math.max(1.6, 42 / Math.max(1, radius)))
      if (zoom === undefined || elapsedMs < previousElapsedMs) {
        zoom = target
        previousElapsedMs = elapsedMs
        return zoom
      }
      const deltaMs = Math.min(50, Math.max(1, elapsedMs - previousElapsedMs))
      previousElapsedMs = elapsedMs
      zoom += (target - zoom) * (1 - Math.exp(-deltaMs / 180))
      return zoom
    },
  }
}

export function worldBoundaryScreenRect(
  camera: { x: number; y: number },
  world: { width: number; height: number },
  viewport: { width: number; height: number },
  zoom: number,
): { x: number; y: number; width: number; height: number } {
  return {
    x: viewport.width / 2 - camera.x * zoom,
    y: viewport.height / 2 - camera.y * zoom,
    width: world.width * zoom,
    height: world.height * zoom,
  }
}

export function swarmTransitionPresentation(ageMs: number, reducedMotion: boolean): { radiusScale: number; textOffset: number; alpha: number } | undefined {
  if (ageMs < 0 || ageMs > 900) return undefined
  if (reducedMotion) return { radiusScale: 1.2, textOffset: 0, alpha: 0.72 }
  const progress = ageMs / 900
  return { radiusScale: 1.15 + progress * 1.8, textOffset: progress * 12, alpha: 1 - progress }
}

export function foodBloomPresentation(ageMs: number, reducedMotion: boolean): { radiusScale: number; alpha: number } | undefined {
  if (ageMs < 0 || ageMs > 850) return undefined
  if (reducedMotion) return { radiusScale: 1.25, alpha: 0.3 }
  const progress = ageMs / 850
  return { radiusScale: 1.2 + progress * 2.4, alpha: (1 - progress) * 0.55 }
}

export function createCanvasRenderer(
  canvas: HTMLCanvasElement,
  options: { quality?: RenderQuality; visualSeed?: number; reducedMotion?: boolean; reducedFlash?: boolean; lowParticles?: boolean } = {},
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
  const assetImages = new Map<string, HTMLImageElement>()
  const cameraTracker = createCameraTracker()
  const zoomTracker = createZoomTracker()
  let currentPlayerScreenPosition = { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 }
  let quality = options.quality ?? 'balanced'
  let destroyed = false

  return {
    render(snapshot, numbers) {
      if (destroyed) return
      const { width, height } = resizeCanvas(canvas, context)
      const player = snapshot.entities.find((entity) => entity.id === snapshot.playerId)
      const camera = player ? cameraTracker.update(player, snapshot.elapsedMs) : { x: snapshot.width / 2, y: snapshot.height / 2 }
      const zoom = player ? zoomTracker.update(player.body.radius, snapshot.elapsedMs) : 2.4
      currentPlayerScreenPosition = player ? {
        x: width / 2 + (player.position.x - camera.x) * zoom,
        y: height / 2 + (player.position.y - camera.y) * zoom,
      } : { x: width / 2, y: height / 2 }

      context.clearRect(0, 0, width, height)
      const visualTime = options.reducedMotion ? 0 : snapshot.elapsedMs
      drawLiquidField(context, width, height, visualTime, camera)
      drawBackdropAsset(context, loadAsset('environment-caustics'), width, height, camera, zoom, 0.52, 0.12)
      drawBackdropAsset(context, loadAsset(snapshot.environmentId), width, height, camera, zoom, 0.3, 0.2)
      if (usesFiberBackdrop(snapshot.environmentId)) {
        drawBackdropAsset(context, loadAsset('environment-fibers'), width, height, camera, zoom, 0.11, 0.34)
      }
      drawEnvironmentField(context, snapshot, camera, width, height, zoom)
      drawWorldBoundary(context, snapshot, camera, width, height, zoom, visualTime)
      drawEventField(context, snapshot, camera, width, height, zoom)
      if (snapshot.activeEvent && snapshot.activeEvent.phase !== 'expired') {
        const eventX = width / 2 + (snapshot.activeEvent.center.x - camera.x) * zoom
        const eventY = height / 2 + (snapshot.activeEvent.center.y - camera.y) * zoom
        drawAssetLayer(context, loadAsset(snapshot.activeEvent.id), eventX, eventY, 42, 0.72)
      }

      const drawables = snapshot.entities
        .map((entity) => toDrawable(entity, camera, width, height, zoom, displayedRadii))
        .filter((item) => item.x + item.radius * 2 > 0 && item.x - item.radius * 2 < width && item.y + item.radius * 2 > 0 && item.y - item.radius * 2 < height)
        .sort((left, right) => Number(left.entity.id === snapshot.playerId) - Number(right.entity.id === snapshot.playerId))

      for (const item of drawables) {
        if (item.entity.id === snapshot.boss?.id && snapshot.boss.phase === 'dormant') {
          drawBossArrivalTelegraph(context, item.x, item.y, item.radius, snapshot.elapsedMs)
        } else {
          drawDangerTelegraph(context, item.entity, item.x, item.y, item.radius, snapshot.elapsedMs, options.reducedFlash)
        }
      }
      drawAmbientParticles(context, particles, width, height, visualTime, options.lowParticles ? 'low' : quality, camera)
      drawRouteRifts(context, snapshot, camera, width, height, zoom)
      for (const item of drawables) drawMotionWake(context, item.entity, item.x, item.y, item.radius, quality)
      for (const item of drawables) {
        if (item.entity.id.startsWith('eco-food-')) drawFoodSpawnBloom(context, item.x, item.y, item.radius, item.entity, snapshot.elapsedMs, options.reducedMotion ?? false)
        drawCell(context, item.entity, item.x, item.y, item.radius, visualTime, {
          quality,
          organelleIds: item.entity.faction === 'player' ? snapshot.playerOrganelleIdsByEntity[item.entity.id] ?? [] : undefined,
          stability: item.entity.faction === 'player' ? snapshot.playerStability : undefined,
          synergyIds: item.entity.faction === 'player' ? snapshot.playerSynergyIds : undefined,
          damageSource: item.entity.faction === 'player' ? snapshot.playerDamage?.source : undefined,
        })
        if (item.entity.id === snapshot.boss?.id && snapshot.boss.phase !== 'dormant') {
          drawAssetLayer(context, loadAsset(`${snapshot.boss.id}:body`), item.x, item.y, item.radius * 2.45, 0.48)
          drawAssetLayer(context, loadAsset(`${snapshot.boss.id}:mask`), item.x, item.y, item.radius * 2.8, 0.72)
          drawBossPhase(context, item.x, item.y, item.radius, snapshot.boss, snapshot.elapsedMs)
        }
      }
      if (snapshot.swarmTransition && player) {
        drawSwarmTransition(context, currentPlayerScreenPosition, player.body.radius * zoom, snapshot.swarmTransition, snapshot.elapsedMs, options.reducedMotion ?? false)
      }
      drawVisibilityVeil(context, snapshot.environmentField.visibility, width, height)
      numbers.draw(context, width, height, snapshot.elapsedMs)
    },
    playerScreenPosition() {
      return { ...currentPlayerScreenPosition }
    },
    setQuality(nextQuality) {
      quality = nextQuality
    },
    destroy() {
      destroyed = true
      displayedRadii.clear()
      assetImages.clear()
    },
  }

  function loadAsset(id: string): HTMLImageElement | undefined {
    const path = assetPath(id)
    if (!path || typeof Image === 'undefined') return undefined
    const existing = assetImages.get(path)
    if (existing) return existing
    const loaded = new Image()
    loaded.decoding = 'async'
    loaded.src = path
    assetImages.set(path, loaded)
    return loaded
  }
}

function drawSwarmTransition(
  context: CanvasRenderingContext2D,
  position: { x: number; y: number },
  radius: number,
  transition: NonNullable<WorldRenderSnapshot['swarmTransition']>,
  elapsedMs: number,
  reducedMotion: boolean,
) {
  const presentation = swarmTransitionPresentation(elapsedMs - transition.startedAtMs, reducedMotion)
  if (!presentation) return
  context.save()
  context.globalAlpha = presentation.alpha
  context.globalCompositeOperation = 'screen'
  context.strokeStyle = transition.kind === 'split' ? '#72f5ff' : '#b899ff'
  context.lineWidth = 2.5
  context.shadowColor = context.strokeStyle
  context.shadowBlur = 14
  context.beginPath()
  context.arc(position.x, position.y, radius * presentation.radiusScale, 0, Math.PI * 2)
  context.stroke()
  context.fillStyle = '#eaffff'
  context.font = '800 16px Inter, sans-serif'
  context.textAlign = 'center'
  const template = transition.kind === 'split' ? rawContent.ui.hud.splitPulse : rawContent.ui.hud.fusionPulse
  context.fillText(template.replace('{count}', String(transition.bodyCount)), position.x, position.y - radius - 20 - presentation.textOffset)
  context.restore()
}

function drawFoodSpawnBloom(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  entity: EntityState,
  elapsedMs: number,
  reducedMotion: boolean,
) {
  const spawnedAtMs = 'spawnedAtMs' in entity ? Number(entity.spawnedAtMs) : Number.NEGATIVE_INFINITY
  const presentation = foodBloomPresentation(elapsedMs - spawnedAtMs, reducedMotion)
  if (!presentation) return
  context.save()
  context.globalCompositeOperation = 'screen'
  context.globalAlpha = presentation.alpha
  context.strokeStyle = '#91fff1'
  context.lineWidth = 1.5
  context.beginPath()
  context.arc(x, y, radius * presentation.radiusScale, 0, Math.PI * 2)
  context.stroke()
  context.restore()
}

function drawWorldBoundary(
  context: CanvasRenderingContext2D,
  snapshot: Pick<WorldRenderSnapshot, 'width' | 'height'>,
  camera: { x: number; y: number },
  width: number,
  height: number,
  zoom: number,
  elapsedMs: number,
) {
  const boundary = worldBoundaryScreenRect(camera, snapshot, { width, height }, zoom)
  const edgeVisible = boundary.x >= -24 || boundary.y >= -24
    || boundary.x + boundary.width <= width + 24
    || boundary.y + boundary.height <= height + 24
  if (!edgeVisible) return

  context.save()
  context.beginPath()
  context.rect(-2, -2, width + 4, height + 4)
  context.rect(boundary.x, boundary.y, boundary.width, boundary.height)
  context.fillStyle = 'rgb(0 3 14 / 42%)'
  context.fill('evenodd')
  context.globalCompositeOperation = 'screen'
  context.globalAlpha = 0.5 + Math.sin(elapsedMs / 680) * 0.08
  context.strokeStyle = '#67efff'
  context.lineWidth = 3
  context.shadowColor = '#65f6ff'
  context.shadowBlur = 16
  context.strokeRect(boundary.x, boundary.y, boundary.width, boundary.height)
  context.restore()
}

function usesFiberBackdrop(environmentId: string): boolean {
  return environmentId === 'env-fiber-maze'
    || environmentId === 'env-antibody-storm'
    || environmentId === 'env-abandoned-chamber'
}

function drawBackdropAsset(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  width: number,
  height: number,
  camera: { x: number; y: number },
  zoom: number,
  opacity: number,
  parallax: number,
) {
  if (!image?.complete || image.naturalWidth === 0) return
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight) * 1.08
  const tile = { width: image.naturalWidth * scale, height: image.naturalHeight * scale }
  const rawOffset = worldTextureOffset({ x: camera.x * zoom, y: camera.y * zoom }, tile, parallax)
  const offset = {
    x: ((rawOffset.x % tile.width) + tile.width) % tile.width,
    y: ((rawOffset.y % tile.height) + tile.height) % tile.height,
  }
  context.save()
  context.globalAlpha = opacity
  for (let x = offset.x - tile.width; x < width + tile.width; x += tile.width) {
    for (let y = offset.y - tile.height; y < height + tile.height; y += tile.height) {
      context.drawImage(image, x, y, tile.width, tile.height)
    }
  }
  context.restore()
}

function drawMotionWake(
  context: CanvasRenderingContext2D,
  entity: EntityState,
  x: number,
  y: number,
  radius: number,
  quality: RenderQuality,
) {
  const speed = Math.hypot(entity.velocity.x, entity.velocity.y)
  if (speed < 8 || entity.role === 'nutrient' || entity.role === 'fragment') return
  const direction = { x: entity.velocity.x / speed, y: entity.velocity.y / speed }
  const length = Math.min(radius * 3.6, speed * 0.72)
  const palette = cellVisualProfile(entity).palette
  const trails = quality === 'high' ? 4 : quality === 'balanced' ? 3 : 1
  context.save()
  context.lineCap = 'round'
  context.globalCompositeOperation = 'screen'
  for (let index = 0; index < trails; index += 1) {
    const side = (index - (trails - 1) / 2) * radius * 0.28
    const perpendicular = { x: -direction.y * side, y: direction.x * side }
    const start = { x: x + perpendicular.x - direction.x * radius * 0.72, y: y + perpendicular.y - direction.y * radius * 0.72 }
    const end = { x: start.x - direction.x * length, y: start.y - direction.y * length }
    const gradient = context.createLinearGradient(start.x, start.y, end.x, end.y)
    gradient.addColorStop(0, hexWithAlpha(palette.glow, 0.5))
    gradient.addColorStop(1, hexWithAlpha(palette.glow, 0))
    context.strokeStyle = gradient
    context.lineWidth = Math.max(1, radius * (0.08 - index * 0.008))
    context.beginPath()
    context.moveTo(start.x, start.y)
    context.quadraticCurveTo(
      (start.x + end.x) / 2 - direction.y * Math.sin(index + speed) * radius * 0.18,
      (start.y + end.y) / 2 + direction.x * Math.sin(index + speed) * radius * 0.18,
      end.x,
      end.y,
    )
    context.stroke()
  }
  context.restore()
}

function hexWithAlpha(color: string, alpha: number): string {
  if (!/^#[\da-f]{6}$/i.test(color)) return color
  return `rgb(${Number.parseInt(color.slice(1, 3), 16)} ${Number.parseInt(color.slice(3, 5), 16)} ${Number.parseInt(color.slice(5, 7), 16)} / ${alpha})`
}

function drawAssetLayer(context: CanvasRenderingContext2D, image: HTMLImageElement | undefined, x: number, y: number, size: number, opacity: number) {
  if (!image?.complete || image.naturalWidth === 0) return
  context.save()
  context.globalAlpha = opacity
  context.drawImage(image, x - size / 2, y - size / 2, size, size)
  context.restore()
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
    context.arc(safeX, safeY, field.safeRadius * zoom, 0, Math.PI * 2, true)
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
    context.arc(x, y, field.safeRadius * zoom, 0, Math.PI * 2)
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
