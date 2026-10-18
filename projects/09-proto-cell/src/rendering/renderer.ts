import { createRng } from '../domain/rng'
import type { EntityState, Vec2 } from '../domain/types'
import type { WorldRenderSnapshot } from '../game/engine'
import { cellBodyPoint, cellVisualProfile, drawCell } from './cell'
import type { FormId } from '../content'
import { metamorphosisPresentation } from './metamorphosis'
import { collapsePresentation, drawAmbientParticles, drawDangerTelegraph, drawLiquidField, type AmbientParticle, type RenderQuality } from './effects'
import type { NumberEffect, NumberFeed } from './numbers'
import { assetPath } from '../content/assets'
import rawContent from '../content/content.json'
import { createCameraTracker, targetScreenDiameterRatio, type CameraFrame } from './camera'
import { createRelationshipFrame, relationshipPulse, type RelationshipCue } from './feedback'
import { isMaterializing } from '../game/materialization'
import { membraneContour, membranePose, membraneSilhouette } from '../domain/membrane'
import { behaviorCuePresentation, drawAssimilation } from './assimilation'
import { fiberStrandPoints } from './fibers'
import { fiberSections } from '../world/environments'
import { engulfRecoilScale } from './combat-feel'
import { membranePath } from './body-path'

export type CanvasRenderer = {
  render(snapshot: WorldRenderSnapshot, numbers: NumberFeed): void
  playerScreenPosition(): { x: number; y: number }
  setQuality(quality: RenderQuality): void
  destroy(): void
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

export function backdropTileOrigins(
  viewport: { width: number; height: number },
  tile: { width: number; height: number },
  offset: { x: number; y: number },
): Array<{ x: number; y: number }> {
  const origins: Array<{ x: number; y: number }> = []
  for (let x = offset.x - tile.width; x < viewport.width; x += tile.width) {
    if (x + tile.width <= 0) continue
    for (let y = offset.y - tile.height; y < viewport.height; y += tile.height) {
      if (y + tile.height <= 0) continue
      origins.push({ x, y })
    }
  }
  return origins
}

export function worldBoundaryScreenRect(
  camera: CameraFrame,
  world: { width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  return {
    x: camera.anchor.x - camera.center.x * camera.zoom,
    y: camera.anchor.y - camera.center.y * camera.zoom,
    width: world.width * camera.zoom,
    height: world.height * camera.zoom,
  }
}

export function swarmTransitionPresentation(ageMs: number, reducedMotion: boolean): { radiusScale: number; textOffset: number; alpha: number } | undefined {
  if (ageMs < 0 || ageMs > 900) return undefined
  if (reducedMotion) return { radiusScale: 1.2, textOffset: 0, alpha: 0.72 }
  const progress = ageMs / 900
  return { radiusScale: 1.15 + progress * 1.8, textOffset: progress * 12, alpha: 1 - progress }
}

export function reversalPresentation(ageMs: number, reducedMotion: boolean, reducedFlash: boolean): { radiusScale: number; textOffset: number; alpha: number } | undefined {
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs >= 900) return undefined
  const progress = ageMs / 900
  return {
    radiusScale: reducedMotion ? 1.15 : 1.08 + progress * 0.65,
    textOffset: reducedMotion ? 0 : progress * 9,
    alpha: (reducedFlash ? 0.55 : 0.85) * Math.min(1, (1 - progress) * 2),
  }
}

export function materializationPresentation(
  ageMs: number,
  durationMs: number,
  reducedMotion: boolean,
): { radiusScale: number; alpha: number; ringAlpha: number } | undefined {
  if (!Number.isFinite(ageMs) || !Number.isFinite(durationMs)) return undefined
  if (ageMs < 0 || durationMs <= 0 || ageMs >= durationMs) return undefined
  if (reducedMotion) return { radiusScale: 0.88, alpha: 0.72, ringAlpha: 0.5 }
  const progress = ageMs / durationMs
  return {
    radiusScale: 0.72 + progress * 0.28,
    alpha: 0.24 + progress * 0.76,
    ringAlpha: 0.72 - progress * 0.22,
  }
}

export function edgeWarningPosition(
  point: Vec2,
  viewport: { width: number; height: number },
  margin: number,
): (Vec2 & { angle: number }) | undefined {
  if (point.x >= margin && point.x <= viewport.width - margin && point.y >= margin && point.y <= viewport.height - margin) return undefined
  const center = { x: viewport.width / 2, y: viewport.height / 2 }
  const direction = { x: point.x - center.x, y: point.y - center.y }
  if (direction.x === 0 && direction.y === 0) return undefined
  const xScale = direction.x > 0
    ? (viewport.width - margin - center.x) / direction.x
    : direction.x < 0 ? (margin - center.x) / direction.x : Number.POSITIVE_INFINITY
  const yScale = direction.y > 0
    ? (viewport.height - margin - center.y) / direction.y
    : direction.y < 0 ? (margin - center.y) / direction.y : Number.POSITIVE_INFINITY
  const scale = Math.min(xScale, yScale)
  return {
    x: center.x + direction.x * scale,
    y: center.y + direction.y * scale,
    angle: Math.atan2(direction.y, direction.x),
  }
}

export function isFiniteEntityGeometry(
  entity: Pick<EntityState, 'position' | 'velocity'> & { body: { radius: number } },
): boolean {
  return Number.isFinite(entity.position.x)
    && Number.isFinite(entity.position.y)
    && Number.isFinite(entity.velocity.x)
    && Number.isFinite(entity.velocity.y)
    && Number.isFinite(entity.body.radius)
    && entity.body.radius > 0
}

export function useSimpleCell(entity: Pick<EntityState, 'id' | 'faction' | 'role'>, screenRadius: number, visibleCount: number, proximityRank: number): boolean {
  if (entity.faction === 'player' || entity.role === 'boss' || entity.id.startsWith('encounter-') || entity.id.startsWith('carryover-')) return false
  return screenRadius < 9 || visibleCount > 40 && proximityRank >= 18
}

function drawLateWater(context: CanvasRenderingContext2D, snapshot: WorldRenderSnapshot, camera: CameraFrame, width: number, height: number, visualTime: number) {
  const colony = snapshot.environmentId === 'env-fiber-maze'
  const chamber = snapshot.environmentId === 'env-abandoned-chamber'
  if (!colony && !chamber) return
  context.save()
  const water = context.createLinearGradient(0, 0, width, height)
  water.addColorStop(0, colony ? 'rgb(4 66 50 / 38%)' : 'rgb(44 12 70 / 42%)')
  water.addColorStop(0.6, 'rgb(4 17 36 / 0%)')
  water.addColorStop(1, colony ? 'rgb(97 90 24 / 18%)' : 'rgb(5 51 73 / 34%)')
  context.fillStyle = water
  context.fillRect(0, 0, width, height)
  context.strokeStyle = colony ? '#9bd99e' : '#d4b1ff'
  context.lineWidth = 1
  context.globalAlpha = 0.12
  const spacing = colony ? 310 : 680
  for (let index = 0; index < 12; index += 1) {
    const wx = (index * 971 + 230) % snapshot.width
    const wy = (index * spacing + visualTime * (colony ? 0.004 : 0.04)) % snapshot.height
    const x = camera.anchor.x + (wx - camera.center.x) * camera.zoom
    const y = camera.anchor.y + (wy - camera.center.y) * camera.zoom
    if (x < -100 || x > width + 100 || y < -100 || y > height + 100) continue
    context.beginPath()
    if (colony) context.ellipse(x, y, 33 * camera.zoom, 85 * camera.zoom, -0.6, 0, Math.PI * 2)
    else {
      context.moveTo(x - 16, y - 80)
      context.bezierCurveTo(x + 40, y - 35, x - 40, y + 35, x + 16, y + 100)
    }
    context.stroke()
  }
  context.restore()
}

function drawDomainClaim(context: CanvasRenderingContext2D, center: Vec2, radius: number, width: number, height: number, ageMs: number, reducedMotion: boolean, reducedFlash: boolean) {
  const progress = Math.min(1, Math.max(0, ageMs / rawContent.lateEcology.leviathan.finaleMs))
  const reach = reducedMotion ? Math.hypot(width, height) * 0.6 : radius + Math.hypot(width, height) * 0.8 * (1 - (1 - progress) ** 3)
  context.save()
  context.globalAlpha = (reducedFlash ? 0.12 : 0.32) * (1 - progress * 0.7)
  const glow = context.createRadialGradient(center.x, center.y, radius * 0.4, center.x, center.y, Math.max(radius, reach))
  glow.addColorStop(0, '#ffe6a1')
  glow.addColorStop(0.32, '#7beac6')
  glow.addColorStop(1, 'rgb(26 120 110 / 0%)')
  context.fillStyle = glow
  context.fillRect(0, 0, width, height)
  context.strokeStyle = '#c4ffe2'
  context.lineWidth = 3 * (1 - progress) + 1
  context.beginPath()
  context.arc(center.x, center.y, reach, 0, Math.PI * 2)
  context.stroke()
  context.restore()
}

export function createCanvasRenderer(
  canvas: HTMLCanvasElement,
  options: { quality?: RenderQuality; visualSeed?: number; reducedMotion?: boolean; reducedShake?: boolean; reducedFlash?: boolean; lowParticles?: boolean } = {},
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
  const assetImages = new Map<string, HTMLImageElement>()
  const cameraTracker = createCameraTracker()
  let currentPlayerScreenPosition = { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 }
  let quality = options.quality ?? 'balanced'
  let destroyed = false
  let lastFormId: FormId | undefined
  let formBloom: { from: FormId; to: FormId; atMs: number } | undefined
  let lastReversalCount: number | undefined
  let reversalAtMs = Number.NEGATIVE_INFINITY

  return {
    render(snapshot, numbers) {
      if (destroyed) return
      const { width, height } = resizeCanvas(canvas, context, quality)
      const renderableEntities = snapshot.entities.filter(isFiniteEntityGeometry)
      const player = renderableEntities.find((entity) => entity.id === snapshot.playerId)
      const reversalCount = snapshot.ecosystem?.reversalCount ?? 0
      if (lastReversalCount !== undefined && reversalCount > lastReversalCount) reversalAtMs = snapshot.elapsedMs
      lastReversalCount = reversalCount
      const geometryRelationship = player ? createRelationshipFrame(player, { formId: snapshot.lifecycle.formId, build: snapshot.playerBuild, elapsedMs: snapshot.elapsedMs }) : undefined
      const relationship = (target: EntityState): RelationshipCue => target.id === 'encounter-2' && snapshot.ecosystem?.leviathanPhase === 'armored' ? 'danger' : geometryRelationship?.(target) ?? 'neutral'
      if (lastFormId && lastFormId !== snapshot.lifecycle.formId) {
        formBloom = { from: lastFormId, to: snapshot.lifecycle.formId, atMs: snapshot.elapsedMs }
      }
      lastFormId = snapshot.lifecycle.formId
      const transformation = formBloom ? metamorphosisPresentation(snapshot.elapsedMs - formBloom.atMs, formBloom.from, formBloom.to, options.reducedMotion ?? false) : undefined
      const viewport = { width, height }
      const tier = rawContent.scaleTiers[snapshot.lifecycle.tierIndex]
      const cameraFrame = player
        ? cameraTracker.update(
          { ...player, radius: player.body.radius },
          viewport,
          tier ? { screenDiameterRatio: targetScreenDiameterRatio(tier.screenDiameterRange as unknown as readonly [number, number], snapshot.lifecycle.evolutionPressure) } : snapshot.bodyStage,
          snapshot.elapsedMs,
        )
        : { center: { x: snapshot.width / 2, y: snapshot.height / 2 }, zoom: 2.3, anchor: { x: width * 0.5, y: height * 0.58 } }
      const camera = cameraFrame.center
      const zoom = cameraFrame.zoom
      currentPlayerScreenPosition = player ? {
        x: cameraFrame.anchor.x + (player.position.x - camera.x) * zoom,
        y: cameraFrame.anchor.y + (player.position.y - camera.y) * zoom,
      } : { ...cameraFrame.anchor }

      context.clearRect(0, 0, width, height)
      const impact = screenImpactOffset(numbers.visible(), snapshot.elapsedMs, !!(options.reducedMotion || options.reducedShake))
      context.save()
      context.translate(impact.x, impact.y)
      const visualTime = options.reducedMotion ? 0 : snapshot.elapsedMs
      drawLiquidField(context, width, height, visualTime, camera)
      drawBackdropAsset(context, loadAsset(`${snapshot.environmentId}:arcade`), width, height, camera, zoom, 0.16, 0.07)
      drawBackdropAsset(context, loadAsset('environment-caustics'), width, height, camera, zoom, 0.12, 0.12)
      drawBackdropAsset(context, loadAsset(snapshot.environmentId), width, height, camera, zoom, 0.12, 0.2)
      if (quality !== 'low' && usesFiberBackdrop(snapshot.environmentId)) {
        drawBackdropAsset(context, loadAsset('environment-fibers'), width, height, camera, zoom, 0.055, 0.34)
      }
      drawLateWater(context, snapshot, cameraFrame, width, height, visualTime)
      drawEnvironmentField(context, snapshot, cameraFrame, width, height, options.reducedMotion ?? false, options.reducedFlash ?? false)
      drawWorldBoundary(context, snapshot, cameraFrame, width, height, visualTime)
      drawEventField(context, snapshot, cameraFrame)
      if (snapshot.activeEvent && snapshot.activeEvent.phase !== 'expired') {
        const eventX = cameraFrame.anchor.x + (snapshot.activeEvent.center.x - camera.x) * zoom
        const eventY = cameraFrame.anchor.y + (snapshot.activeEvent.center.y - camera.y) * zoom
        drawAssetLayer(context, loadAsset(snapshot.activeEvent.id), eventX, eventY, 42, 0.72)
      }

      const drawables = renderableEntities
        .map((entity) => toDrawable(entity, cameraFrame))
        .filter((item) => (!player || item.entity.faction === 'player' || Math.hypot(item.entity.position.x - player.position.x, item.entity.position.y - player.position.y) <= (snapshot.territory?.sightRadius ?? Number.POSITIVE_INFINITY) + item.entity.body.radius)
          && item.x + item.radius * 2 > 0 && item.x - item.radius * 2 < width && item.y + item.radius * 2 > 0 && item.y - item.radius * 2 < height)
        .sort((left, right) => Number(left.entity.id === snapshot.playerId) - Number(right.entity.id === snapshot.playerId))

      const detailRanks = new Map([...drawables].filter((item) => item.entity.faction !== 'player').sort((a, b) => Math.hypot(a.x - currentPlayerScreenPosition.x, a.y - currentPlayerScreenPosition.y) - Math.hypot(b.x - currentPlayerScreenPosition.x, b.y - currentPlayerScreenPosition.y)).map((item, index) => [item.entity.id, index]))
      const simplified = (item: typeof drawables[number]) => useSimpleCell(item.entity, item.radius, drawables.length, detailRanks.get(item.entity.id) ?? 0)
      for (const entity of renderableEntities) {
        if (entity.faction !== 'hostile' || !isMaterializing(entity, snapshot.elapsedMs)) continue
        const point = {
          x: cameraFrame.anchor.x + (entity.position.x - camera.x) * zoom,
          y: cameraFrame.anchor.y + (entity.position.y - camera.y) * zoom,
        }
        const warning = edgeWarningPosition(point, viewport, 28)
        if (warning) drawArrivalEdgeWarning(context, warning, snapshot.elapsedMs, options.reducedMotion ?? false)
      }

      for (const item of drawables) {
        if (relationship?.(item.entity) === 'edible') continue
        if (item.entity.id === snapshot.boss?.id && snapshot.boss.phase === 'dormant') {
          drawBossArrivalTelegraph(context, item.x, item.y, item.radius, snapshot.elapsedMs)
        } else {
          drawDangerTelegraph(context, item.entity, item.x, item.y, item.radius, snapshot.elapsedMs, options.reducedFlash || options.reducedMotion)
        }
      }
      drawAmbientParticles(context, particles, width, height, visualTime, options.lowParticles ? 'low' : quality, camera)
      drawRouteRifts(context, snapshot, cameraFrame)
      for (const item of drawables) {
        if (!simplified(item) && !isMaterializing(item.entity, snapshot.elapsedMs)) drawMotionWake(context, item.entity, item.x, item.y, item.radius, quality)
      }
      if (player) {
        for (const item of drawables) {
          if (item.entity.id === player.id) continue
          drawRelationshipCue(
            context,
            relationship?.(item.entity) ?? 'neutral',
            item.x,
            item.y,
            item.radius,
            snapshot.elapsedMs,
            options.reducedFlash ?? false,
            item.entity,
            simplified(item),
          )
        }
      }
      for (const item of drawables) {
        const spawnedAtMs = item.entity.spawnedAtMs
        const materializingUntilMs = item.entity.materializingUntilMs
        const materialization = spawnedAtMs !== undefined && materializingUntilMs !== undefined
          ? materializationPresentation(
              snapshot.elapsedMs - spawnedAtMs,
              materializingUntilMs - spawnedAtMs,
              options.reducedMotion ?? false,
            )
          : undefined
        if (materialization) drawMaterializationBloom(context, item.x, item.y, item.radius, item.entity, materialization)
        if (!materialization) drawBehaviorStateCue(context, item.entity, item.x, item.y, item.radius)
        context.save()
        if (item.entity.behaviorState === 'hide') context.globalAlpha = 0.38
        if (materialization) context.globalAlpha *= materialization.alpha
        drawCell(context, item.entity, item.x, item.y, item.radius * (materialization?.radiusScale ?? 1) * (item.entity.faction === 'player' ? (transformation?.scale ?? 1) * engulfRecoilScale(snapshot.elapsedMs - reversalAtMs, options.reducedMotion ?? false) : 1), visualTime, {
          quality,
          simplified: simplified(item),
          build: item.entity.faction === 'player' ? snapshot.playerBuild : undefined,
          formId: item.entity.faction === 'player' ? snapshot.lifecycle.formId : undefined,
          organelleIds: item.entity.faction === 'player' ? snapshot.playerOrganelleIdsByEntity[item.entity.id] ?? [] : undefined,
          stability: item.entity.faction === 'player' ? snapshot.playerStability : undefined,
          synergyIds: item.entity.faction === 'player' ? snapshot.playerSynergyIds : undefined,
          damageSource: item.entity.faction === 'player' ? snapshot.playerDamage?.source : undefined,
          edible: relationship?.(item.entity) === 'edible',
          membraneElapsedMs: snapshot.elapsedMs,
          reducedFlash: options.reducedFlash,
        })
        context.restore()
        if (item.entity.id === snapshot.boss?.id && snapshot.boss.phase !== 'dormant') {
          drawAssetLayer(context, loadAsset(`${snapshot.boss.id}:body`), item.x, item.y, item.radius * 2.45, 0.48)
          drawAssetLayer(context, loadAsset(`${snapshot.boss.id}:mask`), item.x, item.y, item.radius * 2.8, 0.72)
          drawBossPhase(context, item.x, item.y, item.radius, snapshot.boss, snapshot.elapsedMs)
        }
      }
      for (const event of snapshot.recentEngulfs ?? []) {
        const predator = drawables.find((item) => item.entity.id === event.predatorId)
        if (!predator) continue
        drawAssimilation(context, predator.entity, event.prey,
          { x: predator.x, y: predator.y, radius: predator.radius, zoom },
          snapshot.lifecycle.formId, snapshot.elapsedMs - event.atMs, snapshot.elapsedMs,
          { quality, reducedMotion: options.reducedMotion, reducedFlash: options.reducedFlash, durationMs: event.finisher ? rawContent.lateEcology.leviathan.finaleMs : undefined })
      }
      if (snapshot.swarmTransition && player) {
        drawSwarmTransition(context, currentPlayerScreenPosition, player.body.radius * zoom, snapshot.swarmTransition, snapshot.elapsedMs, options.reducedMotion ?? false)
      }
      if (player) {
        if (transformation) drawFormBloom(context, currentPlayerScreenPosition, player.body.radius * zoom, transformation.bloom, transformation.alpha, options.reducedMotion ?? false, options.reducedFlash ?? false)
        drawEngulfBursts(context, currentPlayerScreenPosition, player.body.radius * zoom, numbers.visible(), snapshot.elapsedMs, options.reducedMotion ?? false, options.reducedFlash ?? false, quality)
        const reversal = reversalPresentation(snapshot.elapsedMs - reversalAtMs, options.reducedMotion ?? false, options.reducedFlash ?? false)
        if (reversal) drawReversal(context, snapshot, player, currentPlayerScreenPosition, player.body.radius * zoom, viewport, reversal)
      }
      drawEcologicalObjective(context, snapshot, cameraFrame, viewport, visualTime)
      drawVisibilityVeil(context, snapshot.environmentField.visibility, width, height, cameraFrame.anchor, snapshot.territory ? snapshot.territory.sightRadius * zoom : undefined)
      drawEcologyCollapse(context, snapshot, width, height, cameraFrame.anchor, options.reducedMotion ?? false)
      if (snapshot.finaleStartedAtMs !== undefined && player) drawDomainClaim(context, currentPlayerScreenPosition, player.body.radius * zoom, width, height, snapshot.elapsedMs - snapshot.finaleStartedAtMs, options.reducedMotion ?? false, options.reducedFlash ?? false)
      context.restore()
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

function drawBehaviorStateCue(
  context: CanvasRenderingContext2D,
  entity: EntityState,
  x: number,
  y: number,
  radius: number,
) {
  if (!entity.behaviorState || entity.faction === 'player') return
  context.save()
  context.translate(x, y)
  const behaviorCue = behaviorCuePresentation(entity)
  if (behaviorCue && behaviorCue.phase !== 'recover') context.rotate(behaviorCue.heading)
  if (entity.behaviorState === 'steal' || entity.behaviorState === 'harvest') {
    context.globalAlpha = 0.72
    context.strokeStyle = '#ffdc85'
    context.lineWidth = 2
    context.beginPath()
    context.arc(0, 0, radius * 1.28, -Math.PI * 0.15, Math.PI * 0.55)
    context.stroke()
  } else if (entity.behaviorState === 'regroup') {
    context.globalAlpha = 0.48
    context.strokeStyle = '#8ff8ff'
    context.lineWidth = 1.5
    context.setLineDash([3, 5])
    context.beginPath()
    context.arc(0, 0, radius * 1.22, 0, Math.PI * 2)
    context.stroke()
  } else if (behaviorCue?.phase === 'prepare') {
    context.globalAlpha = 0.9
    context.strokeStyle = '#ffc18b'
    context.lineWidth = Math.max(2, radius * 0.075)
    context.setLineDash([5, 5])
    context.beginPath()
    context.moveTo(radius * 0.85, -radius * 0.42)
    context.lineTo(radius * 2.3, 0)
    context.lineTo(radius * 0.85, radius * 0.42)
    context.stroke()
  } else if (behaviorCue?.phase === 'strike') {
    context.globalAlpha = 0.82
    context.fillStyle = '#fff1a4'
    context.beginPath()
    context.moveTo(radius * 1.8, 0)
    context.lineTo(radius * 1.08, -radius * 0.2)
    context.lineTo(radius * 1.08, radius * 0.2)
    context.closePath()
    context.fill()
  } else if (entity.behaviorState === 'recover') {
    context.globalAlpha = 0.64
    context.strokeStyle = '#8ff8ff'
    context.lineWidth = 1.5
    for (let index = 0; index < 3; index += 1) {
      context.beginPath()
      context.arc(-radius * (0.7 + index * 0.28), -radius * (0.45 + index * 0.18), radius * (0.11 + index * 0.03), 0, Math.PI * 2)
      context.stroke()
    }
  } else if (entity.behaviorState === 'alert') {
    context.globalAlpha = 0.84
    context.strokeStyle = '#ff9f68'
    context.fillStyle = '#fff3cb'
    context.lineWidth = 2.2
    context.beginPath()
    context.arc(0, 0, radius * 1.38, 0, Math.PI * 2)
    context.stroke()
    context.font = `800 ${Math.max(12, radius * 0.62)}px Inter, sans-serif`
    context.textAlign = 'center'
    context.fillText('!', 0, -radius * 1.5)
  }
  context.restore()
}

function drawEcologyCollapse(
  context: CanvasRenderingContext2D,
  snapshot: WorldRenderSnapshot,
  width: number,
  height: number,
  anchor: Vec2,
  reducedMotion: boolean,
) {
  const presentation = collapsePresentation(snapshot.collapsePhase, snapshot.collapseProgress, reducedMotion)
  if (presentation.edgeOpacity <= 0) return

  const outerRadius = Math.hypot(width, height) * 0.64
  const safeRadius = Math.min(width, height) * (0.52 - presentation.safeInsetRatio)
  const fog = context.createRadialGradient(anchor.x, anchor.y, safeRadius, anchor.x, anchor.y, outerRadius)
  fog.addColorStop(0, 'rgb(8 18 36 / 0%)')
  fog.addColorStop(0.68, `rgb(30 16 43 / ${presentation.edgeOpacity * 0.48})`)
  fog.addColorStop(1, `rgb(7 2 18 / ${presentation.edgeOpacity})`)
  context.save()
  context.fillStyle = fog
  context.fillRect(0, 0, width, height)

  const direction = snapshot.migrationDirection
  if (direction && presentation.cueOpacity > 0) {
    const cueX = anchor.x + direction.x * Math.min(width, height) * 0.22
    const cueY = anchor.y + direction.y * Math.min(width, height) * 0.22
    const angle = Math.atan2(direction.y, direction.x)
    context.translate(cueX, cueY)
    context.rotate(angle)
    context.globalAlpha = presentation.cueOpacity
    context.strokeStyle = '#a8fff1'
    context.lineWidth = 3
    context.lineCap = 'round'
    context.shadowColor = '#67efff'
    context.shadowBlur = 10
    for (let index = 0; index < 2; index += 1) {
      const offset = index * 11
      context.beginPath()
      context.moveTo(-10 - offset, -8)
      context.lineTo(-1 - offset, 0)
      context.lineTo(-10 - offset, 8)
      context.stroke()
    }
  }
  context.restore()
}

function drawRelationshipCue(
  context: CanvasRenderingContext2D,
  cue: RelationshipCue,
  x: number,
  y: number,
  radius: number,
  elapsedMs: number,
  reducedFlash: boolean,
  entity: EntityState,
  simplified = false,
) {
  if (cue === 'neutral') return
  const pulse = relationshipPulse(elapsedMs, reducedFlash)
  const haloRadius = radius * (cue === 'edible' ? 1.22 : 1.3) * pulse
  context.save()
  context.translate(x, y)
  const speed = Math.hypot(entity.velocity.x, entity.velocity.y)
  if (speed > 0.5) context.rotate(Math.atan2(entity.velocity.y, entity.velocity.x))
  context.globalAlpha = cue === 'edible' ? 0.6 : 0.84
  context.strokeStyle = cue === 'edible' ? '#b5ffe2' : '#ff806f'
  context.shadowColor = context.strokeStyle
  context.shadowBlur = 0
  context.lineWidth = Math.max(1.5, radius * 0.045)
  const pattern = cue === 'edible' ? [radius * 0.3, radius * 0.52] : [radius * 0.22, radius * 0.14]
  context.setLineDash(pattern)
  const silhouette = cellVisualProfile(entity).silhouette
  const samples = simplified ? 16 : 48
  const retained = membranePath(silhouette, elapsedMs, entity.id, samples)
  if (retained) {
    context.save()
    context.scale(haloRadius, haloRadius)
    context.lineWidth /= haloRadius
    context.setLineDash(pattern.map((length) => length / haloRadius))
    context.stroke(retained)
    context.restore()
  } else {
    context.beginPath()
    for (let index = 0; index <= samples; index += 1) {
      const point = cellBodyPoint(silhouette, index / samples * Math.PI * 2, elapsedMs, entity.id)
      if (index === 0) context.moveTo(point.x * haloRadius, point.y * haloRadius)
      else context.lineTo(point.x * haloRadius, point.y * haloRadius)
    }
    context.stroke()
  }
  if (cue === 'danger') {
    context.setLineDash([])
    context.lineWidth = Math.max(2, radius * 0.06)
    for (let index = 0; index < 8; index += 1) {
      const angle = index / 8 * Math.PI * 2
      context.beginPath()
      context.moveTo(Math.cos(angle) * haloRadius * 1.08, Math.sin(angle) * haloRadius * 1.08)
      context.lineTo(Math.cos(angle) * haloRadius * 1.25, Math.sin(angle) * haloRadius * 1.25)
      context.stroke()
    }
  }
  context.restore()
}

export function objectiveScreenCue(point: Vec2, viewport: { width: number; height: number }): (Vec2 & { angle: number; edge: boolean }) | undefined {
  if (![point.x, point.y, viewport.width, viewport.height].every(Number.isFinite) || viewport.width < 1 || viewport.height < 1) return undefined
  // The named ecology objective is public information. Keep its edge label below
  // the HUD and clear of both physical host buttons in portrait and landscape.
  const top = Math.min(180, viewport.height * 0.4)
  const bottom = Math.min(64, viewport.height * 0.15)
  const margin = Math.min(40, viewport.width * 0.12, (viewport.height - top - bottom) / 4)
  const warning = edgeWarningPosition({ x: point.x, y: point.y - top }, { width: viewport.width, height: viewport.height - top - bottom }, margin)
  return warning ? { ...warning, y: warning.y + top, edge: true } : { ...point, angle: 0, edge: false }
}

function drawEcologicalObjective(context: CanvasRenderingContext2D, snapshot: WorldRenderSnapshot, camera: CameraFrame, viewport: { width: number; height: number }, elapsedMs: number) {
  const ecosystem = snapshot.ecosystem
  const position = ecosystem?.encounterPosition
  if (!ecosystem || ecosystem.encounterResolved || !position) return
  const point = {
    x: camera.anchor.x + (position.x - camera.center.x) * camera.zoom,
    y: camera.anchor.y + (position.y - camera.center.y) * camera.zoom,
  }
  const cue = objectiveScreenCue(point, viewport)
  if (!cue) return
  const entity = snapshot.entities.find((candidate) => Math.hypot(candidate.position.x - position.x, candidate.position.y - position.y) < 1)
  const radius = entity ? entity.body.radius * camera.zoom + 10 : 24
  context.save()
  context.translate(cue.x, cue.y)
  context.strokeStyle = '#ffe4a2'
  context.fillStyle = '#ffe4a2'
  context.lineWidth = 2
  context.globalAlpha = 0.8
  if (cue.edge) {
    context.rotate(cue.angle)
    context.beginPath()
    context.moveTo(10, 0)
    context.lineTo(-4, -7)
    context.lineTo(-4, 7)
    context.closePath()
    context.fill()
    context.rotate(-cue.angle)
  } else {
    // Four open, quiet brackets distinguish the encounter from ordinary threats.
    for (let index = 0; index < 4; index += 1) {
      const angle = index / 4 * Math.PI * 2 + Math.PI / 4
      context.beginPath()
      context.arc(0, 0, radius + Math.sin(elapsedMs / 650) * 1.5, angle - 0.19, angle + 0.19)
      context.stroke()
    }
  }
  context.globalAlpha = 1
  context.font = '600 12px sans-serif'
  context.textAlign = 'center'
  const labelWidth = Math.min(viewport.width - 40, context.measureText(ecosystem.encounterName).width + 20)
  const labelX = Math.max(16 + labelWidth / 2 - cue.x, Math.min(viewport.width - 16 - labelWidth / 2 - cue.x, 0))
  const safeTop = Math.min(180, viewport.height * 0.4)
  const preferredLabelY = cue.edge ? 24 : cue.y - radius - 24 < safeTop ? radius + 24 : -radius - 10
  const labelY = Math.max(safeTop + 14 - cue.y, Math.min(viewport.height - 20 - cue.y, preferredLabelY))
  context.fillStyle = 'rgb(7 20 34 / 90%)'
  context.fillRect(labelX - labelWidth / 2, labelY - 14, labelWidth, 22)
  context.fillStyle = '#ffe4a2'
  context.fillText(ecosystem.encounterName, labelX, labelY + 1, labelWidth - 10)
  context.restore()
}

function drawFormBloom(context: CanvasRenderingContext2D, position: Vec2, radius: number, bloom: number, alpha: number, reducedMotion: boolean, reducedFlash: boolean) {
  context.save()
  context.translate(position.x, position.y)
  context.globalAlpha = alpha * (reducedMotion || reducedFlash ? 0.2 : Math.max(0, 1 - bloom) * 0.75)
  context.strokeStyle = '#d6ffe9'
  context.lineWidth = Math.max(1.5, radius * 0.035)
  context.beginPath()
  context.arc(0, 0, radius * (reducedMotion ? 1.15 : 1.05 + bloom * 3.8), 0, Math.PI * 2)
  context.stroke()
  for (let ray = 0; ray < (reducedMotion ? 3 : 12); ray += 1) {
    const angle = ray / 12 * Math.PI * 2
    context.beginPath()
    const inner = radius * (0.7 + bloom * 0.5)
    const outer = radius * (1.1 + bloom * 0.8)
    context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
    context.quadraticCurveTo(Math.cos(angle + 0.12) * outer, Math.sin(angle + 0.12) * outer, Math.cos(angle) * outer, Math.sin(angle) * outer)
    context.stroke()
  }
  context.restore()
}

function drawReversal(context: CanvasRenderingContext2D, snapshot: WorldRenderSnapshot, player: EntityState, position: Vec2, radius: number, viewport: { width: number; height: number }, presentation: { radiusScale: number; textOffset: number; alpha: number }) {
  const pose = membranePose(player, snapshot.elapsedMs)
  const contour = membraneContour(membraneSilhouette(player, snapshot.lifecycle.formId), snapshot.elapsedMs, player.id)
  const shell = radius * pose.pulse * presentation.radiusScale
  context.save()
  context.globalAlpha = presentation.alpha
  context.translate(position.x, position.y)
  context.rotate(pose.heading)
  context.scale(1 + pose.strain, 1 - pose.strain)
  context.strokeStyle = '#ffe3a1'
  context.lineWidth = 2
  context.beginPath()
  for (const [index, point] of contour.entries()) {
    if (index === 0) context.moveTo(point.x * shell, point.y * shell)
    else context.lineTo(point.x * shell, point.y * shell)
  }
  context.closePath()
  context.stroke()
  context.restore()

  // Keep the reward close to the player while leaving the host buttons and HUD clear.
  const x = Math.max(125, Math.min(viewport.width - 125, position.x))
  const y = Math.max(Math.min(180, viewport.height * 0.4) + 20, position.y - radius - 32 - presentation.textOffset)
  context.save()
  context.globalAlpha = presentation.alpha
  context.textAlign = 'center'
  context.shadowColor = '#071725'
  context.shadowBlur = 4
  context.font = '800 19px sans-serif'
  context.fillStyle = '#ffe3a1'
  context.fillText(rawContent.ui.hud.reversalNotice, x, y)
  context.font = '500 12px sans-serif'
  context.fillStyle = '#e0f7ed'
  context.fillText(rawContent.ui.hud.reversalHint, x, y + 19, viewport.width - 32)
  context.restore()
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

function drawEngulfBursts(
  context: CanvasRenderingContext2D,
  position: { x: number; y: number },
  radius: number,
  effects: readonly NumberEffect[],
  elapsedMs: number,
  reducedMotion: boolean,
  reducedFlash: boolean,
  quality: RenderQuality,
): void {
  effects.filter((effect) => effect.kind === 'biomass' && effect.entityId === 'player').forEach((effect) => {
    const age = elapsedMs - effect.atMs
    if (age < 0 || age > 520) return
    const progress = age / 520
    const rings = effect.chain > 1 && quality !== 'low' ? 2 : 1
    context.save()
    context.translate(position.x, position.y)
    context.globalAlpha = (reducedFlash ? 0.3 : 0.62) * (1 - progress)
    context.strokeStyle = effect.chain > 2 ? '#ffe68a' : '#8effef'
    context.shadowColor = context.strokeStyle
    context.shadowBlur = quality === 'high' && !reducedFlash ? 10 : 0
    context.lineWidth = Math.max(2, radius * 0.08)
    for (let index = 0; index < rings; index += 1) {
      context.beginPath()
      context.arc(0, 0, radius * (1.04 + index * 0.08 + (reducedMotion ? 0 : progress * 0.1)), -0.55, 0.55)
      context.stroke()
    }
    if (effect.chain > 1 && !reducedMotion && quality !== 'low') {
      context.lineWidth = 2
      for (let index = 0; index < Math.min(8, effect.chain + 2); index += 1) {
        const angle = index / Math.min(8, effect.chain + 2) * Math.PI * 2
        const inner = radius * (1.04 + progress * 0.08)
        const outer = inner + radius * 0.08
        context.beginPath()
        context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
        context.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer)
        context.stroke()
      }
    }
    context.restore()
  })
}

export function screenImpactOffset(
  effects: readonly NumberEffect[],
  elapsedMs: number,
  reducedMotion: boolean,
): { x: number; y: number } {
  if (reducedMotion) return { x: 0, y: 0 }
  const recent = effects.reduce<{ age: number; amplitude: number } | undefined>((best, effect) => {
    const age = elapsedMs - effect.atMs
    if (age < 0 || age > 220) return best
    const meaningfulEngulf = effect.kind === 'biomass' && (effect.chain >= 3 || effect.amount >= 80)
    if (effect.kind === 'biomass' && !meaningfulEngulf) return best
    const amplitude = effect.kind === 'damage' ? 2.6 : meaningfulEngulf ? Math.min(5, 1.5 + effect.chain * 0.8) : 0
    return !best || amplitude > best.amplitude ? { age, amplitude } : best
  }, undefined)
  if (!recent) return { x: 0, y: 0 }
  const decay = 1 - recent.age / 220
  const phase = elapsedMs / 22
  return {
    x: Math.sin(phase * 1.7) * recent.amplitude * decay,
    y: Math.cos(phase * 1.3) * recent.amplitude * decay,
  }
}

function drawMaterializationBloom(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  entity: EntityState,
  presentation: { radiusScale: number; ringAlpha: number },
) {
  context.save()
  context.globalCompositeOperation = 'screen'
  context.globalAlpha = presentation.ringAlpha
  context.strokeStyle = entity.faction === 'hostile' ? '#ff9f68' : '#91fff1'
  context.shadowColor = context.strokeStyle
  context.shadowBlur = entity.faction === 'hostile' ? 16 : 10
  context.lineWidth = entity.faction === 'hostile' ? 2.4 : 1.5
  context.beginPath()
  context.arc(x, y, radius * (1.5 - presentation.radiusScale * 0.25), 0, Math.PI * 2)
  context.stroke()
  context.restore()
}

function drawArrivalEdgeWarning(
  context: CanvasRenderingContext2D,
  warning: Vec2 & { angle: number },
  elapsedMs: number,
  reducedMotion: boolean,
) {
  const pulse = reducedMotion ? 1 : 0.86 + Math.sin(elapsedMs / 90) * 0.14
  context.save()
  context.translate(warning.x, warning.y)
  context.rotate(warning.angle)
  context.globalCompositeOperation = 'screen'
  context.globalAlpha = 0.78
  context.fillStyle = '#ff8b66'
  context.shadowColor = '#ff704f'
  context.shadowBlur = 12
  context.beginPath()
  context.moveTo(10 * pulse, 0)
  context.lineTo(-7 * pulse, -7 * pulse)
  context.lineTo(-4 * pulse, 0)
  context.lineTo(-7 * pulse, 7 * pulse)
  context.closePath()
  context.fill()
  context.restore()
}

function drawWorldBoundary(
  context: CanvasRenderingContext2D,
  snapshot: Pick<WorldRenderSnapshot, 'width' | 'height'>,
  camera: CameraFrame,
  width: number,
  height: number,
  elapsedMs: number,
) {
  const boundary = worldBoundaryScreenRect(camera, snapshot)
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
  for (const origin of backdropTileOrigins({ width, height }, tile, offset)) {
    context.drawImage(image, origin.x, origin.y, tile.width, tile.height)
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
  camera: CameraFrame,
  width: number,
  height: number,
  reducedMotion = false,
  reducedFlash = false,
) {
  const field = snapshot.environmentField
  const { center, anchor, zoom } = camera
  context.save()
  const bodies = snapshot.entities.filter((entity) => entity.faction === 'player' && entity.status === 'active')
    .map((entity) => ({ position: entity.position, radius: entity.body.radius }))
  for (const obstacle of field.obstacles) {
    if (obstacle.kind === 'fiber') {
      for (const section of fiberSections(obstacle)) {
      const points = fiberStrandPoints(section.from, section.to, bodies).map((point) => ({
        x: anchor.x + (point.x - center.x) * zoom,
        y: anchor.y + (point.y - center.y) * zoom,
      }))
      context.setLineDash([])
      context.lineCap = 'round'
      context.lineJoin = 'round'
      // A translucent sheath and continuous strands distinguish tissue from a border.
      for (const [stroke, lineWidth, alpha, offset] of [
        ['#4caa96', Math.max(8, 16 * zoom), 0.16, 0],
        ['#70cdb0', Math.max(1.5, 3 * zoom), 0.7, -2.5 * zoom],
        ['#b6eac8', Math.max(1, 1.8 * zoom), 0.65, 2.5 * zoom],
      ] as const) {
        context.strokeStyle = stroke
        context.lineWidth = lineWidth
        context.globalAlpha = alpha
        context.beginPath()
        points.forEach((point, index) => {
          const previous = points[Math.max(0, index - 1)]!
          const next = points[Math.min(points.length - 1, index + 1)]!
          const length = Math.hypot(next.x - previous.x, next.y - previous.y) || 1
          const x = point.x - (next.y - previous.y) / length * offset
          const y = point.y + (next.x - previous.x) / length * offset
          if (index === 0) context.moveTo(x, y)
          else context.lineTo(x, y)
        })
        context.stroke()
      }
      }
      if (obstacle.strainMs && obstacle.strainPosition) {
        context.globalAlpha = reducedFlash ? 0.25 : 0.6
        context.strokeStyle = '#ffe3a1'
        context.lineWidth = 2
        context.beginPath()
        context.arc(anchor.x + (obstacle.strainPosition.x - center.x) * zoom, anchor.y + (obstacle.strainPosition.y - center.y) * zoom, (8 + obstacle.strainMs / rawContent.fiberTraversal.breakHoldMs * 12) * zoom, 0, Math.PI * 2)
        context.stroke()
      }
      continue
    }
    for (const section of fiberSections(obstacle)) {
    const from = {
      x: anchor.x + (section.from.x - center.x) * zoom,
      y: anchor.y + (section.from.y - center.y) * zoom,
    }
    const to = {
      x: anchor.x + (section.to.x - center.x) * zoom,
      y: anchor.y + (section.to.y - center.y) * zoom,
    }
    context.globalAlpha = 0.72
    context.strokeStyle = obstacle.adhesive ? '#89e2c5' : '#9a89bc'
    context.lineWidth = obstacle.kind === 'chamber-wall' ? Math.max(5, 10 * zoom) : 5
    context.setLineDash(obstacle.adhesive ? [4, 7] : [])
    context.beginPath()
    context.moveTo(from.x, from.y)
    context.lineTo(to.x, to.y)
    context.stroke()
    if (obstacle.kind === 'chamber-wall') {
      context.strokeStyle = '#e7bc88'
      context.lineWidth = Math.max(1, 2 * zoom)
      context.beginPath()
      context.moveTo(from.x, from.y - 2)
      context.lineTo(to.x, to.y - 2)
      context.stroke()
      const count = Math.min(30, Math.floor(Math.hypot(to.x - from.x, to.y - from.y) / 24))
      context.globalAlpha = 0.35
      for (let index = 1; index <= count; index += 1) {
        const t = index / (count + 1), x = from.x + (to.x - from.x) * t, y = from.y + (to.y - from.y) * t
        context.beginPath(); context.moveTo(x - 3, y - 5); context.lineTo(x + 3, y + 5); context.stroke()
      }
    }
    }
  }
  for (const broken of field.recentBreaks ?? []) {
    const age = snapshot.elapsedMs - broken.atMs
    if (age < 0 || age >= 1100) continue
    const progress = age / 1100
    const x = anchor.x + (broken.position.x - center.x) * zoom
    const y = anchor.y + (broken.position.y - center.y) * zoom
    context.globalAlpha = (reducedFlash ? 0.25 : 0.7) * (1 - progress)
    context.strokeStyle = '#c7f5cf'
    context.lineWidth = 2
    for (let index = 0; index < (reducedMotion ? 4 : 10); index += 1) {
      const angle = index * 2.39996
      const travel = broken.radius * zoom * (reducedMotion ? 0.3 : 0.2 + progress * 0.8)
      const px = x + Math.cos(angle) * travel, py = y + Math.sin(angle) * travel
      context.beginPath(); context.moveTo(px, py); context.lineTo(px + Math.cos(angle + 0.7) * 7, py + Math.sin(angle + 0.7) * 7); context.stroke()
    }
  }
  if (field.environmentId === 'env-acid-vesicle' && field.safeCenters.length > 0) {
    const safe = field.safeCenters[0]!
    const safeX = anchor.x + (safe.x - center.x) * zoom
    const safeY = anchor.y + (safe.y - center.y) * zoom
    context.globalAlpha = field.activeHazardIds.includes('hazard-acid-discharge') ? 0.26 : 0.18
    context.fillStyle = '#d94f68'
    context.beginPath()
    context.rect(0, 0, width, height)
    context.arc(safeX, safeY, field.safeRadius * zoom, 0, Math.PI * 2, true)
    context.fill('evenodd')
  }
  for (const cue of field.telegraphs) {
    const center = field.hazardCenters[cue.hazardId] ?? cue.center
    const x = anchor.x + (center.x - camera.center.x) * zoom
    const y = anchor.y + (center.y - camera.center.y) * zoom
    const radius = cue.radius * zoom
    const active = field.activeHazardIds.includes(cue.hazardId)
    const telegraphing = snapshot.elapsedMs >= cue.startsAtMs && snapshot.elapsedMs < cue.activatesAtMs
    if (!active && !telegraphing) continue
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
  context.lineWidth = 4
  context.globalAlpha = 0.9
  for (const center of field.safeCenters) {
    const x = anchor.x + (center.x - camera.center.x) * zoom
    const y = anchor.y + (center.y - camera.center.y) * zoom
    context.fillStyle = 'rgba(126, 255, 196, 0.14)'
    context.beginPath()
    context.arc(x, y, field.safeRadius * zoom, 0, Math.PI * 2)
    context.fill()
    context.setLineDash([12, 8])
    context.beginPath()
    context.arc(x, y, field.safeRadius * zoom, 0, Math.PI * 2)
    context.stroke()
    const edge = edgeWarningPosition({ x, y }, { width, height }, 28)
    if (edge) {
      context.save()
      context.translate(edge.x, edge.y)
      context.rotate(edge.angle)
      context.fillStyle = '#9dffd1'
      context.globalAlpha = 0.95
      context.beginPath()
      context.moveTo(13, 0)
      context.lineTo(-8, -8)
      context.lineTo(-8, 8)
      context.closePath()
      context.fill()
      context.restore()
    }
  }
  context.setLineDash([])
  context.restore()
}

function drawVisibilityVeil(
  context: CanvasRenderingContext2D,
  visibility: number,
  width: number,
  height: number,
  anchor: { x: number; y: number },
  sightRadius?: number,
) {
  const opacity = Math.max(0, Math.min(0.38, (1 - visibility) * 0.5))
  if (opacity <= 0 && sightRadius === undefined) return
  const radius = Math.max(32, sightRadius ?? Math.max(width, height) * 0.65)
  const gradient = context.createRadialGradient(anchor.x, anchor.y, radius * 0.72, anchor.x, anchor.y, radius)
  gradient.addColorStop(0, 'rgba(4, 10, 20, 0)')
  gradient.addColorStop(1, `rgba(4, 10, 20, ${sightRadius === undefined ? opacity : 0.72})`)
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
  camera: CameraFrame,
) {
  const event = snapshot.activeEvent
  if (!event || event.phase === 'expired') return
  const x = camera.anchor.x + (event.center.x - camera.center.x) * camera.zoom
  const y = camera.anchor.y + (event.center.y - camera.center.y) * camera.zoom
  const radius = event.variant.radius * camera.zoom
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
  camera: CameraFrame,
) {
  for (const [index, rift] of snapshot.routeRifts.entries()) {
    if (snapshot.elapsedMs < rift.opensAtMs - 12_000) continue
    const x = camera.anchor.x + (rift.position.x - camera.center.x) * camera.zoom
    const y = camera.anchor.y + (rift.position.y - camera.center.y) * camera.zoom
    const radius = rift.radius * camera.zoom
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

export function renderPixelRatio(quality: RenderQuality, devicePixelRatio: number): number {
  const dpr = Math.max(1, devicePixelRatio || 1)
  if (quality === 'high') return Math.min(2, dpr)
  if (quality === 'low') return Math.min(1, Math.max(0.7, dpr * 0.6))
  return Math.min(1.25, Math.max(0.8, dpr * 0.75))
}

function resizeCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D, quality: RenderQuality) {
  const width = Math.max(1, canvas.clientWidth)
  const height = Math.max(1, canvas.clientHeight)
  const ratio = renderPixelRatio(quality, window.devicePixelRatio || 1)
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
  camera: CameraFrame,
) {
  // Physics and the membrane share the exact radius. Delaying its visual growth
  // could swallow prey before the rendered membrane has actually enclosed it.
  const radius = entity.body.radius
  return {
    entity,
    radius: radius * camera.zoom,
    x: camera.anchor.x + (entity.position.x - camera.center.x) * camera.zoom,
    y: camera.anchor.y + (entity.position.y - camera.center.y) * camera.zoom,
  }
}
