import type { Bounds, Fish, Leaf } from '../simulation.ts'
import type { RippleParticle, TrailParticle } from './particles.ts'

const TAU = Math.PI * 2
const LEAF_COLORS = ['#176b4c', '#1f7953', '#2a8659', '#357f54', '#126244']
const LEAF_LIGHTS = ['#4f9d68', '#67aa72', '#7ab47b', '#549763', '#3c8b5a']
const FISH_COLORS = ['#c83d32', '#dc4937', '#b93432', '#e05c46', '#c63f3c', '#dc7668', '#bc514b']

export type PosterBackground = {
  image: CanvasImageSource
  width: number
  height: number
}

export function getCoverCrop(imageWidth: number, imageHeight: number, bounds: Bounds) {
  const sourceAspect = imageWidth / imageHeight
  const targetAspect = bounds.width / bounds.height
  if (sourceAspect > targetAspect) {
    const width = imageHeight * targetAspect
    return { x: (imageWidth - width) * 0.5, y: 0, width, height: imageHeight }
  }
  const height = imageWidth / targetAspect
  return { x: 0, y: (imageHeight - height) * 0.5, width: imageWidth, height }
}

export function getFishBend(fish: Fish) {
  const velocityAngle = Math.atan2(fish.vy, fish.vx)
  const angle = fish.heading ?? velocityAngle
  const difference = Math.atan2(Math.sin(velocityAngle - angle), Math.cos(velocityAngle - angle))
  return Math.max(-0.52, Math.min(0.52, difference))
}

export function drawWater(
  ctx: CanvasRenderingContext2D,
  bounds: Bounds,
  time: number,
  reducedMotion: boolean,
  background?: PosterBackground | null,
) {
  if (background) {
    const crop = getCoverCrop(background.width, background.height, bounds)
    ctx.drawImage(background.image, crop.x, crop.y, crop.width, crop.height, 0, 0, bounds.width, bounds.height)
  } else {
    ctx.fillStyle = '#e9eee6'
    ctx.fillRect(0, 0, bounds.width, bounds.height)

    ctx.save()
    ctx.globalAlpha = 0.16
    ctx.fillStyle = '#cbded1'
    ctx.beginPath()
    ctx.ellipse(bounds.width * 0.58, bounds.height * 0.46, bounds.width * 0.54, bounds.height * 0.33, -0.18, 0, TAU)
    ctx.fill()
    ctx.globalAlpha = 0.1
    ctx.fillStyle = '#e2d3c3'
    ctx.beginPath()
    ctx.ellipse(bounds.width * 0.18, bounds.height * 0.8, bounds.width * 0.48, bounds.height * 0.25, 0.3, 0, TAU)
    ctx.fill()
    ctx.restore()
  }

  const motion = reducedMotion ? 0 : time * 0.00018
  ctx.lineWidth = 0.65
  for (let line = 0; line < 10; line += 1) {
    const y = bounds.height * (0.12 + line * 0.095) + Math.sin(motion + line * 1.7) * 3
    ctx.beginPath()
    for (let x = -24; x <= bounds.width + 24; x += 16) {
      const waveY = y + Math.sin(x * 0.021 + line * 0.9 + motion) * (2 + line % 3)
      if (x === -24) ctx.moveTo(x, waveY)
      else ctx.lineTo(x, waveY)
    }
    ctx.strokeStyle = line % 2 ? 'rgba(255,255,255,.24)' : 'rgba(47,100,79,.065)'
    ctx.stroke()
  }
}

export function drawTrail(ctx: CanvasRenderingContext2D, particle: TrailParticle, reducedMotion: boolean) {
  const progress = particle.age / particle.life
  const alpha = (1 - progress) * (reducedMotion ? 0.22 : 0.5)
  const color = FISH_COLORS[particle.tone % FISH_COLORS.length]
  ctx.save()
  ctx.translate(particle.x, particle.y)
  ctx.rotate(particle.angle)
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(0, 0, Math.max(0.35, particle.size * particle.stretch * (1 - progress * 0.5)), Math.max(0.3, particle.size * (1 - progress)), 0, 0, TAU)
  ctx.fill()
  ctx.restore()
}

export function drawFish(ctx: CanvasRenderingContext2D, fish: Fish) {
  const velocityAngle = Math.atan2(fish.vy, fish.vx)
  const angle = fish.heading ?? velocityAngle
  const bend = getFishBend(fish)
  const wag = Math.sin(fish.phase) * fish.size * (0.48 + Math.min(0.45, Math.hypot(fish.vx, fish.vy) / 120)) + bend * fish.size * 1.8
  const color = FISH_COLORS[fish.tone % FISH_COLORS.length]
  const pale = fish.tone > 4

  ctx.save()
  ctx.translate(fish.x, fish.y)
  ctx.rotate(angle)
  ctx.globalAlpha = 0.94

  ctx.beginPath()
  ctx.moveTo(-fish.size * 1.35, 0)
  ctx.quadraticCurveTo(-fish.size * 2.4, -fish.size * 0.7 + wag * 0.4, -fish.size * 2.9, wag)
  ctx.quadraticCurveTo(-fish.size * 2.35, wag * 0.08, -fish.size * 1.35, 0)
  ctx.quadraticCurveTo(-fish.size * 2.35, -wag * 0.08, -fish.size * 2.85, -wag * 0.78)
  ctx.quadraticCurveTo(-fish.size * 2.25, fish.size * 0.62 - wag * 0.24, -fish.size * 1.35, 0)
  ctx.fillStyle = color
  ctx.globalAlpha = pale ? 0.7 : 0.82
  ctx.fill()

  ctx.globalAlpha = pale ? 0.76 : 0.96
  ctx.beginPath()
  ctx.moveTo(fish.size * 1.8, 0)
  ctx.bezierCurveTo(fish.size * 0.95, -fish.size * 0.62, -fish.size * 0.72, -fish.size * 0.58, -fish.size * 1.45, 0)
  ctx.bezierCurveTo(-fish.size * 0.7, fish.size * 0.62, fish.size * 0.95, fish.size * 0.58, fish.size * 1.8, 0)
  ctx.fillStyle = color
  ctx.fill()

  ctx.globalAlpha = 0.28
  ctx.strokeStyle = '#ffe2c4'
  ctx.lineWidth = Math.max(0.45, fish.size * 0.15)
  ctx.beginPath()
  ctx.moveTo(-fish.size * 0.9, -fish.size * 0.1)
  ctx.quadraticCurveTo(fish.size * 0.25, -fish.size * 0.45, fish.size * 1.15, -fish.size * 0.1)
  ctx.stroke()

  ctx.globalAlpha = 0.68
  ctx.fillStyle = '#352e28'
  ctx.beginPath()
  ctx.arc(fish.size * 1.18, -fish.size * 0.18, Math.max(0.35, fish.size * 0.1), 0, TAU)
  ctx.fill()
  ctx.restore()
}

export function drawLeaf(ctx: CanvasRenderingContext2D, leaf: Leaf, time: number, reducedMotion: boolean) {
  const tone = leaf.tone ?? 0
  const aspect = leaf.aspect ?? 0.84
  const drift = leaf.drift ?? 1
  const motion = reducedMotion ? 0 : Math.sin(time * 0.00042 * drift + leaf.x * 0.035) * 1.1
  const rotation = leaf.rotation + (reducedMotion ? 0 : Math.sin(time * 0.00016 + leaf.y) * 0.012)
  const dark = LEAF_COLORS[tone % LEAF_COLORS.length]
  const light = LEAF_LIGHTS[tone % LEAF_LIGHTS.length]

  ctx.save()
  ctx.translate(leaf.x, leaf.y + motion)
  ctx.rotate(rotation)
  ctx.scale(1, aspect)

  ctx.save()
  ctx.translate(1.5, 2.6 / aspect)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.arc(0, 0, leaf.radius, leaf.notch, TAU - leaf.notch)
  ctx.closePath()
  ctx.fillStyle = 'rgba(18,61,45,.15)'
  ctx.fill()
  ctx.restore()

  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.arc(0, 0, leaf.radius, leaf.notch, TAU - leaf.notch)
  ctx.closePath()
  ctx.fillStyle = dark
  ctx.fill()

  ctx.globalAlpha = 0.48 + (leaf.light ?? 0) * 0.08
  ctx.fillStyle = light
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.arc(0, 0, leaf.radius * 0.9, Math.PI * 0.7, Math.PI * 1.54)
  ctx.quadraticCurveTo(-leaf.radius * 0.18, -leaf.radius * 0.08, 0, 0)
  ctx.fill()

  ctx.globalAlpha = 0.34
  ctx.strokeStyle = '#c5dcae'
  ctx.lineWidth = Math.max(0.45, leaf.radius * 0.025)
  ctx.beginPath()
  ctx.arc(0, 0, leaf.radius - 0.7, leaf.notch + 0.06, TAU - leaf.notch - 0.06)
  ctx.stroke()

  const veinShift = leaf.vein ?? 0
  ctx.globalAlpha = 0.2
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(-leaf.radius * 0.86, leaf.radius * veinShift * 0.06)
  for (let vein = -2; vein <= 2; vein += 1) {
    const angle = Math.PI + vein * 0.33 + veinShift * 0.08
    ctx.moveTo(-leaf.radius * 0.05, 0)
    ctx.lineTo(Math.cos(angle) * leaf.radius * (0.56 + Math.abs(vein) * 0.06), Math.sin(angle) * leaf.radius * 0.72)
  }
  ctx.stroke()

  if (leaf.flower) drawFlower(ctx, leaf.radius, aspect)
  ctx.restore()
}

function drawFlower(ctx: CanvasRenderingContext2D, radius: number, aspect: number) {
  ctx.save()
  ctx.scale(1, 1 / aspect)
  ctx.rotate(-0.28)
  ctx.globalAlpha = 0.86
  for (let petal = 0; petal < 7; petal += 1) {
    ctx.rotate(TAU / 7)
    ctx.beginPath()
    ctx.ellipse(0, -radius * 0.13, radius * 0.1, radius * 0.26, 0, 0, TAU)
    ctx.fillStyle = petal % 2 ? '#efb4b1' : '#f4ccc2'
    ctx.fill()
  }
  ctx.globalAlpha = 0.8
  ctx.fillStyle = '#c9974c'
  ctx.beginPath()
  ctx.arc(0, 0, radius * 0.075, 0, TAU)
  ctx.fill()
  ctx.restore()
}

export function drawRipple(ctx: CanvasRenderingContext2D, ripple: RippleParticle) {
  const progress = ripple.age / ripple.life
  ctx.save()
  ctx.globalAlpha = (1 - progress) * 0.2 * ripple.energy
  ctx.strokeStyle = '#456f61'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.ellipse(ripple.x, ripple.y, 8 + progress * 38, (8 + progress * 38) * 0.45, 0, 0, TAU)
  ctx.stroke()
  ctx.restore()
}
