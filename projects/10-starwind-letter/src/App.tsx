import { useEffect, useRef, useState } from 'react'
import { createAudioController } from './audio/controller'
import { messages, type StarMessage } from './content/messages'
import { chooseNextMessage } from './domain/random'
import { transition, type ExperienceState } from './experience/machine'
import { createTimelineClock, RESET_DURATION_MS, sampleResetTimeline, sampleTimeline, type TimelineStage } from './experience/timeline'
import { Scene } from './scene/Scene'
import { StarbornePhrase } from './ui/StarbornePhrase'
import { ReplayControl } from './ui/ReplayControl'
import { SoundToggle } from './ui/SoundToggle'

const stageOrder: readonly TimelineStage[] = [
  'wind', 'curtain-opening', 'stars-and-letters', 'result',
]

function advanceToStage(state: ExperienceState, stage: TimelineStage) {
  if (stage === 'resetting') return state
  let next = state
  for (let guard = 0; guard < stageOrder.length && next.tag !== stage; guard += 1) {
    const advanced = transition(next, { type: 'advance' })
    if (advanced === next) break
    next = advanced
  }
  return next
}

export function App() {
  const [state, setState] = useState<ExperienceState>({ tag: 'idle', run: 0 })
  const [selected, setSelected] = useState<StarMessage>()
  const [sample, setSample] = useState(() => sampleTimeline(0, false))
  const [reducedMotion, setReducedMotion] = useState(false)
  const [muted, setMuted] = useState(() => typeof window !== 'undefined' && window.localStorage.getItem('starwind-muted') === 'true')
  const recentIds = useRef<string[]>([])
  const clock = useRef(createTimelineClock())
  const resetClock = useRef(createTimelineClock())
  const audio = useRef(createAudioController(() => new AudioContext()))
  const lastCueStage = useRef<TimelineStage | undefined>(undefined)
  const resetFrame = useRef<number | undefined>(undefined)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => { audio.current.setMuted(muted) }, [muted])

  useEffect(() => () => {
    if (resetFrame.current !== undefined) cancelAnimationFrame(resetFrame.current)
  }, [])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        clock.current.pause()
        resetClock.current.pause()
        audio.current.pause()
      } else if (state.tag === 'resetting') {
        resetClock.current.resume()
        audio.current.resume()
      } else if (selected) {
        clock.current.resume()
        audio.current.resume()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [selected, state.tag])

  useEffect(() => {
    if (lastCueStage.current === sample.stage) return
    lastCueStage.current = sample.stage
    if (sample.stage === 'stars-and-letters') audio.current.cue('stars')
  }, [sample.stage])

  useEffect(() => {
    if (!selected || state.tag === 'resetting') return
    let frame = 0
    const update = () => {
      const nextSample = sampleTimeline(clock.current.elapsed(), reducedMotion)
      setSample(nextSample)
      setState((current) => advanceToStage(current, nextSample.stage))
      frame = requestAnimationFrame(update)
    }
    frame = requestAnimationFrame(update)
    return () => cancelAnimationFrame(frame)
  }, [reducedMotion, selected, state.run, state.tag])

  const beginExperience = () => {
    if (state.tag !== 'idle') return
    const next = chooseNextMessage(messages, recentIds.current, Math.random)
    recentIds.current = [...recentIds.current, next.id].slice(-8)
    setSelected(next)
    setState((current) => transition(current, { type: 'begin', messageId: next.id }))
    setSample(sampleTimeline(0, reducedMotion))
    clock.current.start()
    audio.current.activate()
    audio.current.cue('wind')
  }

  const toggleSound = () => {
    const nextMuted = !muted
    setMuted(nextMuted)
    audio.current.setMuted(nextMuted)
    window.localStorage.setItem('starwind-muted', String(nextMuted))
    if (!nextMuted) audio.current.activate()
  }

  const replay = () => {
    if (state.tag !== 'result') return
    if (resetFrame.current !== undefined) cancelAnimationFrame(resetFrame.current)
    setState((current) => transition(current, { type: 'replay' }))
    resetClock.current.start()
    const reset = () => {
      const elapsedMs = resetClock.current.elapsed()
      setSample(sampleResetTimeline(elapsedMs))
      if (elapsedMs < RESET_DURATION_MS) {
        resetFrame.current = requestAnimationFrame(reset)
        return
      }
      resetFrame.current = undefined
      resetClock.current.reset()
      clock.current.reset()
      lastCueStage.current = undefined
      setSelected(undefined)
      setSample(sampleTimeline(0, reducedMotion))
      setState((current) => transition(current, { type: 'reset-complete' }))
    }
    resetFrame.current = requestAnimationFrame(reset)
  }

  return (
    <main className="app-shell">
      <Scene sample={sample} mood={selected?.mood} run={state.run} reducedMotion={reducedMotion} particlesEnabled={state.tag !== 'resetting'}>
        {state.tag === 'idle' && <button className="scene-trigger" type="button" aria-label="让星风捎来一句话" onClick={beginExperience} />}
        <SoundToggle muted={muted} onToggle={toggleSound} />
        <p className="scene-title">星风来信</p>
        {selected && state.tag !== 'resetting' && (
          <StarbornePhrase
            message={selected}
            progress={state.tag === 'stars-and-letters' ? sample.stageProgress : state.tag === 'result' ? 1 : 0}
            complete={state.tag === 'result'}
            reducedMotion={reducedMotion}
          />
        )}
        {state.tag === 'idle' && <p className="intro-hint">点击，让星风捎来一句话</p>}
        {state.tag === 'result' && <ReplayControl onReplay={replay} />}
      </Scene>
    </main>
  )
}
