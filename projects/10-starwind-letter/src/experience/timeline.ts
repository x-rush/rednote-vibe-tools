export type TimelineStage = 'wind' | 'curtain-opening' | 'stars-and-letters' | 'resetting' | 'result'

export interface TimelineSample {
  readonly stage: TimelineStage
  readonly stageProgress: number
  readonly totalProgress: number
  readonly elapsedMs: number
  readonly narrativeElapsedMs: number
  readonly resultElapsedMs: number
}

const activeStages = ['wind', 'curtain-opening', 'stars-and-letters'] as const
const fullDurations = [300, 1500, 4700] as const
const reducedDurations = [200, 900, 1900] as const

const clamp = (value: number, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value))

export function timelineDuration(reducedMotion: boolean) {
  return (reducedMotion ? reducedDurations : fullDurations).reduce((sum, duration) => sum + duration, 0)
}

export function sampleTimeline(inputElapsedMs: number, reducedMotion: boolean): TimelineSample {
  const durations = reducedMotion ? reducedDurations : fullDurations
  const total = timelineDuration(reducedMotion)
  const elapsedMs = Math.max(0, inputElapsedMs)
  const narrativeElapsedMs = Math.min(total, elapsedMs)
  const resultElapsedMs = Math.max(0, elapsedMs - total)
  if (narrativeElapsedMs >= total) {
    return { stage: 'result', stageProgress: 1, totalProgress: 1, elapsedMs, narrativeElapsedMs, resultElapsedMs }
  }
  let start = 0
  for (let index = 0; index < activeStages.length; index += 1) {
    const duration = durations[index] as number
    if (narrativeElapsedMs < start + duration) {
      return {
        stage: activeStages[index] as TimelineStage,
        stageProgress: clamp((narrativeElapsedMs - start) / duration),
        totalProgress: narrativeElapsedMs / total,
        elapsedMs,
        narrativeElapsedMs,
        resultElapsedMs,
      }
    }
    start += duration
  }
  return { stage: 'result', stageProgress: 1, totalProgress: 1, elapsedMs, narrativeElapsedMs, resultElapsedMs }
}

export function resetSceneSample(progress: number): TimelineSample {
  const amount = clamp(progress)
  const total = timelineDuration(false)
  if (amount <= 0) return { stage: 'result', stageProgress: 1, totalProgress: 1, elapsedMs: total, narrativeElapsedMs: total, resultElapsedMs: 0 }
  if (amount >= 1) return sampleTimeline(0, false)
  const narrativeElapsedMs = total * (1 - amount)
  return { stage: 'resetting', stageProgress: amount, totalProgress: 1 - amount, elapsedMs: narrativeElapsedMs, narrativeElapsedMs, resultElapsedMs: 0 }
}

export interface TimelineClock {
  start(): void; pause(): void; resume(): void; reset(): void; elapsed(): number; isRunning(): boolean
}

export function createTimelineClock(now: () => number = () => performance.now()): TimelineClock {
  let running = false; let startedAt = 0; let accumulated = 0
  return {
    start() { accumulated = 0; startedAt = now(); running = true },
    pause() { if (running) { accumulated += now() - startedAt; running = false } },
    resume() { if (!running) { startedAt = now(); running = true } },
    reset() { accumulated = 0; startedAt = now(); running = false },
    elapsed() { return Math.max(0, accumulated + (running ? now() - startedAt : 0)) },
    isRunning() { return running },
  }
}
