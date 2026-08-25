import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { hasArtifactExperienceV2, type StoragePayload } from '../content/types.ts'
import { parseContent } from '../content/validate.ts'
import { createDefaultStoragePayload } from '../storage/storage.ts'
import { appReducer, createInitialState, type AppState } from './game-state.ts'

const content = parseContent(rawContent)
const NOW = '2026-08-25T00:01:00.000Z'

function startWithSeed(seed: string, payload = createDefaultStoragePayload(content.contentVersion, '2026-08-25T00:00:00.000Z')): AppState {
  let state = createInitialState(payload)
  state = appReducer(state, { type: 'showIntro' })
  state = appReducer(state, { type: 'showModeSelect' })
  return appReducer(state, {
    type: 'startRound', seed, artifacts: content.content.artifacts,
    candidates: content.content.distractorCandidates, recentArtifactIds: [],
  })
}

function startedGoldenState(payload?: StoragePayload): AppState {
  for (let index = 0; index < 200; index += 1) {
    const state = startWithSeed(`golden-${index}`, payload)
    if ('questions' in state && state.questions[state.session.index]?.artifactId === 'artifact-zenghouyi-bells') return state
  }
  throw new Error('could not select golden artifact first')
}

function goldenExperience() {
  const artifact = content.content.artifacts.find(({ id }) => id === 'artifact-zenghouyi-bells')
  if (!artifact || !hasArtifactExperienceV2(artifact)) throw new Error('missing golden artifact')
  return artifact.experienceV2
}

function answerCurrent(state: AppState, correct: boolean): AppState {
  if (state.screen !== 'observation' && state.screen !== 'clueSelect') throw new Error('expected open case')
  const question = state.questions[state.session.index]
  const optionId = correct ? question.correctOptionId : question.options.find(option => !option.isCorrect)?.id
  if (!optionId) throw new Error('missing option')
  state = appReducer(state, { type: 'selectOption', optionId })
  return appReducer(state, { type: 'submitAnswer', answeredAt: NOW })
}

describe('application V2 state machine', () => {
  it('moves from landing through intake and mode selection to a five-item observation case', () => {
    const state = startWithSeed('state-test')
    expect(state.screen).toBe('observation')
    if (state.screen !== 'observation') throw new Error('expected observation')
    expect(state.questions).toHaveLength(5)
    expect(state.session.caseProgress?.openedClueIds).toEqual([])
    expect(state.session.caseProgress?.phase).toBe('observation')
  })

  it('runs the golden artifact through observation, story, memory, and archive', () => {
    const experience = goldenExperience()
    let state = startedGoldenState()
    if (state.screen !== 'observation') throw new Error('expected observation')
    state = appReducer(state, { type: 'discoverSpot', spotId: experience.observationSpots[0].id })
    state = appReducer(state, { type: 'openClue', clueId: experience.clueCards[0].id })
    expect(state.screen).toBe('clueSelect')
    if (state.screen !== 'clueSelect') throw new Error('expected clue select')
    expect(state.session.caseProgress?.openedClueIds).toEqual([experience.clueCards[0].id])
    state = answerCurrent(state, true)
    expect(state.screen).toBe('reveal')
    if (state.screen !== 'reveal') throw new Error('expected reveal')
    expect(state.result).toMatchObject({ correct: true, stars: 3, points: 300 })
    expect(state.payload.collection).toHaveLength(1)
    expect(appReducer(state, { type: 'submitAnswer', answeredAt: NOW })).toBe(state)

    state = appReducer(state, { type: 'openStory' })
    expect(state.screen).toBe('story')
    for (const section of experience.story) state = appReducer(state, { type: 'markStorySectionRead', sectionId: section.id })
    state = appReducer(state, { type: 'answerMemory', optionId: experience.memoryChallenge.answerId })
    expect(state.screen).toBe('memory')
    state = appReducer(state, { type: 'archiveArtifact', artifacts: content.content.artifacts, archivedAt: NOW })
    expect(state.screen).toBe('archive')
    expect(state.payload.artifactProgress).toEqual([{
      artifactId: 'artifact-zenghouyi-bells',
      observedSpotIds: [experience.observationSpots[0].id],
      storyReadSections: experience.story.map(({ id }) => id),
      memoryCompleted: true,
    }])
    state = appReducer(state, { type: 'nextQuestion' })
    expect(state.screen).toBe('observation')
  })

  it('routes an incorrect stamp through review before the same full reveal', () => {
    let state = startedGoldenState()
    state = answerCurrent(state, false)
    expect(state.screen).toBe('wrongReview')
    const duplicate = appReducer(state, { type: 'submitAnswer', answeredAt: NOW })
    expect(duplicate).toBe(state)
    state = appReducer(state, { type: 'continueToReveal' })
    expect(state.screen).toBe('reveal')
    if (state.screen !== 'reveal') throw new Error('expected reveal')
    expect(state.result.correct).toBe(false)
    expect(state.payload.collection).toHaveLength(1)
  })

  it('restores the exact story phase from a persisted current session', () => {
    const experience = goldenExperience()
    let state = answerCurrent(startedGoldenState(), true)
    state = appReducer(state, { type: 'openStory' })
    state = appReducer(state, { type: 'markStorySectionRead', sectionId: experience.story[0].id })
    const payload = state.payload

    state = createInitialState(payload)
    state = appReducer(state, { type: 'resumeRound', artifacts: content.content.artifacts, candidates: content.content.distractorCandidates })
    expect(state.screen).toBe('story')
    if (state.screen !== 'story') throw new Error('expected story')
    expect(state.session.caseProgress?.storyReadSections).toEqual([experience.story[0].id])
  })

  it('awards a set seal once when archiving the fourth collected artifact', () => {
    const payload = createDefaultStoragePayload(content.contentVersion, '2026-08-25T00:00:00.000Z')
    payload.collection = content.content.artifacts
      .filter(artifact => artifact.setId === 'chu-sound' && artifact.id !== 'artifact-zenghouyi-bells')
      .map(artifact => ({ artifactId: artifact.id, bestStars: 2, unlockedAt: payload.updatedAt }))
    let state = answerCurrent(startedGoldenState(payload), true)
    state = appReducer(state, { type: 'openStory' })
    for (const section of goldenExperience().story) state = appReducer(state, { type: 'markStorySectionRead', sectionId: section.id })
    state = appReducer(state, { type: 'answerMemory', optionId: goldenExperience().memoryChallenge.answerId })
    state = appReducer(state, { type: 'archiveArtifact', artifacts: content.content.artifacts, archivedAt: NOW })

    expect(state.screen).toBe('setComplete')
    expect(state.payload.setSealIds).toEqual(['chu-sound'])
    expect(appReducer(state, { type: 'archiveArtifact', artifacts: content.content.artifacts, archivedAt: NOW })).toBe(state)
  })

  it('supports collection, detail, exit, replay, error, and recovery states', () => {
    let state = startWithSeed('navigation-test')
    state = appReducer(state, { type: 'exitRound' })
    expect(state.screen).toBe('landing')
    state = appReducer(state, { type: 'openCollection' })
    expect(state.screen).toBe('collection')
    state = appReducer(state, { type: 'openArtifact', artifactId: content.content.artifacts[0].id })
    expect(state.screen).toBe('artifactDetail')
    state = appReducer(state, { type: 'closeDetail' })
    expect(state.screen).toBe('collection')
    state = appReducer(state, { type: 'dataError', message: '坏内容' })
    expect(state.screen).toBe('error')
    state = appReducer(state, { type: 'recover' })
    expect(state.screen).toBe('landing')
    state = appReducer(state, { type: 'replay' })
    expect(state.screen).toBe('modeSelect')
  })
})
