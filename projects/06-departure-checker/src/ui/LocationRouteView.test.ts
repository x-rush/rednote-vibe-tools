import { describe, expect, it } from 'vitest'
import { handleLocationToggle } from './locationToggle'

type ExpandedStopsUpdater = (previous: Set<string>) => Set<string>

describe('location route toggle handling', () => {
  it('captures the open state before the toggle event expires', () => {
    const event = { currentTarget: { open: true } as { open: boolean } | null }
    let deferredUpdate: ExpandedStopsUpdater | undefined

    handleLocationToggle(
      event as unknown as Parameters<typeof handleLocationToggle>[0],
      'location-charging',
      (update) => {
        if (typeof update === 'function') deferredUpdate = update
      },
    )
    event.currentTarget = null

    expect(deferredUpdate).toBeTypeOf('function')
    expect([...deferredUpdate!(new Set())]).toEqual(['location-charging'])
  })
})
