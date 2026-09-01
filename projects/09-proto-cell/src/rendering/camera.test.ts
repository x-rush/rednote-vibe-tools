import { describe, expect, it } from 'vitest'
import { createCameraTracker } from './camera'
import { backdropTileOrigins, edgeWarningPosition, isFiniteEntityGeometry, materializationPresentation, renderPixelRatio, swarmTransitionPresentation, worldBoundaryScreenRect, worldTextureOffset } from './renderer'

describe('stage camera', () => {
  it('uses a lower player anchor and looks ahead along velocity', () => {
    const tracker = createCameraTracker()
    const viewport = { width: 390, height: 844 }
    tracker.update(
      { position: { x: 100, y: 300 }, velocity: { x: 0, y: 0 }, radius: 18 },
      viewport,
      'microbe',
      0,
    )
    const frame = tracker.update(
      { position: { x: 110, y: 300 }, velocity: { x: 100, y: 0 }, radius: 18 },
      viewport,
      'microbe',
      16,
    )

    expect(frame.center.x).toBeGreaterThan(100)
    expect(frame.anchor).toEqual({ x: 195, y: 489.52 })
  })

  it('changes zoom only when body stage changes', () => {
    const tracker = createCameraTracker()
    const viewport = { width: 390, height: 844 }
    const small = tracker.update(
      { position: { x: 100, y: 300 }, velocity: { x: 0, y: 0 }, radius: 18 },
      viewport,
      'microbe',
      0,
    )
    const largerRadius = tracker.update(
      { position: { x: 100, y: 300 }, velocity: { x: 0, y: 0 }, radius: 34 },
      viewport,
      'microbe',
      16,
    )
    const evolved = tracker.update(
      { position: { x: 100, y: 300 }, velocity: { x: 0, y: 0 }, radius: 34 },
      viewport,
      'hunter',
      32,
    )

    expect(largerRadius.zoom).toBe(small.zoom)
    expect(evolved.zoom).toBeLessThan(small.zoom)
  })

  it('snaps to a player teleported during a region transition', () => {
    const tracker = createCameraTracker()
    const viewport = { width: 390, height: 844 }
    tracker.update(
      { position: { x: 300, y: 100 }, velocity: { x: 20, y: 0 }, radius: 18 },
      viewport,
      'microbe',
      1000,
    )

    const frame = tracker.update(
      { position: { x: 300, y: 1000 }, velocity: { x: 0, y: 0 }, radius: 18 },
      viewport,
      'hunter',
      1016,
    )
    expect(frame.center).toEqual({ x: 300, y: 1000 })
  })
})

describe('world-space camera feedback', () => {
  it('anchors parallax texture tiles to world movement instead of the viewport', () => {
    expect(worldTextureOffset({ x: 0, y: 0 }, { width: 640, height: 360 }, 0.24)).toEqual({ x: 0, y: 0 })
    expect(worldTextureOffset({ x: 100, y: 50 }, { width: 640, height: 360 }, 0.24)).toEqual({ x: -24, y: -12 })
  })

  it('does not submit backdrop tiles that sit entirely outside the canvas', () => {
    const origins = backdropTileOrigins(
      { width: 390, height: 844 },
      { width: 904, height: 904 },
      { x: 100, y: 150 },
    )

    expect(origins).toHaveLength(4)
    expect(origins.every(({ x, y }) => x < 390 && y < 844 && x + 904 > 0 && y + 904 > 0)).toBe(true)
  })

  it('uses a mobile performance ratio for the default balanced canvas', () => {
    expect(renderPixelRatio('balanced', 1)).toBe(0.8)
    expect(renderPixelRatio('balanced', 2)).toBe(1.25)
    expect(renderPixelRatio('high', 2.5)).toBe(2)
    expect(renderPixelRatio('low', 1)).toBe(0.7)
  })

  it('projects the finite ecology boundary from the lower player anchor', () => {
    expect(worldBoundaryScreenRect(
      { center: { x: 12, y: 550 }, anchor: { x: 195, y: 489.52 }, zoom: 2 },
      { width: 640, height: 1100 },
    )).toEqual({ x: 171, y: -610.48, width: 1280, height: 2200 })
  })

  it('turns split feedback into a static local accent when motion is reduced', () => {
    expect(swarmTransitionPresentation(300, false)).toMatchObject({ radiusScale: 1.75, textOffset: 4 })
    expect(swarmTransitionPresentation(300, true)).toEqual({ radiusScale: 1.2, textOffset: 0, alpha: 0.72 })
  })

  it('presents a materializing entity as a growing readable silhouette', () => {
    expect(materializationPresentation(600, 1200, false)).toMatchObject({ radiusScale: 0.86, alpha: 0.62 })
    expect(materializationPresentation(600, 1200, true)).toEqual({ radiusScale: 0.88, alpha: 0.72, ringAlpha: 0.5 })
    expect(materializationPresentation(1200, 1200, false)).toBeUndefined()
  })

  it('skips materialization when an entity has no finite presentation interval', () => {
    expect(materializationPresentation(Number.POSITIVE_INFINITY, Number.NaN, false)).toBeUndefined()
    expect(materializationPresentation(100, Number.POSITIVE_INFINITY, false)).toBeUndefined()
  })

  it('rejects an entity with a non-finite position or radius before canvas drawing', () => {
    expect(isFiniteEntityGeometry({ position: { x: 12, y: 24 }, velocity: { x: 0, y: 0 }, body: { radius: 8 } })).toBe(true)
    expect(isFiniteEntityGeometry({ position: { x: Number.NaN, y: 24 }, velocity: { x: 0, y: 0 }, body: { radius: 8 } })).toBe(false)
    expect(isFiniteEntityGeometry({ position: { x: 12, y: 24 }, velocity: { x: 0, y: 0 }, body: { radius: Number.POSITIVE_INFINITY } })).toBe(false)
    expect(isFiniteEntityGeometry({ position: { x: 12, y: 24 }, velocity: { x: 0, y: Number.NaN }, body: { radius: 8 } })).toBe(false)
  })

  it('projects offscreen materializing threats onto a safe edge warning', () => {
    expect(edgeWarningPosition({ x: -100, y: 400 }, { width: 390, height: 844 }, 24)).toMatchObject({ x: 24 })
    expect(edgeWarningPosition({ x: -100, y: 400 }, { width: 390, height: 844 }, 24)?.y).toBeCloseTo(409.25, 1)
    expect(edgeWarningPosition({ x: 100, y: 400 }, { width: 390, height: 844 }, 24)).toBeUndefined()
  })
})
