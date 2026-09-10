import { describe, expect, it } from 'vitest'
import { validateBackgroundFile } from './background.ts'

describe('custom poster background', () => {
  it('rejects files that are not images', () => {
    expect(validateBackgroundFile({ type: 'text/plain', size: 1200 })).toBe('type')
  })

  it('rejects images larger than the in-memory safety limit', () => {
    expect(validateBackgroundFile({ type: 'image/jpeg', size: 16 * 1024 * 1024 })).toBe('size')
  })
})
