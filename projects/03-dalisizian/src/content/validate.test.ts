import { describe, expect, it } from 'vitest'
import { contentPackage } from './index'
import type { DalisizianContentPackage } from './types'
import { validateContentPackage } from './validate'

function cloneContent(): DalisizianContentPackage {
  return structuredClone(contentPackage)
}

function errorCodes(content: DalisizianContentPackage): string[] {
  return validateContentPackage(content).issues.filter((issue) => issue.severity === 'error').map((issue) => issue.code)
}

describe('content validation', () => {
  it('accepts the complete production content package', () => {
    const report = validateContentPackage(contentPackage)
    expect(report.valid).toBe(true)
    expect(report.issues.filter((issue) => issue.severity === 'error')).toEqual([])
  })

  it('reports duplicate case IDs and missing entity references', () => {
    const broken = cloneContent()
    broken.content.cases[1].caseId = broken.content.cases[0].caseId
    broken.content.cases[0].characterIds[0] = 'character-does-not-exist'
    broken.content.cases[0].scenes[0].characterIds[0] = 'character-does-not-exist'
    broken.content.cases[0].clues[0].evidenceIds[0] = 'evidence-does-not-exist'

    expect(errorCodes(broken)).toEqual(expect.arrayContaining([
      'duplicate-case-id',
      'missing-character-reference',
      'missing-evidence-reference',
    ]))
  })

  it('rejects unknown condition fields, missing correct answers, and empty failure feedback', () => {
    const broken = cloneContent()
    const firstCase = broken.content.cases[0]
    firstCase.unlockCondition = { field: 'clueIds', operator: 'includes', value: 'clue-does-not-exist' }
    Object.assign(firstCase.scoringRules[0].condition, { field: 'arbitraryState' })
    firstCase.deductions[0].options.forEach((option) => { option.correct = false })
    firstCase.deductions[1].options[0].feedback = ' '

    expect(errorCodes(broken)).toEqual(expect.arrayContaining([
      'unknown-condition-field',
      'missing-clue-reference',
      'deduction-correct-count',
      'missing-failure-feedback',
    ]))
  })

  it('rejects embedded media and remote asset hotlinks', () => {
    const broken = cloneContent()
    broken.content.evidence[0].body = 'data:image/png;base64,AAAA'
    broken.content.evidence[0].assetId = 'https://example.com/evidence.webp'

    expect(errorCodes(broken)).toEqual(expect.arrayContaining(['forbidden-base64', 'remote-asset']))
  })

  it('returns path-aware errors instead of throwing for a partially damaged envelope', () => {
    expect(() => validateContentPackage({ schemaVersion: 1, projectId: 'dalisizian', meta: { locale: 'zh-CN' }, content: { cases: [] } })).not.toThrow()
    const report = validateContentPackage({ schemaVersion: 1, projectId: 'dalisizian', meta: { locale: 'zh-CN' }, content: { cases: [] } })
    expect(report.valid).toBe(false)
    expect(report.issues.map((issue) => issue.code)).toContain('invalid-content-root')
  })

  it('rejects condition operators outside the finite whitelist', () => {
    const broken = cloneContent()
    Object.assign(broken.content.cases[0].scoringRules[0].condition, { operator: 'executes' })
    expect(errorCodes(broken)).toContain('unknown-condition-operator')
  })

  it('rejects incomplete investigation routes and invalid review references', () => {
    const broken = cloneContent()
    const firstCase = broken.content.cases[0]
    const routes = firstCase.investigationRoutes
    if (!routes) throw new Error('route fixture missing')
    routes.pop()
    routes[0].entryNodeId = 'node-does-not-exist'
    routes[1].requiredClueIds = ['clue-does-not-exist']
    delete firstCase.deductions[0].options.find((option) => !option.correct)?.reviewNodeId

    expect(errorCodes(broken)).toEqual(expect.arrayContaining([
      'invalid-route-count',
      'missing-route-entry',
      'missing-route-clue',
      'missing-review-node',
    ]))
  })

  it('rejects fictional framing sources on factual evidence records', () => {
    const broken = cloneContent()
    broken.content.evidence[0].sourceIds.push('source-fiction')

    expect(errorCodes(broken)).toContain('fiction-source-on-evidence')
  })

  it('requires a complete visual spec on every evidence record', () => {
    const broken = cloneContent()
    delete (broken.content.evidence[0] as unknown as { visualSpec?: unknown }).visualSpec

    expect(errorCodes(broken)).toContain('missing-evidence-visual')
  })

  it('matches each evidence type to its approved visual template', () => {
    const broken = cloneContent()
    ;(broken.content.evidence[0] as unknown as { visualSpec: { template: string } }).visualSpec = {
      template: 'myth-verdict',
    }

    expect(errorCodes(broken)).toContain('evidence-template-mismatch')
  })

  it('requires factual visual observations to cite a non-fiction source', () => {
    const broken = cloneContent()
    ;(broken.content.evidence[0] as unknown as { visualSpec: unknown }).visualSpec = {
      template: 'glyph-timeline',
      thumbnailLabel: '家形初证',
      palette: 'jade',
      completionPrompt: '形体层次已核。',
      fallbackSummary: '先看构件关系，再判断材料能够支持到哪一步。',
      observationPoints: [
        {
          id: 'home-form-structure',
          title: '构件关系',
          body: '观察结构关系。',
          sourceIds: ['source-fiction'],
          anchor: { x: 30, y: 40 },
        },
        {
          id: 'home-form-boundary',
          title: '证据边界',
          body: '区分材料与推断。',
          sourceIds: ['source-home-moe-variants'],
          anchor: { x: 70, y: 60 },
        },
      ],
      stages: [{
        id: 'home-stage-structure',
        label: '结构图',
        period: '分期材料',
        materialKind: 'structure-diagram',
        certainty: '只呈现结构关系。',
        sourceIds: ['source-fiction'],
        observationId: 'home-form-structure',
      }],
    }

    expect(errorCodes(broken)).toContain('missing-evidence-visual-source')
  })

  it('rejects duplicate template IDs and unknown observation links', () => {
    const broken = cloneContent()
    const visual = broken.content.evidence[0].visualSpec
    if (visual.template !== 'glyph-timeline') throw new Error('glyph fixture missing')
    visual.stages[1].id = visual.stages[0].id
    ;(visual.stages[0] as unknown as { observationId: string }).observationId = 'missing-observation'

    expect(errorCodes(broken)).toEqual(expect.arrayContaining(['invalid-evidence-visual', 'invalid-evidence-visual-reference']))
  })

  it('validates semantic nodes and myth list element types exhaustively', () => {
    const broken = cloneContent()
    const semantic = broken.content.evidence.find((item) => item.visualSpec.template === 'semantic-map')?.visualSpec
    const myth = broken.content.evidence.find((item) => item.visualSpec.template === 'myth-verdict')?.visualSpec
    if (!semantic || semantic.template !== 'semantic-map' || !myth || myth.template !== 'myth-verdict') throw new Error('visual fixtures missing')
    semantic.nodes[0].label = ' '
    Object.assign(myth, { supports: [42] })

    expect(errorCodes(broken).filter((code) => code === 'invalid-evidence-visual').length).toBeGreaterThanOrEqual(2)
  })

  it('rejects unresolved stage asset IDs', () => {
    const broken = cloneContent()
    const visual = broken.content.evidence[0].visualSpec
    if (visual.template !== 'glyph-timeline') throw new Error('glyph fixture missing')
    visual.stages[0].assetId = 'asset-evidence-not-packaged'

    expect(errorCodes(broken)).toContain('invalid-evidence-visual-reference')
  })
})
