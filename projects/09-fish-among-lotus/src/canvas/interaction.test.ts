import { describe, expect, it } from 'vitest'
import { suppressNativeContextMenu } from './interaction.ts'

describe('canvas touch interaction', () => {
  it('cancels the native context menu without changing pointer handling', () => {
    let prevented = false
    let stopped = false

    suppressNativeContextMenu({
      preventDefault: () => { prevented = true },
      stopPropagation: () => { stopped = true },
    })

    expect(prevented).toBe(true)
    expect(stopped).toBe(true)
  })
})
