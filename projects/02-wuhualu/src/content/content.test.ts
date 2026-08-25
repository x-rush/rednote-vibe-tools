import { describe, expect, it } from 'vitest'
import content from './content.json'
import { hasArtifactExperienceV2 } from './types.ts'
import { parseContent, validateContent } from './validate.ts'

describe('production content package', () => {
  it('contains exactly 20 uniquely identified artifacts', () => {
    expect(content.content.artifacts).toHaveLength(20)
    expect(new Set(content.content.artifacts.map(({ id }) => id)).size).toBe(20)
  })

  it('passes runtime production validation', () => {
    expect(validateContent(content).issues).toEqual([])
  })

  it('gives every artifact three ordered text clues and planned fallback assets', () => {
    for (const artifact of content.content.artifacts) {
      expect(artifact.clues.map(({ level }) => level)).toEqual([1, 2, 3])
      expect(artifact.clues.every(({ text }) => text.trim().length > 0)).toBe(true)
      expect(artifact.assetRefs.fallbackAssetId).toMatch(/^asset-[a-z0-9-]+$/)
      expect(artifact.unlockCopy.trim().length).toBeGreaterThan(0)
    }
  })

  it('groups all artifacts into five four-item sets with unique timeline positions', () => {
    const parsed = parseContent(content)
    const grouped = new Map(parsed.content.sets.map(set => [set.id, 0]))
    for (const artifact of parsed.content.artifacts) {
      grouped.set(artifact.setId, (grouped.get(artifact.setId) ?? 0) + 1)
    }

    expect(parsed.content.sets).toHaveLength(5)
    expect([...grouped.values()]).toEqual([4, 4, 4, 4, 4])
    expect(new Set(parsed.content.artifacts.map(({ timelineOrder }) => timelineOrder)).size).toBe(20)
  })

  it('accepts exactly one complete V2 golden experience without inventing the other nineteen', () => {
    const parsed = parseContent(content)
    const enhanced = parsed.content.artifacts.filter(hasArtifactExperienceV2)

    expect(enhanced.map(({ id }) => id)).toEqual(['artifact-zenghouyi-bells'])
    expect(enhanced[0].experienceV2.story).toHaveLength(5)
    expect(enhanced[0].experienceV2.observationSpots).toHaveLength(3)
    expect(new Set(enhanced[0].experienceV2.observationSpots.map(({ assetRole }) => assetRole))).toEqual(new Set(['observation']))
    expect(enhanced[0].experienceV2.clueCards.map(({ label }) => label)).toEqual(['看形', '辨材', '问来历'])
  })

  it('rejects a partial V2 experience block', () => {
    const broken = structuredClone(content) as unknown as { content: { artifacts: Array<Record<string, unknown>> } }
    broken.content.artifacts[0].experienceV2 = { storyHook: '只有标题的半成品' }

    expect(validateContent(broken).issues.some(({ path }) => path.includes('experienceV2'))).toBe(true)
  })

  it('rejects duplicate V2 clue-card IDs', () => {
    const broken = structuredClone(content)
    const enhanced = broken.content.artifacts.find(artifact => artifact.experienceV2)
    if (!enhanced?.experienceV2) throw new Error('missing golden experience')
    enhanced.experienceV2.clueCards[1].id = enhanced.experienceV2.clueCards[0].id
    expect(validateContent(broken).issues.some(({ message }) => message === '线索印 ID 重复')).toBe(true)
  })

  it('reports invalid references and unsafe asset IDs with JSON paths', () => {
    const invalid = structuredClone(content)
    invalid.content.artifacts[0].sourceIds = ['source-missing']
    invalid.content.artifacts[0].assetRefs.fullAssetId = 'https://example.com/item.jpg'
    invalid.content.assetManifest.pathPattern = '/absolute/assets/item.webp'
    Object.assign(invalid, { unexpectedRoot: true })

    const paths = validateContent(invalid).issues.map(({ path }) => path)
    expect(paths).toContain('$.content.artifacts[0].sourceIds[0]')
    expect(paths).toContain('$.content.artifacts[0].assetRefs.fullAssetId')
    expect(paths).toContain('$.content.assetManifest.pathPattern')
    expect(paths).toContain('$.unexpectedRoot')
  })

  it('keeps all semantic page copy in the content package', () => {
    const required = [
      'backAction', 'exitAction', 'collectionAction', 'retryAction', 'replayAction',
      'closeAction', 'factsTitle', 'cluesTitle', 'optionsTitle', 'placeholderText',
      'lockedText', 'scoreLabel', 'bestScoreLabel', 'progressLabel', 'sourceStatusTitle',
      'storageCorruptMessage', 'storageVersionMessage', 'storageInvalidMessage', 'contentMissingMessage',
      'verifiedLabel', 'pendingLabel', 'collectorPerfect', 'collectorHigh', 'collectorMid', 'collectorLow',
      'guideHomeLine', 'guideTaskLine', 'guideLegacyLine', 'guideIntroLine', 'guideHelpBody',
      'guideName', 'guideRole', 'guideAskAction', 'guideReturnAction', 'taskBoardLabel',
      'observationEyebrow', 'observationTitle', 'wrongReviewEyebrow', 'wrongReviewTitle',
      'wrongReviewAction', 'revealStoryAction', 'legacyStoryPending', 'readingGate',
      'legacyArchiveAction', 'setCompleteEyebrow', 'setCompleteAction', 'lockedDetailEyebrow',
      'lockedDetailBody', 'memoryEyebrow', 'memoryTitle', 'memorySubmitAction', 'memoryCorrect',
      'memoryIncorrect', 'memoryArchiveAction', 'archiveNextAction', 'archiveRelatedTitle',
      'observationInstruction', 'legacyObservationInstruction', 'observationGuideLabel',
      'observationGuideFirst', 'observationGuideContinue', 'observationGuideComplete',
      'observationMarkerLabel', 'observationProgressLabel', 'clueBoxLabel', 'clueBoxTitle',
      'clueFirstFree', 'clueOpenPrefix', 'clueStarBand', 'archivePrompt', 'guideEliminated',
      'archiveStampAction', 'archiveSealCharacter', 'storyEyebrow', 'storyNavLabel',
      'storySectionPrefix', 'storySourcesLabel', 'storySourceLevelSuffix', 'storyReadAction', 'storyReadDone',
      'introObserveTitle', 'introObserveBody', 'introClueTitle', 'introClueBody',
      'introArchiveTitle', 'introArchiveBody',
      'guideLandingImageAlt', 'guideIntroImageAlt',
    ] as const
    for (const key of required) expect(content.content.copy[key].trim().length, key).toBeGreaterThan(0)
  })

  it('describes observation as a touch interaction instead of pointer movement', () => {
    const copy = content.content.copy
    expect([copy.landingBody, copy.introObserveBody, copy.guideHelpBody, copy.observationInstruction].join('\n')).not.toContain('移动光斑')
    expect(copy.observationInstruction).toContain('轻触')
  })

  it('rejects a content package missing mobile observation guidance', () => {
    const broken = structuredClone(content) as unknown as { content: { copy: Record<string, unknown> } }
    delete broken.content.copy.observationGuideFirst

    expect(validateContent(broken).issues).toContainEqual({
      path: '$.content.copy.observationGuideFirst',
      message: '界面文案不能为空',
    })
  })

  it('rejects observation points calibrated against a changing clue image', () => {
    const broken = structuredClone(content)
    const enhanced = broken.content.artifacts.find(artifact => artifact.experienceV2)
    if (!enhanced?.experienceV2) throw new Error('missing golden experience')
    enhanced.experienceV2.observationSpots[0].assetRole = 'clue-1'

    expect(validateContent(broken).issues).toContainEqual({
      path: '$.content.artifacts[8].experienceV2.observationSpots[0].assetRole',
      message: '观察点资源角色非法',
    })
  })
})
