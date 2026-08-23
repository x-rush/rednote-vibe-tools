export const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

export const clampStat = (value: number) => clamp(value, 0, 100)
export const roundVisitors = (value: number) => Math.max(0, Math.round(value))
export const floorMoney = (value: number) => Math.floor(value)
export const ceilEnergy = (value: number) => Math.ceil(value)
