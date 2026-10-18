import { describe, expect, it, vi } from 'vitest'
import { createEntity } from '../entities/factory'
import * as cell from './cell'
import { membraneSilhouette } from '../domain/membrane'
import { membranePose } from '../domain/membrane'

describe('late ecology anatomy', () => {
  const make = (id: string, role: 'competitor' | 'predator' | 'prey' | 'boss') => createEntity({ id, role, faction: role === 'prey' || role === 'competitor' ? 'neutral' : 'hostile', radius: 45, mass: 2025, membrane: 100, energy: 100, maxSpeed: 40, visualRecipeId: `visual-${id}` }, { id: 'late-specimen', position: { x: 0, y: 0 } })

  it('keeps retained membrane gradient coordinates in the same physical space as the fallback', () => {
    const gradients: number[][] = []
    const context = new Proxy({}, { get: (_target, name) => name === 'createRadialGradient' ? (...args: number[]) => { gradients.push(args); return { addColorStop() {} } } : () => {}, set: () => true }) as CanvasRenderingContext2D
    const entity = make('predator-chamber-maw', 'boss')
    const radius = 62, time = 1900, scale = radius * membranePose(entity, time).pulse
    class Path { moveTo() {} lineTo() {} closePath() {} }
    try {
      vi.stubGlobal('Path2D', undefined)
      cell.drawCell(context, entity, 0, 0, radius, time)
      const original = gradients[0]!
      gradients.length = 0
      vi.stubGlobal('Path2D', Path)
      cell.drawCell(context, entity, 0, 0, radius, time)
      gradients[0]!.forEach((coordinate, index) => expect(coordinate * scale).toBeCloseTo(original[index]!, 10))
    } finally { vi.unstubAllGlobals() }
  })

  it('keeps distinct late species identities on the same visible and physical boundary', () => {
    const specimens = [
      [make('creature-thornback-forager', 'competitor'), 'vesicle', 'spines'],
      [make('predator-seam-lurker', 'predator'), 'ciliate', 'flagellum'],
      [make('creature-lantern-siphon', 'prey'), 'swimmer', 'fins'],
      [make('predator-razor-ray', 'predator'), 'spark', 'fins'],
    ] as const
    for (const [entity, silhouette, appendages] of specimens) {
      expect(cell.cellVisualProfile(entity)).toMatchObject({ silhouette, appendages })
      expect(membraneSilhouette(entity, 'form-primal-cell')).toBe(silhouette)
    }
    expect(new Set(specimens.map(([entity]) => cell.cellVisualProfile(entity).palette.membrane)).size).toBe(4)
  })

  it('makes the leviathan recovery core distinct from its closed amber armor', () => {
    const leviathan = make('predator-chamber-maw', 'boss')
    const armored = cell.cellVisualProfile(leviathan)
    leviathan.behaviorState = 'recover'
    const exposed = cell.cellVisualProfile(leviathan)
    expect(armored.structure).toBe('armor')
    expect(exposed.structure).not.toBe('armor')
    expect(exposed.palette.core).not.toBe(armored.palette.core)
    expect(exposed.silhouette).toBe(armored.silhouette)
  })

  it('draws three cellular chambers even at low quality without dropping their nuclei', () => {
    const ellipses: number[][] = []
    const gradient = { addColorStop() {} }
    const context = new Proxy({}, { get: (_target, name) => name === 'createRadialGradient' ? () => gradient : name === 'ellipse' ? (...args: number[]) => ellipses.push(args) : () => {}, set: () => true }) as CanvasRenderingContext2D
    const player = make('player', 'prey')
    player.faction = 'player'
    cell.drawCell(context, player, 0, 0, 40, 0, { quality: 'low', formId: 'form-colony-body' })
    const chambers = ellipses.filter((ellipse) => Math.abs(ellipse[2]! - 40 * 0.32) < 0.01)
    expect(chambers).toHaveLength(3)
    expect(new Set(chambers.map((ellipse) => `${ellipse[0]},${ellipse[1]}`)).size).toBe(3)
    expect(ellipses.filter((ellipse) => ellipse[2]! >= 8 && ellipse[2]! <= 8.8)).toHaveLength(3)
  })

  it('distributes a macro nucleus and separate small nuclei away from the feeding channel', () => {
    const nuclei = cell.corePositions('ciliate', 1)
    expect(nuclei.length).toBeGreaterThanOrEqual(3)
    expect(nuclei.filter((core) => core.radius < 0.16).length).toBeGreaterThanOrEqual(2)
    expect(new Set(nuclei.map((core) => core.y)).size).toBe(nuclei.length)
  })
})

describe('cell visual grammar', () => {
  it('reuses fixed color mixtures while preserving all three tone bands', () => {
    const palette = { membrane: '#1a7b8c', core: '#ce7a31', organ: '#affdef', cytoplasm: '#000000', glow: '#ffffff' }
    const parse = vi.spyOn(Number, 'parseInt')
    try {
      const first = cell.cellToneBands(palette)
      expect(parse.mock.calls.length).toBeGreaterThan(0)
      parse.mockClear()
      expect(cell.cellToneBands(palette)).toEqual(first)
      expect(new Set(first).size).toBe(3)
      expect(parse.mock.calls).toHaveLength(0)
    } finally { parse.mockRestore() }
  })
  it('keeps the hostile status shell steady when flashes are reduced', () => {
    expect(cell.statusShellOpacity(100, true)).toBe(cell.statusShellOpacity(250, true))
    expect(cell.statusShellOpacity(100, false)).not.toBe(cell.statusShellOpacity(250, false))
  })
  it('shares the lineage boundary and inherited anatomy between live cells and previews', () => {
    const make = (family: string) => createEntity({ id: 'player', role: 'player', faction: 'player', radius: 20, mass: 400, membrane: 100, energy: 100, maxSpeed: 0, visualRecipeId: `visual-lineage-${family}` }, { id: 'player', position: { x: 0, y: 0 } })
    expect(cell.cellVisualProfile(make('dart'))).toMatchObject({ silhouette: 'dart-primal', appendages: 'flagellum', structure: 'teardrop' })
    expect(cell.cellVisualProfile(make('bastion'))).toMatchObject({ silhouette: 'bastion-primal', structure: 'armor' })
    expect(cell.cellVisualProfile(make('bloom'))).toMatchObject({ silhouette: 'bloom-primal', structure: 'swarm' })
    expect(cell.playerVisualProfile(make('dart'), 'form-colony-body').silhouette).toBe('dart-colony')
    expect(cell.playerVisualProfile(make('bloom'), 'form-ciliate-composite').silhouette).toBe('bloom-ciliate')
    expect(cell.lineageCorePositions('bloom', 'primal')).toHaveLength(3)
    expect(cell.lineageCorePositions('dart', 'primal')).toHaveLength(1)
    expect(cell.lineageCorePositions('bastion', 'colony')).toHaveLength(3)
  })
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

  it('keeps silhouettes inside the physical radius while preserving directional shapes', () => {
    expect('cellBodyPoint' in cell).toBe(true)
    if (!('cellBodyPoint' in cell)) return
    const silhouettes = ['amoeba', 'pearl', 'swimmer', 'spark', 'vesicle', 'hunter', 'boss', 'colony', 'ciliate'] as const

    for (const silhouette of silhouettes) {
      for (let index = 0; index < 72; index += 1) {
        const point = cell.cellBodyPoint(silhouette, index / 72 * Math.PI * 2, 1800, 'shape-test')
        expect(Math.hypot(point.x, point.y)).toBeGreaterThanOrEqual(0.65)
        expect(Math.hypot(point.x, point.y)).toBeLessThanOrEqual(1.02)
      }
    }
  })

  it('draws distinct long-axis and joined-lobe silhouettes at the same physical size', () => {
    const point = (shape: 'amoeba' | 'colony' | 'ciliate', angle: number) => cell.cellBodyPoint(shape, angle, 0, 'player')
    expect(point('ciliate', 0).x / point('ciliate', Math.PI / 2).y).toBeGreaterThan(1.3)
    expect(Math.hypot(...Object.values(point('colony', 0)))).toBeGreaterThan(Math.hypot(...Object.values(point('colony', Math.PI / 3))))
    expect(cell.corePositions('colony', 1)).toHaveLength(3)
    expect(cell.corePositions('primal', 1)).toHaveLength(1)
    expect(cell.corePositions('ciliate', 1)[0]!.x).toBeLessThan(0)
  })

  it('preserves recognizable predator and warden anatomy after a size reversal', () => {
    const make = (radius: number, role: 'predator' | 'elite') => createEntity({ id: 'enemy', role, faction: 'hostile', radius, mass: radius * radius, membrane: 10, energy: 10, maxSpeed: 20, visualRecipeId: 'visual-predator-azure-ring' }, { id: 'enemy', position: { x: 0, y: 0 } })
    expect(cell.cellVisualProfile(make(40, 'predator'))).toEqual(cell.cellVisualProfile(make(8, 'predator')))
    expect(cell.cellVisualProfile(make(40, 'predator')).structure).toBe('ring')
    expect(cell.cellVisualProfile(make(40, 'elite')).structure).toBe('armor')
    const stalker = make(40, 'predator')
    stalker.definitionId = 'creature-fiber-stalker'
    expect(cell.cellVisualProfile(stalker).silhouette).toBe('ciliate')
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
