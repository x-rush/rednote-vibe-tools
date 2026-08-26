import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { parseContent } from '../content/validate.ts'
import {
  formatRecentArtifactResponse,
  nextUnreadNarrativeChapter,
  pickGuideLine,
  unlockedNarrativeChapters,
} from './narrative.ts'

const chapters = parseContent(rawContent).content.narrative.chapters

describe('collection narrative logic', () => {
  it('unlocks milestones in order and returns the first unseen non-deferred chapter', () => {
    expect(unlockedNarrativeChapters(chapters, 8).map(({ id }) => id)).toEqual(['act-1', 'act-2', 'act-3'])
    expect(nextUnreadNarrativeChapter(chapters, 8, ['act-1'], ['act-2'])?.id).toBe('act-3')
  })

  it('returns no pending chapter when every unlocked milestone is seen or deferred', () => {
    expect(nextUnreadNarrativeChapter(chapters, 4, ['act-1'], ['act-2'])).toBeNull()
  })

  it('keeps a guide line stable within a round and rotates across seeds', () => {
    const lines = ['甲', '乙', '丙']
    expect(pickGuideLine(lines, 'round-a', 'artifact-a', 'reveal')).toBe(
      pickGuideLine(lines, 'round-a', 'artifact-a', 'reveal'),
    )
    expect(new Set(['round-a', 'round-b', 'round-c', 'round-d'].map(seed =>
      pickGuideLine(lines, seed, 'artifact-a', 'reveal'))).size).toBeGreaterThan(1)
  })

  it('returns an empty guide line for an empty content array', () => {
    expect(pickGuideLine([], 'round-a', 'artifact-a', 'archive')).toBe('')
  })

  it('formats the recent-artifact response from content-owned placeholders', () => {
    expect(formatRecentArtifactResponse(
      '你记住了「{artifact}」的{evidence}。',
      '贾湖骨笛',
      '成列音孔',
    )).toBe('你记住了「贾湖骨笛」的成列音孔。')
  })
})
