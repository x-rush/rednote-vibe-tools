import { describe, expect, it } from 'vitest'
import { createEntity } from '../entities/factory'
import * as cell from './cell'

describe('cell visual grammar', () => {
  it('uses each visual recipe palette instead of one palette per role', () => {
    expect('cellVisualProfile' in cell).toBe(true)
    if (!('cellVisualProfile' in cell)) return
    const profileFor = cell.cellVisualProfile as (entity: ReturnType<typeof createEntity>) => {
      palette: { membrane: string; core: string }
      silhouette: string
    }
    const drifter = createEntity({ id: 'creature-drifter', role: 'prey', faction: 'neutral', radius: 9, mass: 81, membrane: 10, energy: 10, maxSpeed: 30, visualRecipeId: 'visual-prey-drifter' }, { id: 'drifter', position: { x: 0, y: 0 } })
    const spark = createEntity({ id: 'creature-spark', role: 'competitor', faction: 'neutral', radius: 9, mass: 81, membrane: 10, energy: 10, maxSpeed: 30, visualRecipeId: 'visual-competitor-spark' }, { id: 'spark', position: { x: 0, y: 0 } })

    expect(profileFor(drifter).palette).toMatchObject({ membrane: '#74f4e8', core: '#458ee8' })
    expect(profileFor(spark).palette).toMatchObject({ membrane: '#ffd37a', core: '#ff7b70' })
    expect(profileFor(drifter).palette).not.toEqual(profileFor(spark).palette)
  })

  it('assigns readable silhouette families to different ecological roles', () => {
    expect('cellVisualProfile' in cell).toBe(true)
    if (!('cellVisualProfile' in cell)) return
    const profileFor = cell.cellVisualProfile as (entity: ReturnType<typeof createEntity>) => { silhouette: string; appendages: string }
    const nutrient = createEntity({ id: 'nutrient', role: 'nutrient', faction: 'neutral', radius: 5, mass: 25, membrane: 1, energy: 1, maxSpeed: 0, visualRecipeId: 'visual-nutrient-clear' }, { id: 'nutrient', position: { x: 0, y: 0 } })
    const scavenger = createEntity({ id: 'scavenger', role: 'scavenger', faction: 'neutral', radius: 12, mass: 144, membrane: 10, energy: 10, maxSpeed: 20, visualRecipeId: 'visual-scavenger-vesicle' }, { id: 'scavenger', position: { x: 0, y: 0 } })
    const hunter = createEntity({ id: 'hunter', role: 'predator', faction: 'hostile', radius: 22, mass: 484, membrane: 30, energy: 30, maxSpeed: 35, visualRecipeId: 'visual-predator-azure-ring' }, { id: 'hunter', position: { x: 0, y: 0 } })

    expect(profileFor(nutrient)).toMatchObject({ silhouette: 'pearl', appendages: 'none' })
    expect(profileFor(scavenger)).toMatchObject({ silhouette: 'vesicle', appendages: 'cilia' })
    expect(profileFor(hunter)).toMatchObject({ silhouette: 'hunter', appendages: 'spines' })
  })

  it('keeps the visible membrane aligned with the engulf collision radius', () => {
    expect('cellBodyPoint' in cell).toBe(true)
    if (!('cellBodyPoint' in cell)) return
    const silhouettes = ['amoeba', 'pearl', 'swimmer', 'spark', 'vesicle', 'hunter', 'boss'] as const

    for (const silhouette of silhouettes) {
      for (let index = 0; index < 72; index += 1) {
        const point = cell.cellBodyPoint(silhouette, index / 72 * Math.PI * 2, 1800, 'shape-test')
        expect(Math.hypot(point.x, point.y)).toBeGreaterThanOrEqual(0.9)
        expect(Math.hypot(point.x, point.y)).toBeLessThanOrEqual(1.02)
      }
    }
  })

  it('ignores malformed recipe collections without throwing during module load', () => {
    expect('buildVisualRecipeMap' in cell).toBe(true)
    if (!('buildVisualRecipeMap' in cell)) return

    expect(cell.buildVisualRecipeMap(undefined).size).toBe(0)
    expect(cell.buildVisualRecipeMap([{ id: 'broken', palette: null }]).size).toBe(0)
  })

  it('uses a thick arcade membrane and three discrete body tones', () => {
    expect(cell.cellStrokeWidth(10)).toBe(2.5)
    expect(cell.cellStrokeWidth(40)).toBeCloseTo(4.4)
    expect(new Set(cell.cellToneBands({
      membrane: '#74f4e8',
      cytoplasm: '#246879',
      core: '#458ee8',
      organ: '#ffffff',
      glow: '#74f4e8',
    })).size).toBe(3)
  })

  it('reserves per-cell blur for explicit high quality mode', () => {
    expect(cell.cellShadowFilter('high')).toBe('blur(3px)')
    expect(cell.cellShadowFilter('balanced')).toBe('none')
    expect(cell.cellShadowFilter('low')).toBe('none')
    expect(cell.cellShadowBlur('balanced', 'core')).toBe(0)
    expect(cell.cellShadowBlur('high', 'membrane', true)).toBe(16)
    expect(cell.cellShadowBlur('high', 'core')).toBe(12)
  })
})
