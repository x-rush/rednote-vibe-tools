import { describe, expect, it } from 'vitest'
import { analyzeAllCaseGraphs, analyzeCaseGraph } from './graph'
import { buildContentIndex, contentIndex, contentPackage } from './index'
import type { CaseNode, DalisizianContentPackage } from './types'

function cloneContent(): DalisizianContentPackage {
  return structuredClone(contentPackage)
}

describe('case graph analysis', () => {
  it('finds no structural graph defects in all eight cases', () => {
    const reports = analyzeAllCaseGraphs(contentIndex)
    expect(reports).toHaveLength(8)

    for (const report of reports) {
      expect(report.danglingTransitions).toEqual([])
      expect(report.unreachableNodeIds).toEqual([])
      expect(report.unexpectedDeadEndNodeIds).toEqual([])
      expect(report.noEndingPathNodeIds).toEqual([])
      expect(report.unexpectedCycleNodeIds).toEqual([])
      expect(report.reachableEndingIds.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('reports dangling transitions and unreachable nodes', () => {
    const broken = cloneContent()
    const firstCase = broken.content.cases[0]
    const firstNode = broken.content.nodes.find((node) => node.id === firstCase.startNodeId)
    if (!firstNode?.choices) throw new Error('test fixture requires a start choice')
    firstNode.choices[0].nextNodeId = 'node-does-not-exist'
    const orphan: CaseNode = {
      id: 'node-home-orphan',
      caseId: firstCase.caseId,
      kind: 'narration',
      text: '不可达测试节点',
      critical: false,
      choices: [{ id: 'choice-home-orphan', text: '返回', nextNodeId: firstCase.startNodeId }],
    }
    broken.content.nodes.push(orphan)
    firstCase.nodeIds.push(orphan.id)

    const report = analyzeCaseGraph(firstCase.caseId, buildContentIndex(broken))
    expect(report.danglingTransitions).toContainEqual({ fromNodeId: firstCase.startNodeId, toNodeId: 'node-does-not-exist' })
    expect(report.unreachableNodeIds).toContain('node-home-orphan')
  })

  it('reports an unexpected dead end and nodes with no ending path', () => {
    const broken = cloneContent()
    const firstCase = broken.content.cases[0]
    const blockedNodeId = firstCase.nodeIds[14]
    const blockedNode = broken.content.nodes.find((node) => node.id === blockedNodeId)
    if (!blockedNode) throw new Error('test fixture requires a clue node')
    delete blockedNode.choices

    const report = analyzeCaseGraph(firstCase.caseId, buildContentIndex(broken))
    expect(report.unexpectedDeadEndNodeIds).toContain(blockedNodeId)
    expect(report.noEndingPathNodeIds).toContain(blockedNodeId)
  })
})
