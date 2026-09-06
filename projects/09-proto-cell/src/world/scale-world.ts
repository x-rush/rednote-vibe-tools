export type WorldDimensions = { width: number; height: number }

/** The world is sized in body diameters so every form gets the same navigable feel. */
export function worldDimensionsForTier(tier: { radiusRange: readonly number[]; worldBodyWidths: number }): WorldDimensions {
  const radius = finitePositive(tier.radiusRange[1], 40)
  const bodyWidths = finitePositive(tier.worldBodyWidths, 22)
  const width = radius * 2 * bodyWidths
  return { width, height: width * 1.7 }
}

export function minimumPlayableWidth(radius: number, bodyWidths: number): number {
  return finitePositive(radius, 0) * 2 * Math.max(0, finitePositive(bodyWidths, 0))
}

function finitePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback
}
