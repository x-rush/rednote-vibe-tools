import type { CaseNode, ContentIndex } from './types'

export type DanglingTransition = {
  fromNodeId: string
  toNodeId: string
}

export type CaseGraphReport = {
  caseId: string
  unreachableNodeIds: string[]
  danglingTransitions: DanglingTransition[]
  unexpectedDeadEndNodeIds: string[]
  noEndingPathNodeIds: string[]
  unexpectedCycleNodeIds: string[]
  reachableEndingIds: string[]
}

export function getNodeTransitionIds(node: CaseNode, index: ContentIndex): string[] {
  const targets = new Set<string>()
  node.choices?.forEach((choice) => targets.add(choice.nextNodeId))
  node.branches?.forEach((branch) => targets.add(branch.nextNodeId))
  if (node.deductionId) {
    const caseData = index.cases.get(node.caseId)
    caseData?.deductions.find((item) => item.id === node.deductionId)?.options.forEach((option) => targets.add(option.nextNodeId))
  }
  return [...targets]
}

function findUnexpectedCycles(nodeIds: string[], edges: Map<string, string[]>, noEndingPath: Set<string>): string[] {
  let currentIndex = 0
  const indexes = new Map<string, number>()
  const lowLinks = new Map<string, number>()
  const stack: string[] = []
  const onStack = new Set<string>()
  const unexpected = new Set<string>()

  function visit(nodeId: string): void {
    indexes.set(nodeId, currentIndex)
    lowLinks.set(nodeId, currentIndex)
    currentIndex += 1
    stack.push(nodeId)
    onStack.add(nodeId)

    for (const target of edges.get(nodeId) ?? []) {
      if (!indexes.has(target)) {
        visit(target)
        lowLinks.set(nodeId, Math.min(lowLinks.get(nodeId) ?? 0, lowLinks.get(target) ?? 0))
      } else if (onStack.has(target)) {
        lowLinks.set(nodeId, Math.min(lowLinks.get(nodeId) ?? 0, indexes.get(target) ?? 0))
      }
    }

    if (lowLinks.get(nodeId) !== indexes.get(nodeId)) return
    const component: string[] = []
    let member: string | undefined
    do {
      member = stack.pop()
      if (!member) break
      onStack.delete(member)
      component.push(member)
    } while (member !== nodeId)

    const selfLoop = component.length === 1 && (edges.get(component[0]) ?? []).includes(component[0])
    if ((component.length > 1 || selfLoop) && component.every((id) => noEndingPath.has(id))) {
      component.forEach((id) => unexpected.add(id))
    }
  }

  nodeIds.forEach((nodeId) => {
    if (!indexes.has(nodeId)) visit(nodeId)
  })
  return [...unexpected].sort()
}

export function analyzeCaseGraph(caseId: string, index: ContentIndex): CaseGraphReport {
  const caseData = index.cases.get(caseId)
  if (!caseData) {
    return {
      caseId,
      unreachableNodeIds: [],
      danglingTransitions: [],
      unexpectedDeadEndNodeIds: [],
      noEndingPathNodeIds: [],
      unexpectedCycleNodeIds: [],
      reachableEndingIds: [],
    }
  }

  const nodeIds = [...caseData.nodeIds]
  const nodeSet = new Set(nodeIds)
  const edges = new Map<string, string[]>()
  const danglingTransitions: DanglingTransition[] = []
  const endingNodeIds = new Set<string>()

  for (const nodeId of nodeIds) {
    const node = index.nodes.get(nodeId)
    if (!node) continue
    if (node.kind === 'ending') endingNodeIds.add(nodeId)
    const validTargets: string[] = []
    for (const target of getNodeTransitionIds(node, index)) {
      if (nodeSet.has(target) && index.nodes.has(target)) validTargets.push(target)
      else danglingTransitions.push({ fromNodeId: nodeId, toNodeId: target })
    }
    edges.set(nodeId, validTargets)
  }

  const reachable = new Set<string>()
  const pending = [caseData.startNodeId]
  while (pending.length) {
    const nodeId = pending.pop()
    if (!nodeId || reachable.has(nodeId) || !nodeSet.has(nodeId) || !index.nodes.has(nodeId)) continue
    reachable.add(nodeId)
    pending.push(...(edges.get(nodeId) ?? []))
  }

  const reverseEdges = new Map<string, string[]>()
  nodeIds.forEach((nodeId) => reverseEdges.set(nodeId, []))
  edges.forEach((targets, source) => targets.forEach((target) => reverseEdges.get(target)?.push(source)))
  const canReachEnding = new Set<string>()
  const reversePending = [...endingNodeIds]
  while (reversePending.length) {
    const nodeId = reversePending.pop()
    if (!nodeId || canReachEnding.has(nodeId)) continue
    canReachEnding.add(nodeId)
    reversePending.push(...(reverseEdges.get(nodeId) ?? []))
  }

  const unreachableNodeIds = nodeIds.filter((nodeId) => !reachable.has(nodeId)).sort()
  const unexpectedDeadEndNodeIds = nodeIds.filter((nodeId) => {
    const node = index.nodes.get(nodeId)
    return Boolean(node && node.kind !== 'ending' && (edges.get(nodeId) ?? []).length === 0)
  }).sort()
  const noEndingPathNodeIds = nodeIds.filter((nodeId) => !canReachEnding.has(nodeId)).sort()
  const noEndingPath = new Set(noEndingPathNodeIds)

  return {
    caseId,
    unreachableNodeIds,
    danglingTransitions: danglingTransitions.sort((a, b) => `${a.fromNodeId}:${a.toNodeId}`.localeCompare(`${b.fromNodeId}:${b.toNodeId}`)),
    unexpectedDeadEndNodeIds,
    noEndingPathNodeIds,
    unexpectedCycleNodeIds: findUnexpectedCycles(nodeIds.filter((nodeId) => index.nodes.has(nodeId)), edges, noEndingPath),
    reachableEndingIds: [...endingNodeIds].filter((nodeId) => reachable.has(nodeId)).map((nodeId) => index.nodes.get(nodeId)?.endingId).filter((id): id is string => Boolean(id)).sort(),
  }
}

export function analyzeAllCaseGraphs(index: ContentIndex): CaseGraphReport[] {
  return [...index.cases.values()].sort((a, b) => a.order - b.order).map((item) => analyzeCaseGraph(item.caseId, index))
}
