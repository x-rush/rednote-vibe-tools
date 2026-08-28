import type { Vec2 } from './types'

export function add(left: Vec2, right: Vec2): Vec2 {
  return { x: left.x + right.x, y: left.y + right.y }
}

export function scale(vector: Vec2, factor: number): Vec2 {
  return { x: vector.x * factor, y: vector.y * factor }
}

export function length(vector: Vec2): number {
  return Math.hypot(vector.x, vector.y)
}

export function normalize(vector: Vec2): Vec2 {
  const magnitude = length(vector)
  return magnitude === 0 ? { x: 0, y: 0 } : scale(vector, 1 / magnitude)
}

export function lerp(from: Vec2, to: Vec2, amount: number): Vec2 {
  return {
    x: from.x + (to.x - from.x) * amount,
    y: from.y + (to.y - from.y) * amount,
  }
}
