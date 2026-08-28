export type FixedClock = {
  advance(elapsedMs: number, step: (stepMs: number) => void): { steps: number; alpha: number }
  reset(): void
}

export function createFixedClock(options: { stepMs: number; maxSteps: number }): FixedClock {
  if (!Number.isFinite(options.stepMs) || options.stepMs <= 0) {
    throw new RangeError('stepMs must be positive')
  }
  if (!Number.isInteger(options.maxSteps) || options.maxSteps <= 0) {
    throw new RangeError('maxSteps must be a positive integer')
  }

  let accumulatorMs = 0

  return {
    advance(elapsedMs, step) {
      accumulatorMs += Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0)
      let steps = 0

      while (accumulatorMs >= options.stepMs && steps < options.maxSteps) {
        step(options.stepMs)
        accumulatorMs -= options.stepMs
        steps += 1
      }

      if (steps === options.maxSteps && accumulatorMs >= options.stepMs) {
        accumulatorMs = 0
      }

      return { steps, alpha: accumulatorMs / options.stepMs }
    },
    reset() {
      accumulatorMs = 0
    },
  }
}
