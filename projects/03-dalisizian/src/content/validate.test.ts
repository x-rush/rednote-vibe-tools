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
})
