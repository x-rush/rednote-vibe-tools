import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { hasArtifactExperienceV2 } from '../content/types.ts'
import { parseContent } from '../content/validate.ts'
import { getSetProgress, gradeMemoryChallenge, hitObservationSpot, openClueCard } from './experience.ts'

const content = parseContent(rawContent)
const goldenArtifact = content.content.artifacts.find(({ id }) => id === 'artifact-zenghouyi-bells')
if (!goldenArtifact || !hasArtifactExperienceV2(goldenArtifact)) throw new Error('missing golden artifact')
const experience = goldenArtifact.experienceV2

describe('V2 artifact experience rules', () => {
  it('finds an unseen hotspot and ignores one that was already recorded', () => {
    expect(hitObservationSpot(experience.observationSpots, { x: 0.48, y: 0.49 }, [])?.id).toBe('spot-bells-corner')
    expect(hitObservationSpot(experience.observationSpots, { x: 0.48, y: 0.49 }, ['spot-bells-corner'])).toBeNull()
    expect(hitObservationSpot(experience.observationSpots, { x: 0.05, y: 0.05 }, [])).toBeNull()
  })

  it('keeps the first clue free, charges later clues, and ignores duplicates', () => {
    expect(openClueCard([], 'clue-bells-shape')).toEqual({ openedIds: ['clue-bells-shape'], stars: 3 })
    expect(openClueCard(['clue-bells-shape'], 'clue-bells-material')).toEqual({
      openedIds: ['clue-bells-shape', 'clue-bells-material'],
      stars: 2,
    })
    expect(openClueCard(['clue-bells-shape', 'clue-bells-material'], 'clue-bells-provenance').stars).toBe(1)
    expect(openClueCard(['clue-bells-shape'], 'clue-bells-shape')).toEqual({ openedIds: ['clue-bells-shape'], stars: 3 })
  })

  it('grades the memory challenge without changing stars or content', () => {
    expect(gradeMemoryChallenge(experience.memoryChallenge, experience.memoryChallenge.answerId)).toEqual({
      correct: true,
      explanation: experience.memoryChallenge.explanation,
    })
    expect(gradeMemoryChallenge(experience.memoryChallenge, 'memory-bells-a')).toEqual({
      correct: false,
      explanation: experience.memoryChallenge.explanation,
    })
  })

  it('completes a set only after all four distinct artifacts are collected', () => {
    const setArtifacts = content.content.artifacts.filter(({ setId }) => setId === 'chu-sound')
    const collection = setArtifacts.map((artifact, index) => ({
      artifactId: artifact.id,
      bestStars: 3 as const,
      unlockedAt: `2026-08-25T00:0${index}:00.000Z`,
    }))

    expect(getSetProgress(content.content.artifacts, collection.slice(0, 3), 'chu-sound')).toEqual({ collected: 3, total: 4, complete: false })
    expect(getSetProgress(content.content.artifacts, [...collection, collection[0]], 'chu-sound')).toEqual({ collected: 4, total: 4, complete: true })
  })
})
