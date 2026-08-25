import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { isCompleteArtifact } from '../content/types.ts'
import { parseContent } from '../content/validate.ts'
import { createQuizQuestion } from '../game/quiz.ts'
import { filterPlayableArtifacts } from './artifact-assets.ts'
import { buildObservationViewModel } from './experience-view-model.ts'

const content = parseContent(rawContent)
const artifact = content.content.artifacts.find(({ id }) => id === 'artifact-zenghouyi-bells')
if (!artifact || !isCompleteArtifact(artifact)) throw new Error('missing golden artifact')
const question = createQuizQuestion(artifact, content.content.distractorCandidates, 'view-model-test')
if ('code' in question) throw new Error(question.message)
const instruction = '轻触图上的编号，观察旧物局部'

describe('experience view model', () => {
  it('builds the golden observation without leaking the artifact name', () => {
    const model = buildObservationViewModel(artifact, [], instruction)
    expect(model).not.toHaveProperty('kind')
    expect(model.imageAlt).toBe('当前藏品的局部观察线索，不包含答案文字')
    expect(model.clueSeals.map(({ label }) => label)).toEqual(['看形', '辨材', '问来历'])
    expect(JSON.stringify(model)).not.toContain(artifact.name)
  })

  it('builds the same three-spot complete model for every playable artifact', () => {
    for (const item of filterPlayableArtifacts(content.content.artifacts)) {
      const itemQuestion = createQuizQuestion(item, content.content.distractorCandidates, `complete-model-${item.id}`)
      if ('code' in itemQuestion) throw new Error(itemQuestion.message)
      const model = buildObservationViewModel(item, [], instruction)
      expect(model.spots, item.id).toHaveLength(3)
      expect(model.clueSeals, item.id).toHaveLength(3)
      expect(model).not.toHaveProperty('kind')
    }
  })

  it('makes whichever clue is opened first free', () => {
    const unopened = buildObservationViewModel(artifact, [], instruction)
    expect(unopened.clueSeals.every(({ costsStar, starsAfterOpen }) => !costsStar && starsAfterOpen === 3)).toBe(true)
    const afterThird = buildObservationViewModel(artifact, [artifact.experienceV2.clueCards[2].id], instruction)
    expect(afterThird.clueSeals[0]).toMatchObject({ costsStar: true, starsAfterOpen: 2 })
  })
})
