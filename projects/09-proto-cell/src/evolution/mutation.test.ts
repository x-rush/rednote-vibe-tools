import { describe, expect, it } from 'vitest'
import { mutationContext } from '../tests/fixtures'
import { continueMutationContext, installMutation, offerMutations } from './mutation'

describe('constrained mutation offers', () => {
  it('offers continuation, adaptation, and risk lanes', () => {
    const offer = offerMutations(mutationContext({ organIds: ['organelle-shell-plate'] }))

    expect(offer.map((choice) => choice.lane).sort()).toEqual(['adaptation', 'continuation', 'risk'])
    expect(offer.find((choice) => choice.lane === 'continuation')).toMatchObject({
      organId: 'organelle-shell-plate',
      action: 'mature',
    })
  })

  it('does not offer a mature organ as another numeric stack', () => {
    const offer = offerMutations(mutationContext({
      organIds: ['organelle-shell-plate'],
      matureOrganIds: ['organelle-shell-plate'],
    }))

    expect(offer.some((choice) => choice.organId === 'organelle-shell-plate')).toBe(false)
  })

  it('automatically installs at a legal anchor and previews stability and synergy', () => {
    const context = mutationContext({ organIds: ['organelle-jet-vacuole'] })
    const choice = offerMutations(context).find((item) => item.organId === 'organelle-shell-plate')
    expect(choice).toBeDefined()

    const result = installMutation(context, choice!)

    expect(['membrane', 'left', 'right']).toContain(result.installed.anchor)
    expect(result.stability).toBe(98)
    expect(result.synergyIds).toContain('synergy-ram-jet')
  })

  it('replaces one installed organ instead of exceeding a full body capacity', () => {
    const context = mutationContext({
      organIds: ['organelle-flagellum'],
      matureOrganIds: ['organelle-flagellum'],
      capacity: 1,
    })
    const choice = offerMutations(context).find((item) => item.action === 'replace')
    expect(choice).toBeDefined()

    const result = installMutation(context, choice!)

    expect(result.organelles).toHaveLength(1)
    expect(result.organelles[0]?.id).toBe(choice!.organId)
    expect(result.organelles.some((organ) => organ.id === choice!.replacedOrganId)).toBe(false)
  })

  it('uses a risk expansion to add capacity without replacing an installed organ', () => {
    const context = mutationContext({
      organIds: ['organelle-flagellum', 'organelle-guard-symbiont'],
      matureOrganIds: ['organelle-flagellum', 'organelle-guard-symbiont'],
      capacity: 1,
    })
    const choice = offerMutations(context).find((item) => item.action === 'expand')
    expect(choice).toBeDefined()

    const result = installMutation(context, choice!)

    expect(result.organelles).toHaveLength(3)
    expect(result.capacity).toBe(2)
  })

  it('carries the selected build into the next mutation offer', () => {
    const context = mutationContext()
    const choice = offerMutations(context)[0]!

    const next = continueMutationContext(context, installMutation(context, choice))

    expect(next.organIds).toContain(choice.organId)
    expect(next.installed).toHaveLength(1)
  })

  it('keeps the dedicated symbiont slot available when normal organ capacity is full', () => {
    const context = mutationContext({
      organIds: ['organelle-flagellum'],
      matureOrganIds: ['organelle-flagellum'],
      capacity: 1,
    })
    const guard = offerMutations(context).find((item) => item.organId === 'organelle-guard-symbiont')

    expect(guard).toMatchObject({ action: 'install', replacedOrganId: undefined })
  })

  it('replaces the organ occupying the only compatible anchor', () => {
    const context = mutationContext({
      organIds: ['organelle-jet-vacuole'],
      matureOrganIds: ['organelle-jet-vacuole'],
      installed: [
        { id: 'organelle-jet-vacuole', stage: 'mature', anchor: 'rear' },
      ],
      capacity: 6,
    })
    const flagellum = offerMutations(context).find((item) => item.organId === 'organelle-flagellum')

    expect(flagellum).toMatchObject({
      action: 'replace',
      replacedOrganId: 'organelle-jet-vacuole',
    })
    expect(installMutation(context, flagellum!).installed.anchor).toBe('rear')
  })

  it('gives a mature guard two consumable interception charges', () => {
    const context = mutationContext({ organIds: ['organelle-guard-symbiont'] })
    const guard = offerMutations(context).find((choice) => choice.organId === 'organelle-guard-symbiont')

    expect(guard?.action).toBe('mature')
    expect(installMutation(context, guard!).installed).toMatchObject({ stage: 'mature', charges: 2 })
  })
})
