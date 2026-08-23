import type { CaseNode, CaseRuntimeState, ConditionExpression, ContentIndex, NodeChoice } from '../content/types'

export function evaluateCondition(
  condition: ConditionExpression,
  state: CaseRuntimeState,
  completedCaseIds: string[] = [],
): boolean {
  if ('all' in condition) return condition.all.every((item) => evaluateCondition(item, state, completedCaseIds))
  if ('any' in condition) return condition.any.some((item) => evaluateCondition(item, state, completedCaseIds))
  if ('not' in condition) return !evaluateCondition(condition.not, state, completedCaseIds)
  if (condition.field === 'flags') return (state.flags[condition.key] ?? false) === condition.value
  if (condition.field === 'deductionAnswers') return state.deductionAnswers[condition.key] === condition.value

  const values = condition.field === 'completedCaseIds' ? completedCaseIds : state[condition.field]
  const includes = values.includes(condition.value)
  return condition.operator === 'includes' ? includes : !includes
}

export function getAvailableOptions(
  node: CaseNode,
  state: CaseRuntimeState,
  index: ContentIndex,
  completedCaseIds: string[] = [],
): NodeChoice[] {
  return (node.choices ?? []).filter((choice) => (
    index.nodes.has(choice.nextNodeId)
    && (!choice.condition || evaluateCondition(choice.condition, state, completedCaseIds))
  ))
}
