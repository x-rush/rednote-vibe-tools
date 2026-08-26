import { describe, expect, it } from 'vitest'
import type { DalisizianContentPackage } from './types'
import rawContent from './content.json'

const content = rawContent as unknown as DalisizianContentPackage

describe('content envelope', () => {
  it('ships the complete eight-case production package', () => {
    expect(content.projectId).toBe('dalisizian')
    expect(content.schemaVersion).toBe(1)
    expect(content.meta.locale).toBe('zh-CN')
    expect(content.contentVersion).toBe('2.0.0')
    expect(content.content.cases).toHaveLength(8)
    expect(content.content.characters.length).toBeGreaterThanOrEqual(4)
    expect(content.content.nodes.length).toBeGreaterThanOrEqual(144)
    expect(content.content.evidence.length).toBeGreaterThanOrEqual(32)
    expect(content.content.endings).toHaveLength(8)
  })

  it('gives every case a complete option-driven investigation contract', () => {
    for (const item of content.content.cases) {
      expect(item.characterIds.length).toBeGreaterThanOrEqual(3)
      expect(item.scenes.length).toBeGreaterThanOrEqual(3)
      expect(item.clues.length).toBeGreaterThanOrEqual(3)
      expect(item.nodeIds.length).toBeGreaterThanOrEqual(18)
      expect(item.evidenceIds.length).toBeGreaterThanOrEqual(4)
      expect(item.deductions.length).toBeGreaterThanOrEqual(3)
      expect(item.endingIds).toHaveLength(1)
      expect(item.assetIds.characterIds.length).toBe(item.characterIds.length)
      expect(item.assetIds.sceneIds.length).toBe(item.scenes.length)
      expect(item.assetIds.evidenceIds.length).toBe(item.evidenceIds.length)
    }
  })

  it('ships Shen Yan as the non-spoiling records-clerk guide', () => {
    const guide = content.content.characters.find((item) => item.id === 'character-temple-official')

    expect(guide).toMatchObject({
      name: '沈砚',
      title: '大理寺录事',
      assetId: 'asset-character-temple-official',
    })
    expect(guide?.role).toContain('不代替玩家作答')
    expect(content.content.nodes.filter((node) => node.text.includes('寺丞'))).toEqual([])
    expect(content.content.cases.filter((item) => item.opening.includes('寺丞'))).toEqual([])
  })

  it('gives every case three playable routes with active evidence capture and review targets', () => {
    for (const caseData of content.content.cases) {
      expect(caseData.investigationRoutes).toHaveLength(3)
      const routeIds = new Set(caseData.investigationRoutes?.map((route) => route.id))
      const routeNodes = content.content.nodes.filter((node) => node.caseId === caseData.caseId && node.routeId && routeIds.has(node.routeId))
      expect(routeNodes.some((node) => node.acquireClueIds?.length || node.acquireEvidenceIds?.length)).toBe(false)
      for (const route of caseData.investigationRoutes ?? []) {
        const choices = routeNodes.flatMap((node) => node.choices ?? [])
        expect(route.requiredClueIds.every((clueId) => choices.some((routeChoice) => routeChoice.effects?.some((effect) => effect.type === 'add-clue' && effect.clueId === clueId)))).toBe(true)
      }
      for (const deduction of caseData.deductions) {
        expect(deduction.focusEvidenceIds?.length).toBeGreaterThan(0)
        for (const option of deduction.options.filter((item) => !item.correct)) expect(option.reviewNodeId).toBeTruthy()
      }
    }
  })

  it('uses case-specific witness testimony and deduction options', () => {
    const witnessTexts = content.content.cases.map((caseData) => {
      const witnessId = caseData.characterIds.find((id) => id.endsWith('-witness'))
      return content.content.nodes.filter((node) => node.caseId === caseData.caseId && node.speakerId === witnessId).map((node) => node.text).join(' ')
    })
    expect(new Set(witnessTexts).size).toBe(content.content.cases.length)
    expect(witnessTexts.every((text) => text.length >= 45)).toBe(true)

    const optionSets = content.content.cases.map((caseData) => caseData.deductions.flatMap((deduction) => deduction.options.map((option) => option.text)).join('|'))
    expect(new Set(optionSets).size).toBe(content.content.cases.length)
    const correctPositionPatterns = content.content.cases.map((caseData) => caseData.deductions.map((deduction) => deduction.options.findIndex((option) => option.correct)).join('-'))
    expect(new Set(correctPositionPatterns).size).toBeGreaterThanOrEqual(4)
  })

  it('lets every initial judgment begin from all four verdicts', () => {
    for (const caseData of content.content.cases) {
      const caseNodes = content.content.nodes.filter((node) => node.caseId === caseData.caseId)
      const initialNode = caseNodes.find((node) => node.choices?.some((choice) => choice.effects?.some((effect) => effect.type === 'set-initial-verdict')))
      const verdicts = initialNode?.choices?.flatMap((choice) => choice.effects?.flatMap((effect) => effect.type === 'set-initial-verdict' ? [effect.verdict] : []) ?? []) ?? []

      expect(new Set(verdicts)).toEqual(new Set(['credible', 'partial', 'uncertain', 'myth']))
    }
  })

  it('gives every witness a real evidence confrontation with distinct reactions', () => {
    const nodeById = new Map(content.content.nodes.map((node) => [node.id, node]))

    for (const caseData of content.content.cases) {
      const witnessId = caseData.characterIds.find((id) => id.endsWith('-witness'))
      const witnessNodes = content.content.nodes.filter((node) => node.caseId === caseData.caseId && node.speakerId === witnessId)
      const confrontation = content.content.nodes.find((node) => {
        if (node.caseId !== caseData.caseId || (node.choices?.length ?? 0) < 2) return false
        return node.choices?.every((choice) => nodeById.get(choice.nextNodeId)?.speakerId === witnessId)
      })

      expect(witnessNodes.length).toBeGreaterThanOrEqual(3)
      expect(new Set(confrontation?.choices?.map((choice) => choice.nextNodeId))).toHaveLength(2)
      const reactions = confrontation?.choices?.map((choice) => nodeById.get(choice.nextNodeId)) ?? []
      expect(new Set(reactions.map((node) => node?.text))).toHaveLength(2)
      expect(reactions.every((node) => node !== undefined && node.speakerId === witnessId && node.choices?.length === 1)).toBe(true)
    }
  })

  it('contains no duplicate choice effects or immediate scene copy repeats', () => {
    const nodeById = new Map(content.content.nodes.map((node) => [node.id, node]))

    for (const node of content.content.nodes) {
      for (const choice of node.choices ?? []) {
        const effects = (choice.effects ?? []).map((effect) => JSON.stringify(effect))
        expect(new Set(effects).size, `${node.id}/${choice.id}`).toBe(effects.length)

        const target = nodeById.get(choice.nextNodeId)
        if (node.kind === 'scene' && target?.kind === 'dialogue') expect(target.text, `${node.id}/${target.id}`).not.toBe(node.text)
      }
    }
  })

  it('separates fictional framing from factual evidence and gives every case a modern authority source', () => {
    const sourceTypes = new Map(content.sources.map((source) => [source.id, source.type]))
    for (const item of [...content.content.evidence, ...content.content.endings, ...content.content.cases.flatMap((caseData) => caseData.clues)]) {
      expect(item.sourceIds.some((id) => sourceTypes.get(id) === 'F')).toBe(false)
    }
    for (const caseData of content.content.cases) {
      expect(caseData.sourceIds.some((id) => sourceTypes.get(id) === 'B')).toBe(true)
      const evidenceSourceSets = caseData.evidenceIds.map((id) => content.content.evidence.find((item) => item.id === id)?.sourceIds.join('|'))
      expect(new Set(evidenceSourceSets).size).toBeGreaterThan(1)
    }
  })
})
