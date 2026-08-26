import { analyzeAllCaseGraphs, getNodeTransitionIds } from './graph'
import { buildContentIndex } from './index'
import type { ConditionExpression, DalisizianContentPackage } from './types'

export type ValidationIssue = {
  severity: 'error' | 'warning'
  code: string
  path: string
  message: string
}

export type ValidationReport = {
  valid: boolean
  issues: ValidationIssue[]
}

const idPattern = /^[a-z][a-z0-9-]*$/
const conditionFields = new Set([
  'clueIds', 'evidenceIds', 'unlockedSceneIds', 'visitedNodeIds', 'reviewedRouteIds', 'styleTags', 'completedCaseIds',
  'flags', 'deductionAnswers', 'firstDeductionAnswers', 'deductionAttempts',
])

export function validateContentPackage(value: unknown): ValidationReport {
  const issues: ValidationIssue[] = []
  const add = (code: string, path: string, message: string, severity: 'error' | 'warning' = 'error') => {
    issues.push({ severity, code, path, message })
  }

  if (!value || typeof value !== 'object') {
    add('invalid-envelope', '$', '内容包必须是对象。')
    return { valid: false, issues }
  }

  const content = value as DalisizianContentPackage
  if (content.schemaVersion !== 1) add('invalid-schema-version', '$.schemaVersion', 'schemaVersion 必须为 1。')
  if (content.projectId !== 'dalisizian') add('invalid-project-id', '$.projectId', 'projectId 必须为 dalisizian。')
  if (!content.meta || content.meta.locale !== 'zh-CN') add('invalid-locale', '$.meta.locale', 'locale 必须为 zh-CN。')
  const requiredArrays = ['sources', 'characters', 'cases', 'nodes', 'evidence', 'endings'] as const
  const missingArray = requiredArrays.some((key) => key === 'sources'
    ? !Array.isArray(content.sources)
    : !content.content || !Array.isArray(content.content[key]))
  if (!content.content || missingArray) {
    add('invalid-content-root', '$.content', '业务根字段不完整。')
    return { valid: false, issues }
  }

  const allowedRoots = new Set(['characters', 'cases', 'nodes', 'evidence', 'endings'])
  Object.keys(content.content).forEach((key) => {
    if (!allowedRoots.has(key)) add('unknown-content-root', `$.content.${key}`, '存在未知业务根字段。')
  })
  if (content.content.cases.length !== 8) add('invalid-case-count', '$.content.cases', '首发必须恰好包含 8 案。')

  function unique(items: { id?: string; caseId?: string }[], field: 'id' | 'caseId', code: string, path: string): void {
    const seen = new Set<string>()
    items.forEach((item, index) => {
      const id = item[field]
      if (!id || !idPattern.test(id)) add('invalid-id', `${path}[${index}].${field}`, 'ID 必须为稳定 kebab-case。')
      else if (seen.has(id)) add(code, `${path}[${index}].${field}`, `ID ${id} 重复。`)
      else seen.add(id)
    })
  }

  unique(content.sources, 'id', 'duplicate-source-id', '$.sources')
  unique(content.content.characters, 'id', 'duplicate-character-id', '$.content.characters')
  unique(content.content.cases, 'caseId', 'duplicate-case-id', '$.content.cases')
  unique(content.content.nodes, 'id', 'duplicate-node-id', '$.content.nodes')
  unique(content.content.evidence, 'id', 'duplicate-evidence-id', '$.content.evidence')
  unique(content.content.endings, 'id', 'duplicate-ending-id', '$.content.endings')
  unique(content.content.cases.flatMap((item) => item.scenes), 'id', 'duplicate-scene-id', '$.content.cases[].scenes')
  unique(content.content.cases.flatMap((item) => item.clues), 'id', 'duplicate-clue-id', '$.content.cases[].clues')

  const index = buildContentIndex(content)
  const sourceIds = new Set(content.sources.map((item) => item.id))
  const sourceTypes = new Map(content.sources.map((item) => [item.id, item.type]))

  const evidenceTemplateByType = {
    字形: 'glyph-timeline',
    字书: 'lexicon-scroll',
    语义: 'semantic-map',
    辨伪: 'myth-verdict',
  } as const
  const evidencePalettes = new Set(['jade', 'cinnabar', 'bronze', 'ink'])

  function isRecord(item: unknown): item is Record<string, unknown> {
    return Boolean(item) && typeof item === 'object' && !Array.isArray(item)
  }

  function validateVisualSources(value: unknown, path: string): void {
    if (!Array.isArray(value) || !value.some((id) => typeof id === 'string' && sourceIds.has(id) && sourceTypes.get(id) !== 'F')) {
      add('missing-evidence-visual-source', path, '事实观察点必须引用至少一个非虚构来源。')
      return
    }
    value.forEach((id, position) => {
      if (typeof id !== 'string' || !sourceIds.has(id)) add('invalid-evidence-visual-reference', `${path}[${position}]`, `视觉来源 ${String(id)} 不存在。`)
      else if (sourceTypes.get(id) === 'F') add('missing-evidence-visual-source', `${path}[${position}]`, '虚构来源不能支撑事实视觉。')
    })
  }

  function validateEvidenceVisual(evidence: DalisizianContentPackage['content']['evidence'][number], position: number): void {
    const path = `$.content.evidence[${position}].visualSpec`
    const visual = (evidence as unknown as Record<string, unknown>).visualSpec
    if (!isRecord(visual)) {
      add('missing-evidence-visual', path, '证物必须提供互动视觉规格。')
      return
    }
    if (visual.template !== evidenceTemplateByType[evidence.type]) {
      add('evidence-template-mismatch', `${path}.template`, `${evidence.type}证物必须使用 ${evidenceTemplateByType[evidence.type]} 模板。`)
    }
    if (typeof visual.thumbnailLabel !== 'string' || !visual.thumbnailLabel.trim()
      || typeof visual.completionPrompt !== 'string' || !visual.completionPrompt.trim()
      || typeof visual.fallbackSummary !== 'string' || !visual.fallbackSummary.trim()
      || typeof visual.palette !== 'string' || !evidencePalettes.has(visual.palette)) {
      add('invalid-evidence-visual', path, '视觉规格的标签、提示、回退说明或色板无效。')
    }
    if (!Array.isArray(visual.observationPoints) || visual.observationPoints.length < 2 || visual.observationPoints.length > 6) {
      add('invalid-evidence-observation', `${path}.observationPoints`, '每件证物必须有 2 至 6 个观察点。')
    } else {
      const observationIds = new Set<string>()
      visual.observationPoints.forEach((point, pointPosition) => {
        const pointPath = `${path}.observationPoints[${pointPosition}]`
        if (!isRecord(point) || typeof point.id !== 'string' || !idPattern.test(point.id)
          || observationIds.has(point.id) || typeof point.title !== 'string' || !point.title.trim()
          || typeof point.body !== 'string' || !point.body.trim() || !isRecord(point.anchor)
          || typeof point.anchor.x !== 'number' || point.anchor.x < 0 || point.anchor.x > 100
          || typeof point.anchor.y !== 'number' || point.anchor.y < 0 || point.anchor.y > 100) {
          add('invalid-evidence-observation', pointPath, '观察点 ID、文字或锚点无效。')
        } else observationIds.add(point.id)
        if (isRecord(point)) validateVisualSources(point.sourceIds, `${pointPath}.sourceIds`)
      })
    }

    if (visual.template === 'glyph-timeline') {
      if (!Array.isArray(visual.stages) || visual.stages.length < 2 || visual.stages.length > 4) add('invalid-evidence-visual', `${path}.stages`, '字形时间轴必须有 2 至 4 个阶段。')
      else visual.stages.forEach((stage, stagePosition) => {
        const stagePath = `${path}.stages[${stagePosition}]`
        if (!isRecord(stage) || typeof stage.id !== 'string' || !idPattern.test(stage.id) || typeof stage.label !== 'string' || !stage.label.trim()
          || typeof stage.period !== 'string' || !stage.period.trim() || !['structure-diagram', 'database-rendering', 'rubbing', 'manual-tracing'].includes(String(stage.materialKind))
          || typeof stage.certainty !== 'string' || !stage.certainty.trim()) add('invalid-evidence-visual', stagePath, '字形阶段字段无效。')
        if (isRecord(stage)) validateVisualSources(stage.sourceIds, `${stagePath}.sourceIds`)
      })
    } else if (visual.template === 'lexicon-scroll') {
      if (!Array.isArray(visual.entries) || visual.entries.length < 2) add('invalid-evidence-visual', `${path}.entries`, '字书卷至少需要两个条目层次。')
      else visual.entries.forEach((entry, entryPosition) => {
        const entryPath = `${path}.entries[${entryPosition}]`
        if (!isRecord(entry) || typeof entry.id !== 'string' || !idPattern.test(entry.id) || !['heading', 'originalText', 'interpretation', 'highlight'].every((key) => typeof entry[key] === 'string' && String(entry[key]).trim())) add('invalid-evidence-visual', entryPath, '字书条目字段无效。')
        if (isRecord(entry)) validateVisualSources(entry.sourceIds, `${entryPath}.sourceIds`)
      })
    } else if (visual.template === 'semantic-map') {
      if (!Array.isArray(visual.nodes) || visual.nodes.length < 2 || !Array.isArray(visual.edges) || visual.edges.length < 1) add('invalid-evidence-visual', path, '语义图需要至少两个节点和一条关系。')
      else {
        const nodeIds = new Set(visual.nodes.filter(isRecord).map((node) => node.id).filter((id): id is string => typeof id === 'string'))
        visual.edges.forEach((edge, edgePosition) => {
          const edgePath = `${path}.edges[${edgePosition}]`
          if (!isRecord(edge) || typeof edge.id !== 'string' || !idPattern.test(edge.id) || typeof edge.from !== 'string' || !nodeIds.has(edge.from)
            || typeof edge.to !== 'string' || !nodeIds.has(edge.to) || typeof edge.label !== 'string' || !edge.label.trim()
            || !['supported', 'possible', 'blocked'].includes(String(edge.strength))) add('invalid-evidence-visual-reference', edgePath, '语义关系引用或强度无效。')
          if (isRecord(edge)) validateVisualSources(edge.sourceIds, `${edgePath}.sourceIds`)
        })
      }
    } else if (visual.template === 'myth-verdict') {
      if (typeof visual.claim !== 'string' || !visual.claim.trim()
        || !Array.isArray(visual.supports) || !visual.supports.length
        || !Array.isArray(visual.limits) || !visual.limits.length
        || !Array.isArray(visual.disputes) || !visual.disputes.length) add('invalid-evidence-visual', path, '辨伪卷必须包含传闻、可证、不可证与争议内容。')
    }
  }

  function validateCondition(condition: ConditionExpression, path: string): void {
    if ('all' in condition) return condition.all.forEach((child, indexValue) => validateCondition(child, `${path}.all[${indexValue}]`))
    if ('any' in condition) return condition.any.forEach((child, indexValue) => validateCondition(child, `${path}.any[${indexValue}]`))
    if ('not' in condition) return validateCondition(condition.not, `${path}.not`)
    const leaf = condition as unknown as { field: string; operator?: string; value?: string | number; key?: string }
    if (!conditionFields.has(leaf.field)) {
      add('unknown-condition-field', `${path}.field`, `未知状态字段 ${leaf.field}。`)
      return
    }
    const operator = 'operator' in leaf ? leaf.operator : undefined
    const validOperator = leaf.field === 'flags' ? operator === 'equals'
      : leaf.field === 'deductionAnswers' || leaf.field === 'firstDeductionAnswers' ? operator === 'answer-is'
        : leaf.field === 'deductionAttempts' ? operator === 'at-most'
        : operator === 'includes' || operator === 'not-includes'
    if (!validOperator) add('unknown-condition-operator', `${path}.operator`, `状态字段 ${leaf.field} 使用了非法操作符。`)
    if (leaf.field === 'clueIds' && typeof leaf.value === 'string' && !index.clues.has(leaf.value)) add('missing-clue-reference', `${path}.value`, `线索 ${leaf.value} 不存在。`)
    if (leaf.field === 'evidenceIds' && typeof leaf.value === 'string' && !index.evidence.has(leaf.value)) add('missing-evidence-reference', `${path}.value`, `证物 ${leaf.value} 不存在。`)
    if (leaf.field === 'unlockedSceneIds' && typeof leaf.value === 'string' && !index.scenes.has(leaf.value)) add('missing-scene-reference', `${path}.value`, `场景 ${leaf.value} 不存在。`)
    if (leaf.field === 'visitedNodeIds' && typeof leaf.value === 'string' && !index.nodes.has(leaf.value)) add('missing-node-reference', `${path}.value`, `节点 ${leaf.value} 不存在。`)
    if (leaf.field === 'completedCaseIds' && typeof leaf.value === 'string' && !index.cases.has(leaf.value)) add('missing-case-reference', `${path}.value`, `案件 ${leaf.value} 不存在。`)
  }

  content.content.cases.forEach((caseData, casePosition) => {
    const casePath = `$.content.cases[${casePosition}]`
    if (!Array.isArray(caseData.investigationRoutes) || caseData.investigationRoutes.length !== 3) {
      add('invalid-route-count', `${casePath}.investigationRoutes`, '每案必须恰好包含三条调查路线。')
    }
    const routeIds = new Set<string>()
    for (const [routePosition, route] of (caseData.investigationRoutes ?? []).entries()) {
      const routePath = `${casePath}.investigationRoutes[${routePosition}]`
      if (routeIds.has(route.id)) add('duplicate-route-id', `${routePath}.id`, `路线 ${route.id} 在本案重复。`)
      routeIds.add(route.id)
      const entryNode = index.nodes.get(route.entryNodeId)
      if (!entryNode || entryNode.caseId !== caseData.caseId) add('missing-route-entry', `${routePath}.entryNodeId`, `路线入口 ${route.entryNodeId} 不属于本案。`)
      route.requiredClueIds.forEach((id, position) => {
        if (!caseData.clues.some((clue) => clue.id === id)) add('missing-route-clue', `${routePath}.requiredClueIds[${position}]`, `路线线索 ${id} 不属于本案。`)
      })
    }
    caseData.characterIds.forEach((id, position) => {
      if (!index.characters.has(id)) add('missing-character-reference', `${casePath}.characterIds[${position}]`, `人物 ${id} 不存在。`)
    })
    caseData.scenes.forEach((scene, scenePosition) => scene.characterIds.forEach((id, position) => {
      if (!index.characters.has(id)) add('missing-character-reference', `${casePath}.scenes[${scenePosition}].characterIds[${position}]`, `人物 ${id} 不存在。`)
    }))
    caseData.clues.forEach((clue, cluePosition) => {
      clue.evidenceIds.forEach((id, position) => {
        const item = index.evidence.get(id)
        if (!item || item.caseId !== caseData.caseId) add('missing-evidence-reference', `${casePath}.clues[${cluePosition}].evidenceIds[${position}]`, `本案证物 ${id} 不存在。`)
      })
      clue.sourceIds.forEach((id, position) => {
        if (!sourceIds.has(id)) add('missing-source-reference', `${casePath}.clues[${cluePosition}].sourceIds[${position}]`, `来源 ${id} 不存在。`)
        if (sourceTypes.get(id) === 'F') add('fiction-source-on-evidence', `${casePath}.clues[${cluePosition}].sourceIds[${position}]`, '虚构叙事来源不能支撑事实线索。')
      })
    })
    caseData.nodeIds.forEach((id, position) => {
      const node = index.nodes.get(id)
      if (!node || node.caseId !== caseData.caseId) add('missing-node-reference', `${casePath}.nodeIds[${position}]`, `本案节点 ${id} 不存在。`)
      if (node?.routeId && !routeIds.has(node.routeId)) add('missing-route-reference', `${casePath}.nodeIds[${position}]`, `节点引用了未知路线 ${node.routeId}。`)
    })
    caseData.evidenceIds.forEach((id, position) => {
      const item = index.evidence.get(id)
      if (!item || item.caseId !== caseData.caseId) add('missing-evidence-reference', `${casePath}.evidenceIds[${position}]`, `本案证物 ${id} 不存在。`)
    })
    caseData.endingIds.forEach((id, position) => {
      const ending = index.endings.get(id)
      if (!ending || ending.caseId !== caseData.caseId) add('missing-ending-reference', `${casePath}.endingIds[${position}]`, `本案结局 ${id} 不存在。`)
    })
    caseData.requiredClueIds.forEach((id, position) => {
      if (!caseData.clues.some((clue) => clue.id === id)) add('missing-clue-reference', `${casePath}.requiredClueIds[${position}]`, `本案线索 ${id} 不存在。`)
    })
    caseData.sourceIds.forEach((id, position) => {
      if (!sourceIds.has(id)) add('missing-source-reference', `${casePath}.sourceIds[${position}]`, `来源 ${id} 不存在。`)
    })
    validateCondition(caseData.unlockCondition, `${casePath}.unlockCondition`)
    caseData.scoringRules.forEach((rule, position) => validateCondition(rule.condition, `${casePath}.scoringRules[${position}].condition`))
    caseData.deductions.forEach((deduction, deductionPosition) => {
      const deductionPath = `${casePath}.deductions[${deductionPosition}]`
      if (deduction.options.filter((option) => option.correct).length !== 1) add('deduction-correct-count', `${deductionPath}.options`, '每个推理问题必须有且仅有一个正确答案。')
      deduction.requiredClueIds.forEach((id, position) => {
        if (!caseData.clues.some((clue) => clue.id === id)) add('missing-clue-reference', `${deductionPath}.requiredClueIds[${position}]`, `线索 ${id} 不存在。`)
      })
      deduction.focusEvidenceIds?.forEach((id, position) => {
        const evidence = index.evidence.get(id)
        if (!evidence || evidence.caseId !== caseData.caseId) add('missing-focus-evidence', `${deductionPath}.focusEvidenceIds[${position}]`, `关联证物 ${id} 不属于本案。`)
      })
      deduction.options.forEach((option, optionPosition) => {
        if (!option.correct && !option.feedback.trim()) add('missing-failure-feedback', `${deductionPath}.options[${optionPosition}].feedback`, '错误答案必须提供反馈。')
        if (!index.nodes.has(option.nextNodeId)) add('dangling-transition', `${deductionPath}.options[${optionPosition}].nextNodeId`, `节点 ${option.nextNodeId} 不存在。`)
        if (!option.correct) {
          const reviewNode = option.reviewNodeId ? index.nodes.get(option.reviewNodeId) : undefined
          if (!reviewNode || reviewNode.caseId !== caseData.caseId) add('missing-review-node', `${deductionPath}.options[${optionPosition}].reviewNodeId`, '错误答案必须指向本案可复核节点。')
        }
      })
    })
  })

  content.content.evidence.forEach((evidence, evidencePosition) => {
    validateEvidenceVisual(evidence, evidencePosition)
    evidence.sourceIds.forEach((id, sourcePosition) => {
      const sourcePath = `$.content.evidence[${evidencePosition}].sourceIds[${sourcePosition}]`
      if (!sourceIds.has(id)) add('missing-source-reference', sourcePath, `来源 ${id} 不存在。`)
      if (sourceTypes.get(id) === 'F') add('fiction-source-on-evidence', sourcePath, '虚构叙事来源不能支撑事实证物。')
    })
  })

  content.content.endings.forEach((ending, endingPosition) => {
    ending.sourceIds.forEach((id, sourcePosition) => {
      const sourcePath = `$.content.endings[${endingPosition}].sourceIds[${sourcePosition}]`
      if (!sourceIds.has(id)) add('missing-source-reference', sourcePath, `来源 ${id} 不存在。`)
      if (sourceTypes.get(id) === 'F') add('fiction-source-on-evidence', sourcePath, '虚构叙事来源不能支撑事实判词。')
    })
  })

  content.content.nodes.forEach((node, position) => {
    const nodePath = `$.content.nodes[${position}]`
    if (node.speakerId && !index.characters.has(node.speakerId)) add('missing-character-reference', `${nodePath}.speakerId`, `人物 ${node.speakerId} 不存在。`)
    if (node.sceneId && !index.scenes.has(node.sceneId)) add('missing-scene-reference', `${nodePath}.sceneId`, `场景 ${node.sceneId} 不存在。`)
    node.acquireClueIds?.forEach((id, idPosition) => {
      if (!index.clues.has(id)) add('missing-clue-reference', `${nodePath}.acquireClueIds[${idPosition}]`, `线索 ${id} 不存在。`)
    })
    node.acquireEvidenceIds?.forEach((id, idPosition) => {
      if (!index.evidence.has(id)) add('missing-evidence-reference', `${nodePath}.acquireEvidenceIds[${idPosition}]`, `证物 ${id} 不存在。`)
    })
    node.choices?.forEach((choice, choicePosition) => {
      if (choice.condition) validateCondition(choice.condition, `${nodePath}.choices[${choicePosition}].condition`)
      choice.effects?.forEach((effect, effectPosition) => {
        if (effect.type === 'add-clue' && !index.clues.has(effect.clueId)) add('missing-clue-reference', `${nodePath}.choices[${choicePosition}].effects[${effectPosition}]`, `线索 ${effect.clueId} 不存在。`)
        if (effect.type === 'add-evidence' && !index.evidence.has(effect.evidenceId)) add('missing-evidence-reference', `${nodePath}.choices[${choicePosition}].effects[${effectPosition}]`, `证物 ${effect.evidenceId} 不存在。`)
        if (effect.type === 'unlock-scene' && !index.scenes.has(effect.sceneId)) add('missing-scene-reference', `${nodePath}.choices[${choicePosition}].effects[${effectPosition}]`, `场景 ${effect.sceneId} 不存在。`)
      })
    })
    node.branches?.forEach((branch, branchPosition) => {
      if (branch.condition) validateCondition(branch.condition, `${nodePath}.branches[${branchPosition}].condition`)
    })
    getNodeTransitionIds(node, index).forEach((target) => {
      if (!index.nodes.has(target)) add('dangling-transition', nodePath, `跳转目标 ${target} 不存在。`)
    })
  })

  analyzeAllCaseGraphs(index).forEach((report) => {
    report.danglingTransitions.forEach((item) => add('dangling-transition', `$.content.cases.${report.caseId}`, `${item.fromNodeId} 指向不存在的 ${item.toNodeId}。`))
    report.unreachableNodeIds.forEach((id) => {
      const node = index.nodes.get(id)
      if (node?.critical) add('unreachable-critical-node', `$.content.nodes.${id}`, `关键节点 ${id} 不可达。`)
    })
    report.unexpectedDeadEndNodeIds.forEach((id) => add('unexpected-dead-end', `$.content.nodes.${id}`, `节点 ${id} 是非预期死节点。`))
    report.noEndingPathNodeIds.forEach((id) => add('no-ending-path', `$.content.nodes.${id}`, `节点 ${id} 无法抵达结局。`))
    if (!report.reachableEndingIds.length) add('missing-reachable-ending', `$.content.cases.${report.caseId}`, '案件没有可达结局。')
  })

  function scanForbidden(item: unknown, path: string): void {
    if (typeof item === 'string') {
      if (/data:[^;]+;base64,/i.test(item)) add('forbidden-base64', path, '内容包禁止 Base64 媒体。')
      if (/<script\b/i.test(item)) add('forbidden-script', path, '内容包禁止脚本。')
      return
    }
    if (Array.isArray(item)) return item.forEach((child, position) => scanForbidden(child, `${path}[${position}]`))
    if (!item || typeof item !== 'object') return
    Object.entries(item).forEach(([key, child]) => {
      const childPath = `${path}.${key}`
      if ((key === 'assetId' || key === 'asset') && typeof child === 'string' && /^https?:\/\//i.test(child)) add('remote-asset', childPath, '资产必须使用项目内稳定 ID，禁止远程热链。')
      scanForbidden(child, childPath)
    })
  }
  scanForbidden(content, '$')

  return { valid: !issues.some((issue) => issue.severity === 'error'), issues }
}
