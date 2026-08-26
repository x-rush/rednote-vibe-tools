import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { parseContent } from '../content/validate'
import {
  buildReplayLayers,
  buildReplayResultV2,
  filterScenarioCatalog,
  resolveScenario,
  type ReplayDraftV2,
} from './replay'

const content = parseContent(rawContent)

function draftFor(scenarioId = 'friend-late'): ReplayDraftV2 {
  const scenario = content.content.scenarios.find((item) => item.scenarioId === scenarioId)!
  return {
    scenarioId,
    relationshipType: scenario.relationshipType,
    communicationGoal: scenario.communicationGoalIds[0],
    conflictLevel: scenario.conflictLevel,
    factOptionIds: [scenario.replay.factOptions[0]!.id],
    feelingIds: [scenario.emotionIds[0]!],
    feelingIntensity: 'clear',
    inferenceExpressionIds: [scenario.replay.inferenceExpressionIds[0]!],
    needIds: [scenario.needIds[0]!],
    requestOptionId: scenario.replay.requestOptions[0]!.id,
    selectedTone: 'direct',
    practiceOptionId: scenario.replay.practiceOptions[0]!.id,
    practiceReplyId: scenario.replay.practiceOptions[0]!.replyOptions[0]!.id,
    limitedEdits: {},
  }
}

describe('V2 replay domain', () => {
  it('filters the catalog by relationship and communication goal', () => {
    const matches = filterScenarioCatalog(content.content.scenarios, {
      relationshipType: 'friend',
      communicationGoal: 'coordinate',
    })

    expect(matches.length).toBeGreaterThan(0)
    expect(matches.every((scenario) => scenario.relationshipType === 'friend')).toBe(true)
    expect(matches.every((scenario) => scenario.communicationGoalIds.includes('coordinate'))).toBe(true)
    expect(matches.map(({ scenarioId }) => scenarioId)).toEqual([...matches.map(({ scenarioId }) => scenarioId)].sort())
  })

  it('keeps an explicitly selected ordinary scenario', () => {
    expect(resolveScenario(draftFor('friend-late'), content).scenarioId).toBe('friend-late')
  })

  it('lets a safety selection override an explicitly selected ordinary scenario', () => {
    const draft = { ...draftFor('friend-late'), conflictLevel: 'safety' as const }

    expect(resolveScenario(draft, content).safetyLevel).toBe('safety')
  })

  it('resolves all five layers to user-visible content', () => {
    const draft = draftFor()
    const layers = buildReplayLayers(draft, content)

    expect(layers.facts[0]?.label).toBe('约定 15:00 见面，对方 15:35 到达，中间没有发来改时间的消息。')
    expect(layers.feelings[0]?.label).toBe('担心')
    expect(layers.inferences[0]?.label).not.toBe('')
    expect(layers.needs[0]?.label).toBe('可靠')
    expect(layers.request?.structure.when).toBe('下一次出现相似情况时')
  })

  it('builds a result from selected layers and rehearsal choices', () => {
    const result = buildReplayResultV2(draftFor(), content)

    expect(result.scenarioId).toBe('friend-late')
    expect(result.layers.facts).toHaveLength(1)
    expect(result.layers.feelings).toEqual(['担心'])
    expect(result.layers.inferences).toEqual(['你根本不尊重我的时间，以后别约了。'])
    expect(result.selectedTone).toBe('direct')
    expect(result.practice?.reply).not.toBe('')
    expect(result.safetyNotice).toBeUndefined()
  })

  it('omits ordinary rehearsal when safety takes priority', () => {
    const result = buildReplayResultV2({ ...draftFor(), conflictLevel: 'safety' }, content)

    expect(result.safetyNotice).toBeDefined()
    expect(result.practice).toBeUndefined()
  })
})
