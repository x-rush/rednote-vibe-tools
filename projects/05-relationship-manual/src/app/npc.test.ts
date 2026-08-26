import { describe, expect, it } from 'vitest'
import { getValidatedContent } from '../content/validate'
import { getNpcAsset, selectNpcCue } from './npc'

const content = getValidatedContent()

describe('Xiaoman presentation model', () => {
  it('selects a chapter cue by stable category', () => {
    expect(selectNpcCue(content, { trigger: 'chapter-intro', category: 'boundary' })).toMatchObject({
      pose: 'reminder', trigger: 'chapter-intro', category: 'boundary',
    })
  })

  it('returns null instead of inventing dialogue for an unknown conflict', () => {
    expect(selectNpcCue(content, { trigger: 'conflict', conflictRuleId: 'missing' })).toBeNull()
  })

  it('maps every pose to a local guide asset', () => {
    expect((['daily', 'listening', 'reminder'] as const).map(getNpcAsset)).toEqual([
      './assets/guide/xiaoman-daily-v2.webp',
      './assets/guide/xiaoman-listening-v2.webp',
      './assets/guide/xiaoman-reminder-v2.webp',
    ])
  })
})
