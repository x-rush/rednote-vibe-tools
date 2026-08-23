import type {
  ChoiceDefinition,
  CommunicationGoal,
  ConflictLevel,
  ConversationScenario,
  MatchLevel,
  RelationshipType,
  ReplayAnswers,
} from './types'

export type ScenarioMatch = {
  scenario: ConversationScenario
  level: MatchLevel
  reason: string
}

export function filterByRelationship(scenarios: ConversationScenario[], relationship: RelationshipType) {
  return scenarios.filter(({ relationshipType }) => relationshipType === relationship)
}

export function filterByGoal(scenarios: ConversationScenario[], goal: CommunicationGoal) {
  return scenarios.filter(({ communicationGoalIds }) => communicationGoalIds.includes(goal))
}

export function filterByConflictLevel(scenarios: ConversationScenario[], level: ConflictLevel) {
  return scenarios.filter(({ conflictLevel }) => conflictLevel === level)
}

export function matchExpressionRisks(
  scenario: ConversationScenario,
  emotionId: string,
  originalExpressionId: string,
  choices: ChoiceDefinition[],
) {
  const expression = choices.find(
    (choice) => choice.kind === 'original-expression' && choice.id === originalExpressionId,
  )
  const expressionRisks = expression?.kind === 'original-expression'
    ? expression.risks.flatMap(({ label, explanation }) => [label, explanation])
    : []
  const scenarioRisks = scenario.emotionIds.includes(emotionId) ? scenario.riskPoints : []
  return [...scenarioRisks, ...expressionRisks]
}

function scoreScenario(scenario: ConversationScenario, answers: ReplayAnswers) {
  return Number(scenario.relationshipType === answers.relationshipType) * 16
    + Number(scenario.communicationGoalIds.includes(answers.communicationGoal)) * 8
    + Number(scenario.conflictLevel === answers.conflictLevel) * 4
    + Number(scenario.emotionIds.includes(answers.emotionId)) * 2
    + Number(scenario.originalExpressionIds.includes(answers.originalExpressionId)) * 2
    + Number(scenario.responseIds.includes(answers.responseId))
}

function stableFirst(scenarios: ConversationScenario[], answers?: ReplayAnswers) {
  return [...scenarios].sort((left, right) => {
    const scoreDifference = answers ? scoreScenario(right, answers) - scoreScenario(left, answers) : 0
    return scoreDifference || left.scenarioId.localeCompare(right.scenarioId)
  })[0]
}

function candidate(
  scenarios: ConversationScenario[],
  checks: Array<(scenario: ConversationScenario) => boolean>,
  answers: ReplayAnswers,
) {
  return stableFirst(scenarios.filter((scenario) => checks.every((check) => check(scenario))), answers)
}

const reasons: Record<MatchLevel, string> = {
  exact: '完整匹配关系、目标、冲突程度、情绪和原表达，以及对方反应。',
  'response-relaxed': '关系、目标、冲突程度、情绪和原表达匹配；对方反应使用相邻情境。',
  'emotion-relaxed': '关系、目标、冲突程度和原表达匹配；情绪使用相邻情境。',
  'conflict-relaxed': '关系、目标和原表达匹配；冲突程度使用相邻情境。',
  'relationship-goal': '没有更精确组合，保留关系和沟通目标。',
  'goal-only': '没有相同关系情境，保留沟通目标。',
  general: '没有精确组合，使用通用且安全的复盘结构。',
}

export function selectBestScenario(scenarios: ConversationScenario[], answers: ReplayAnswers): ScenarioMatch {
  if (scenarios.length === 0) throw new Error('没有可用情境')

  if (answers.conflictLevel === 'safety') {
    const safety = stableFirst(scenarios.filter(
      ({ relationshipType, safetyLevel }) => relationshipType === answers.relationshipType && safetyLevel === 'safety',
    )) ?? stableFirst(scenarios.filter(({ safetyLevel }) => safetyLevel === 'safety'))
    if (safety) return { scenario: safety, level: 'exact', reason: '安全选项优先进入安全情境。' }
  }

  if (answers.scenarioId) {
    const selected = scenarios.find(({ scenarioId }) => scenarioId === answers.scenarioId)
    if (selected) return { scenario: selected, level: 'exact', reason: '使用用户明确选择的情境。' }
  }

  const relationship = (scenario: ConversationScenario) => scenario.relationshipType === answers.relationshipType
  const goal = (scenario: ConversationScenario) => scenario.communicationGoalIds.includes(answers.communicationGoal)
  const conflict = (scenario: ConversationScenario) => scenario.conflictLevel === answers.conflictLevel
  const emotion = (scenario: ConversationScenario) => scenario.emotionIds.includes(answers.emotionId)
  const expression = (scenario: ConversationScenario) => scenario.originalExpressionIds.includes(answers.originalExpressionId)
  const response = (scenario: ConversationScenario) => scenario.responseIds.includes(answers.responseId)
  const phases: Array<{ level: MatchLevel; checks: Array<(scenario: ConversationScenario) => boolean> }> = [
    { level: 'exact', checks: [relationship, goal, conflict, emotion, expression, response] },
    { level: 'response-relaxed', checks: [relationship, goal, conflict, emotion, expression] },
    { level: 'emotion-relaxed', checks: [relationship, goal, conflict, expression] },
    { level: 'conflict-relaxed', checks: [relationship, goal, expression] },
    { level: 'relationship-goal', checks: [relationship, goal] },
    { level: 'goal-only', checks: [goal] },
  ]
  for (const phase of phases) {
    const scenario = candidate(scenarios, phase.checks, answers)
    if (scenario) return { scenario, level: phase.level, reason: reasons[phase.level] }
  }

  const fallback = stableFirst(scenarios.filter(({ relationshipType }) => relationshipType === 'general'))
    ?? stableFirst(scenarios)
  return { scenario: fallback, level: 'general', reason: reasons.general }
}
