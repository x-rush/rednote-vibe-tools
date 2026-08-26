import type { ConditionValue } from '../content/schema'

type ConditionRecord = Record<string, ConditionValue | ConditionValue[]>

type AnswerResolution = {
  conditions: ConditionRecord
  next: 'question' | 'generate'
}

export const resolveConditionAnswer = (
  conditions: ConditionRecord,
  key: string,
  value: ConditionValue | ConditionValue[],
  lastQuestion: boolean,
): AnswerResolution => ({
  conditions: { ...conditions, [key]: value },
  next: lastQuestion ? 'generate' : 'question',
})
