import type { BodyShape, Vec2 } from '../domain/types'

export function mostlyContains(container: BodyShape, target: BodyShape, minimumCoveredRatio = 0.7): boolean {
  if (container.radius <= target.radius) return false
  return coveredRatio(container, target) >= Math.min(1, Math.max(0, minimumCoveredRatio))
}

export function coveredRatio(container: BodyShape, target: BodyShape): number {
  const containerRadius = Math.max(0, container.radius)
  const targetRadius = Math.max(0, target.radius)
  if (targetRadius === 0) return 0
  const centerDistance = Math.hypot(
    target.center.x - container.center.x,
    target.center.y - container.center.y,
  )
  if (centerDistance >= containerRadius + targetRadius) return 0
  if (centerDistance <= Math.abs(containerRadius - targetRadius)) {
    return containerRadius >= targetRadius ? 1 : (containerRadius * containerRadius) / (targetRadius * targetRadius)
  }

  const containerAngle = Math.acos(clampCosine(
    (centerDistance * centerDistance + containerRadius * containerRadius - targetRadius * targetRadius)
      / (2 * centerDistance * containerRadius),
  ))
  const targetAngle = Math.acos(clampCosine(
    (centerDistance * centerDistance + targetRadius * targetRadius - containerRadius * containerRadius)
      / (2 * centerDistance * targetRadius),
  ))
  const overlapArea = containerRadius * containerRadius * containerAngle
    + targetRadius * targetRadius * targetAngle
    - 0.5 * Math.sqrt(Math.max(0,
      (-centerDistance + containerRadius + targetRadius)
      * (centerDistance + containerRadius - targetRadius)
      * (centerDistance - containerRadius + targetRadius)
      * (centerDistance + containerRadius + targetRadius),
    ))
  return Math.min(1, Math.max(0, overlapArea / (Math.PI * targetRadius * targetRadius)))
}

export function fullyContains(container: BodyShape, target: BodyShape, tolerance = 0): boolean {
  const acceptedTolerance = Math.max(0, tolerance)
  const centerDistance = Math.hypot(
    target.center.x - container.center.x,
    target.center.y - container.center.y,
  )

  if (centerDistance + target.radius > container.radius + acceptedTolerance) {
    return false
  }
  if (container.contour.length < 3 || target.contour.length < 3) {
    return false
  }

  // An interior center and its nearest edge define a disk wholly inside even a
  // concave polygon. If every target vertex is in that disk, the full contour
  // is contained. Recompute from the current geometry; bodies are mutable.
  if (pointInsideContour(container.center, container.contour, 0)) {
    let diskRadiusSquared = Number.POSITIVE_INFINITY
    for (let index = 0; index < container.contour.length; index += 1) {
      diskRadiusSquared = Math.min(diskRadiusSquared, distanceToSegmentSquared(
        container.center, container.contour[index]!, container.contour[(index + 1) % container.contour.length]!,
      ))
    }
    if (target.contour.every((point) => {
      const x = point.x - container.center.x
      const y = point.y - container.center.y
      return x * x + y * y < diskRadiusSquared
    })) return true
  }

  return target.contour.every((point) => pointInsideContour(point, container.contour, acceptedTolerance))
}

function pointInsideContour(point: Vec2, contour: readonly Vec2[], tolerance: number): boolean {
  let inside = false

  for (let currentIndex = 0, previousIndex = contour.length - 1; currentIndex < contour.length; previousIndex = currentIndex, currentIndex += 1) {
    const current = contour[currentIndex]
    const previous = contour[previousIndex]

    if (distanceToSegmentSquared(point, previous, current) <= tolerance * tolerance) {
      return true
    }

    const crossesRay = (current.y > point.y) !== (previous.y > point.y)
      && point.x < (previous.x - current.x) * (point.y - current.y) / (previous.y - current.y) + current.x
    if (crossesRay) inside = !inside
  }

  return inside
}

function distanceToSegmentSquared(point: Vec2, start: Vec2, end: Vec2): number {
  const segmentX = end.x - start.x
  const segmentY = end.y - start.y
  const squaredLength = segmentX * segmentX + segmentY * segmentY

  if (squaredLength === 0) {
    const x = point.x - start.x
    const y = point.y - start.y
    return x * x + y * y
  }

  const projection = Math.min(1, Math.max(0,
    ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) / squaredLength,
  ))
  const nearestX = start.x + projection * segmentX
  const nearestY = start.y + projection * segmentY
  const x = point.x - nearestX
  const y = point.y - nearestY
  return x * x + y * y
}

function clampCosine(value: number): number {
  return Math.min(1, Math.max(-1, value))
}
