import type { DimensionDefinition } from '../content/types'
import type { DimensionResult } from './types'

export type DimensionDisplay = {
  title: string
  left: string
  right: string
  preferred: string
  strengthLabel: DimensionResult['label']
}

export function toDimensionDisplay(result: DimensionResult, definition: DimensionDefinition): DimensionDisplay {
  const [left, right] = definition.poles
  return {
    title: definition.displayName,
    left: left.name,
    right: right.name,
    preferred: result.preferredPole === left.code ? left.name : right.name,
    strengthLabel: result.label,
  }
}

export function formatResultIdentity(creatureName: string, typeName: string) {
  return `${creatureName} · ${typeName}`
}
