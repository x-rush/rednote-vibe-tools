import { matchExpressionRisks, selectBestScenario } from './matching'
import type {
  ConversationContentPackage,
  ReplayAnswers,
  ReplayCardViewModel,
  ReplayResult,
  ToneVariant,
} from './types'

export function buildReplayResult(
  answers: ReplayAnswers,
  content: ConversationContentPackage,
): ReplayResult {
  const match = selectBestScenario(content.content.scenarios, answers)
  if (answers.conflictLevel === 'safety') {
    const safetyNotice = content.content.safetyRules[0]
    if (!safetyNotice) throw new Error('安全情境缺少安全提示')
    return {
      scenarioId: match.scenario.scenarioId,
      scenarioTitle: safetyNotice.fallback.scenarioTitle,
      matchLevel: match.level,
      matchReason: match.reason,
      originalRisk: [safetyNotice.fallback.misunderstanding],
      expressionStructure: safetyNotice.fallback.structure,
      alternatives: safetyNotice.fallback.tones,
      repairLine: safetyNotice.fallback.repairLine,
      nextTimeLine: safetyNotice.fallback.nextTimeLine,
      nextSteps: safetyNotice.fallback.nextSteps,
      summary: safetyNotice.fallback.summary,
      shareSummary: safetyNotice.fallback.shareSummary,
      safetyNotice,
      contentVersion: content.contentVersion,
    }
  }
  const rewrite = content.content.rewrites.find(({ id }) => id === match.scenario.rewriteId)
  if (!rewrite) throw new Error(`情境 ${match.scenario.scenarioId} 缺少表达方案`)
  const safetyNotice = match.scenario.safetyRuleId
    ? content.content.safetyRules.find(({ id }) => id === match.scenario.safetyRuleId)
    : undefined

  return {
    scenarioId: match.scenario.scenarioId,
    scenarioTitle: match.scenario.title,
    matchLevel: match.level,
    matchReason: match.reason,
    originalRisk: matchExpressionRisks(
      match.scenario,
      answers.emotionId,
      answers.originalExpressionId,
      content.content.choices,
    ),
    expressionStructure: rewrite.structure,
    alternatives: rewrite.tones,
    repairLine: rewrite.repairLine,
    nextTimeLine: rewrite.nextTimeLine,
    nextSteps: rewrite.nextSteps,
    summary: rewrite.summary,
    shareSummary: rewrite.shareSummary,
    safetyNotice,
    contentVersion: content.contentVersion,
  }
}

const toneLabels: Record<ToneVariant, string> = {
  gentle: '柔和版',
  direct: '直接版',
  firm: '坚定边界版',
}

export function buildReplayCardViewModel(result: ReplayResult): ReplayCardViewModel {
  const tones: ToneVariant[] = ['gentle', 'direct', 'firm']
  return {
    eyebrow: result.safetyNotice ? '安全优先的复盘' : '本次沟通复盘',
    title: `“${result.scenarioTitle}”可以这样重新整理`,
    sections: [
      { id: 'risk', title: '原来哪里容易让人误解', body: result.originalRisk },
      { id: 'structure', title: '更适合的表达结构', body: result.expressionStructure },
      { id: 'repair', title: '现在可以怎样补一句', body: result.repairLine },
      { id: 'next-time', title: '下次可以怎样说', body: result.nextTimeLine },
      { id: 'summary', title: '这次复盘带走什么', body: result.summary },
    ],
    toneCards: tones.map((tone) => ({ tone, label: toneLabels[tone], text: result.alternatives[tone] })),
    actions: result.nextSteps,
    safetyNotice: result.safetyNotice
      ? {
          title: result.safetyNotice.title,
          message: result.safetyNotice.message,
          actions: result.safetyNotice.actions,
        }
      : undefined,
    shareSummary: result.shareSummary,
  }
}
