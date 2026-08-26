export type SlipColumns = {
  factIds: string[]
  inferenceIds: string[]
  announcement?: string
}

function unique(items: string[]) {
  return [...new Set(items)]
}

export function moveSlip(state: SlipColumns, id: string, target: 'fact' | 'inference'): SlipColumns {
  return target === 'inference'
    ? {
        factIds: state.factIds.filter((item) => item !== id),
        inferenceIds: unique([...state.inferenceIds, id]),
        announcement: `已移到推测：${id}`,
      }
    : {
        factIds: unique([...state.factIds, id]),
        inferenceIds: state.inferenceIds.filter((item) => item !== id),
        announcement: `已移到事实：${id}`,
      }
}

export function undoMove(state: SlipColumns, id: string) {
  return moveSlip(state, id, 'fact')
}

export function toggleLimitedSelection(selected: string[], id: string, max: number) {
  if (selected.includes(id)) return selected.filter((item) => item !== id)
  return selected.length >= max ? selected : [...selected, id]
}
