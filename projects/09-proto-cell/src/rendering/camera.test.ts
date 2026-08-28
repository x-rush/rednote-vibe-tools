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
})
