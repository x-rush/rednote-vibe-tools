import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { hasArtifactExperienceV2 } from '../content/types.ts'
import { parseContent } from '../content/validate.ts'
import { createQuizQuestion } from '../game/quiz.ts'
import { buildObservationViewModel } from './experience-view-model.ts'

const content = parseContent(rawContent)
const artifact = content.content.artifacts.find(({ id }) => id === 'artifact-zenghouyi-bells')
if (!artifact || !hasArtifactExperienceV2(artifact)) throw new Error('missing golden artifact')
const question = createQuizQuestion(artifact, content.content.distractorCandidates, 'view-model-test')
if ('code' in question) throw new Error(question.message)
const instructions = { enhanced: '触碰光点，观察旧物局部', legacy: '依次拆开线索印' }

describe('experience view model', () => {
  it('builds the golden observation without leaking the artifact name', () => {
    const model = buildObservationViewModel(artifact, question, [], instructions)
    expect(model.kind).toBe('enhanced')
    expect(model.imageAlt).toBe('当前藏品的局部观察线索，不包含答案文字')
    expect(model.clueSeals.map(({ label }) => label)).toEqual(['看形', '辨材', '问来历'])
    expect(JSON.stringify(model)).not.toContain(artifact.name)
  })

  it('adapts legacy clues into ordered seals without inventing hotspots', () => {
    const legacy = content.content.artifacts.find(({ id }) => id === 'artifact-zenghouyi-zunpan')
    if (!legacy) throw new Error('missing legacy artifact')
    const legacyQuestion = createQuizQuestion(legacy, content.content.distractorCandidates, 'legacy-model-test')
    if ('code' in legacyQuestion) throw new Error(legacyQuestion.message)
    const model = buildObservationViewModel(legacy, legacyQuestion, [legacyQuestion.clues[0].id], instructions)
    expect(model.kind).toBe('legacy')
    expect(model.spots).toEqual([])
    expect(model.clueSeals[0]).toMatchObject({ opened: true, label: '线索一' })
  })

  it('makes whichever clue is opened first free', () => {
    const unopened = buildObservationViewModel(artifact, question, [], instructions)
    expect(unopened.clueSeals.every(({ costsStar, starsAfterOpen }) => !costsStar && starsAfterOpen === 3)).toBe(true)
    const afterThird = buildObservationViewModel(artifact, question, [artifact.experienceV2.clueCards[2].id], instructions)
    expect(afterThird.clueSeals[0]).toMatchObject({ costsStar: true, starsAfterOpen: 2 })
  })
})
