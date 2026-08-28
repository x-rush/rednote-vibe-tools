import { describe, expect, it } from 'vitest'
import { eventLog, testContent } from '../tests/fixtures'
import { createViewModel } from './view-model'

describe('app result view model', () => {
  it('maps a truthful archive to content-owned labels and environment art direction', () => {
    const content = testContent()
    const log = eventLog([
      { type: 'mutation-selected', entityId: 'player', organId: 'organelle-jet-vacuole', action: 'install', atMs: 2000 },
      { type: 'player-died', cause: 'engulfed', atMs: 9000 },
    ])
    log[1]!.snapshot = {
      runSeed: 727,
      elapsedMs: 9000,
      environmentId: 'env-clear-drop',
      biomass: 188,
      peakBiomass: 188,
      organelleIds: ['organelle-jet-vacuole'],
      morphology: {
        bodyCount: 1,
        totalMass: 188,
        radius: 14,
        stability: 97,
        organelles: [{ id: 'organelle-jet-vacuole', stage: 'installed', anchor: 'rear' }],
      },
    }
    const model = createViewModel({
      screen: 'result',
      seed: 727,
      originId: 'origin-primal-cell',
      eventLog: log,
      hud: {
        membrane: 0,
        energy: 0,
        stability: 97,
        biomass: 188,
        peakBiomass: 188,
        evolutionThreshold: 240,
        elapsedMs: 9000,
        environmentId: 'env-clear-drop',
        paused: true,
      },
    }, content)

    expect(model.archive).toMatchObject({
      environmentName: '清水滴',
      palette: content.environments[0].visualPalette,
      keyOrgans: ['喷射泡'],
      restartLabel: '再次孵化',
      maxBiomass: 188,
      visualOrganelles: [expect.objectContaining({ name: '喷射泡', anchor: 'rear' })],
    })
    expect(model.archive?.deathText).toBe('轮廓在更大的膜内消失')
  })

  it('uses the selected farthest route palette instead of the opening-water fallback', () => {
    const content = testContent()
    const model = createViewModel({
      screen: 'result',
      eventLog: eventLog([
        { type: 'route-selected', environmentId: 'env-acid-vesicle', atMs: 4000 },
        { type: 'player-died', cause: 'acid', atMs: 8000 },
      ]),
    }, content).archive!

    expect(model.environmentName).toBe('酸性囊泡')
    expect(model.palette).toEqual(content.environments.find((item) => item.id === 'env-acid-vesicle')?.visualPalette)
  })
})
