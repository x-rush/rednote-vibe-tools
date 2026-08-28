import { describe, expect, it } from 'vitest'
import * as renderer from './renderer'

describe('world-space camera feedback', () => {
  it('keeps a moving player off exact screen center while the camera catches up', () => {
    expect('createCameraTracker' in renderer).toBe(true)
    if (!('createCameraTracker' in renderer)) return
    const createCameraTracker = renderer.createCameraTracker as () => {
      update(player: { position: { x: number; y: number }; velocity: { x: number; y: number } }, elapsedMs: number): { x: number; y: number }
    }
    const tracker = createCameraTracker()

    expect(tracker.update({ position: { x: 100, y: 300 }, velocity: { x: 0, y: 0 } }, 0)).toEqual({ x: 100, y: 300 })
    const movingCamera = tracker.update({ position: { x: 110, y: 300 }, velocity: { x: 50, y: 0 } }, 16)

    expect(movingCamera.x).toBeGreaterThan(100)
    expect(movingCamera.x).toBeLessThan(110)
  })

  it('anchors parallax texture tiles to world movement instead of the viewport', () => {
    expect('worldTextureOffset' in renderer).toBe(true)
    if (!('worldTextureOffset' in renderer)) return
    const worldTextureOffset = renderer.worldTextureOffset as (camera: { x: number; y: number }, tile: { width: number; height: number }, parallax: number) => { x: number; y: number }

    expect(worldTextureOffset({ x: 0, y: 0 }, { width: 640, height: 360 }, 0.24)).toEqual({ x: 0, y: 0 })
    expect(worldTextureOffset({ x: 100, y: 50 }, { width: 640, height: 360 }, 0.24)).toEqual({ x: -24, y: -12 })
  })

  it('snaps to a player teleported during a region transition', () => {
    const tracker = renderer.createCameraTracker()
    tracker.update({ position: { x: 300, y: 100 }, velocity: { x: 20, y: 0 } }, 1000)

    expect(tracker.update({ position: { x: 300, y: 1000 }, velocity: { x: 0, y: 0 } }, 1016)).toEqual({ x: 300, y: 1000 })
  })

  it('smooths the abrupt radius change caused by splitting and fusion', () => {
    expect('createZoomTracker' in renderer).toBe(true)
    if (!('createZoomTracker' in renderer)) return
    const tracker = renderer.createZoomTracker()
    const whole = tracker.update(18, 0)
    const split = tracker.update(12, 16)

    expect(whole).toBeCloseTo(42 / 18)
    expect(split).toBeGreaterThan(whole)
    expect(split).toBeLessThan(3.4)
  })

  it('projects the finite ecology boundary into screen space', () => {
    expect('worldBoundaryScreenRect' in renderer).toBe(true)
    if (!('worldBoundaryScreenRect' in renderer)) return

    expect(renderer.worldBoundaryScreenRect(
      { x: 12, y: 550 },
      { width: 640, height: 1100 },
      { width: 390, height: 844 },
      2,
    )).toEqual({ x: 171, y: -678, width: 1280, height: 2200 })
  })

  it('turns split feedback into a static local accent when motion is reduced', () => {
    expect(renderer.swarmTransitionPresentation(300, false)).toMatchObject({ radiusScale: 1.75, textOffset: 4 })
    expect(renderer.swarmTransitionPresentation(300, true)).toEqual({ radiusScale: 1.2, textOffset: 0, alpha: 0.72 })
  })

  it('disables expanding food bloom when motion is reduced', () => {
    expect(renderer.foodBloomPresentation(425, false)?.radiusScale).toBeCloseTo(2.4)
    expect(renderer.foodBloomPresentation(425, true)).toEqual({ radiusScale: 1.25, alpha: 0.3 })
  })
})
