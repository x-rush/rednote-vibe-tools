export type TimelineStage =
  | 'slowing'
  | 'selected'
  | 'wind'
  | 'window-opening'
  | 'stars-entering'
  | 'settling'
  | 'resetting'
  | 'result'

export interface TimelineSample {
  readonly stage: TimelineStage
  readonly stageProgress: number
  readonly totalProgress: number
  readonly elapsedMs: number
  readonly selectionOffset: number
}

const activeStages = [
  'slowing',
  'selected',
  'wind',
  'window-opening',
  'stars-entering',
  'settling',
] as const satisfies readonly TimelineStage[]

const fullDurations = [1200, 700, 1500, 900, 2200, 2300] as const
const reducedDurations = [900, 500, 700, 600, 900, 700] as const

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value))
}

function slowingSelectionOffset(progress: number) {
  if (progress < 0.12) return -4
  if (progress < 0.3) return -3
  if (progress < 0.55) return -2
  if (progress < 0.82) return -1
  return 0
}

export function timelineDuration(reducedMotion: boolean) {
  return (reducedMotion ? reducedDurations : fullDurations).reduce((sum, duration) => sum + duration, 0)
}

export function sampleTimeline(elapsedMs: number, reducedMotion: boolean): TimelineSample {
  const durations = reducedMotion ? reducedDurations : fullDurations
  const total = timelineDuration(reducedMotion)
  const elapsed = clamp(elapsedMs, 0, total)
  if (elapsed >= total) {
    return { stage: 'result', stageProgress: 1, totalProgress: 1, elapsedMs: total, selectionOffset: 0 }
  }

  let start = 0
  for (let index = 0; index < activeStages.length; index += 1) {
    const duration = durations[index] as number
    const end = start + duration
    if (elapsed < end) {
      const stage = activeStages[index] as TimelineStage
      const stageProgress = clamp((elapsed - start) / duration)
      return {
        stage,
        stageProgress,
        totalProgress: elapsed / total,
        elapsedMs: elapsed,
        selectionOffset: stage === 'slowing' ? slowingSelectionOffset(stageProgress) : 0,
      }
    }
    start = end
  }
  return { stage: 'result', stageProgress: 1, totalProgress: 1, elapsedMs: total, selectionOffset: 0 }
}

export function resetSceneSample(progress: number): TimelineSample {
  const amount = clamp(progress)
  if (amount <= 0) return { stage: 'result', stageProgress: 1, totalProgress: 1, elapsedMs: timelineDuration(false), selectionOffset: 0 }
  if (amount >= 1) return { stage: 'slowing', stageProgress: 0, totalProgress: 0, elapsedMs: 0, selectionOffset: -4 }
  return {
    stage: 'resetting',
    stageProgress: amount,
    totalProgress: 1 - amount,
    elapsedMs: timelineDuration(false) * (1 - amount),
    selectionOffset: 0,
  }
}

export interface TimelineClock {
  start(): void
  pause(): void
  resume(): void
  reset(): void
  elapsed(): number
  isRunning(): boolean
}

export function createTimelineClock(now: () => number = () => performance.now()): TimelineClock {
  let running = false
  let startedAt = 0
  let accumulated = 0

  return {
    start() {
      accumulated = 0
      startedAt = now()
      running = true
    },
    pause() {
      if (!running) return
      accumulated += now() - startedAt
      running = false
    },
    resume() {
      if (running) return
      startedAt = now()
      running = true
    },
    reset() {
      accumulated = 0
      startedAt = now()
      running = false
    },
    elapsed() {
      return Math.max(0, accumulated + (running ? now() - startedAt : 0))
    },
    isRunning() {
      return running
    },
  }
}
