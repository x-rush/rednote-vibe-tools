import type { Fish, Point } from '../simulation.ts'

export type TrailParticle = Point & {
  vx: number
  vy: number
  age: number
  life: number
  size: number
  angle: number
  stretch: number
  tone: number
}

export type RippleParticle = Point & { age: number; life: number; energy: number }

const MAX_TRAILS = 320
const MAX_RIPPLES = 12

export class ParticleField {
  readonly trails: TrailParticle[] = []
  readonly ripples: RippleParticle[] = []
  private frame = 0
  private sequence = 0

  clear() {
    this.trails.length = 0
    this.ripples.length = 0
    this.frame = 0
  }

  addRipple(point: Point, energy = 1) {
    if (this.ripples.length >= MAX_RIPPLES) this.ripples.shift()
    this.ripples.push({ ...point, age: 0, life: 1.15, energy })
  }

  emitTrails(fish: readonly Fish[], following: boolean, reducedMotion: boolean) {
    this.frame += 1
    const stride = reducedMotion ? 14 : following ? 3 : 8
    for (let index = 0; index < fish.length; index += 1) {
      if ((this.frame + index * 3) % stride !== 0) continue
      const item = fish[index]
      const speed = Math.hypot(item.vx, item.vy)
      if (speed < 19) continue
      const angle = item.heading ?? Math.atan2(item.vy, item.vx)
      const pulse = Math.sin(this.sequence * 2.17 + item.phase) * 0.5 + 0.5
      this.sequence += 1
      if (this.trails.length >= MAX_TRAILS) this.trails.shift()
      this.trails.push({
        x: item.x - Math.cos(angle) * item.size * (2.2 + pulse),
        y: item.y - Math.sin(angle) * item.size * (2.2 + pulse),
        vx: -Math.cos(angle) * speed * 0.07 + Math.sin(angle) * (pulse - 0.5) * 4,
        vy: -Math.sin(angle) * speed * 0.07 - Math.cos(angle) * (pulse - 0.5) * 4,
        age: 0,
        life: (following ? 0.78 : 0.55) + pulse * 0.22,
        size: item.size * (0.28 + pulse * 0.22),
        angle,
        stretch: 1.1 + Math.min(1.5, speed / 54),
        tone: item.tone,
      })
    }
  }

  update(dt: number) {
    let write = 0
    for (let read = 0; read < this.trails.length; read += 1) {
      const particle = this.trails[read]
      particle.age += dt
      if (particle.age >= particle.life) continue
      particle.x += particle.vx * dt
      particle.y += particle.vy * dt
      particle.vx *= 0.985
      particle.vy *= 0.985
      this.trails[write] = particle
      write += 1
    }
    this.trails.length = write

    write = 0
    for (let read = 0; read < this.ripples.length; read += 1) {
      const ripple = this.ripples[read]
      ripple.age += dt
      if (ripple.age >= ripple.life) continue
      this.ripples[write] = ripple
      write += 1
    }
    this.ripples.length = write
  }
}
