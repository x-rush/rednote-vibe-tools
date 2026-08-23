import { describe, expect, it } from 'vitest'
import { unlockArtifact } from './collection.ts'

describe('collection unlocks', () => {
  it('is idempotent and only upgrades the best stars', () => {
    const first = unlockArtifact([], 'artifact-test', 2, '2026-08-24T00:00:00.000Z')
    const duplicate = unlockArtifact(first, 'artifact-test', 1, '2026-08-25T00:00:00.000Z')
    const upgraded = unlockArtifact(duplicate, 'artifact-test', 3, '2026-08-26T00:00:00.000Z')
    expect(duplicate).toEqual(first)
    expect(upgraded).toEqual([{ artifactId: 'artifact-test', bestStars: 3, unlockedAt: '2026-08-24T00:00:00.000Z' }])
  })
})
