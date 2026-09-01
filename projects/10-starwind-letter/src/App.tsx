import { useEffect, useMemo, useRef, useState } from 'react'
import { createAudioController } from './audio/controller'
import { messages, type StarMessage } from './content/messages'
import { chooseNextMessage } from './domain/random'
import { transition, type ExperienceState } from './experience/machine'
import { createTimelineClock, resetSceneSample, sampleTimeline, type TimelineStage } from './experience/timeline'
import { Scene } from './scene/Scene'
import { PhraseCarousel } from './ui/PhraseCarousel'
import { ReplayControl } from './ui/ReplayControl'
import { SoundToggle } from './ui/SoundToggle'

const stageOrder: readonly TimelineStage[] = [
  'slowing', 'selected', 'wind', 'window-opening', 'stars-entering', 'settling', 'result',
]

function targetTag(stage: TimelineStage) {
  return stage === 'settling' ? 'stars-entering' : stage
}

function advanceToStage(state: ExperienceState, stage: TimelineStage) {
  const desired = targetTag(stage)
  let next = state
  for (let guard = 0; guard < stageOrder.length && next.tag !== desired; guard += 1) {
    const advanced = transition(next, { type: 'advance' })
    if (advanced === next) break
    next = advanced
  }
  return next
}

function centeredMessages(center: number): readonly StarMessage[] {
  return Array.from({ length: 5 }, (_, offset) => messages[(center + offset - 2 + messages.length) % messages.length] as StarMessage)
}

export function App() {
  const [state, setState] = useState<ExperienceState>({ tag: 'spinning', run: 0 })
  const [spinIndex, setSpinIndex] = useState(2)
  const [selected, setSelected] = useState<StarMessage>()
  const [sample, setSample] = useState(() => sampleTimeline(0, false))
  const [reducedMotion, setReducedMotion] = useState(false)
  const [muted, setMuted] = useState(() => typeof window !== 'undefined' && window.localStorage.getItem('starwind-muted') === 'true')
  const recentIds = useRef<string[]>([])
  const clock = useRef(createTimelineClock())
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
        audio.current.pause()
      } else if (selected && state.tag !== 'result' && state.tag !== 'resetting') {
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
    if (sample.stage === 'wind') audio.current.cue('wind')
    if (sample.stage === 'window-opening') audio.current.cue('frame')
    if (sample.stage === 'stars-entering') audio.current.cue('stars')
  }, [sample.stage])

  useEffect(() => {
    if (state.tag !== 'spinning') return
    const timer = window.setInterval(
      () => setSpinIndex((index) => (index + 1) % messages.length),
      reducedMotion ? 180 : 72,
    )
    return () => window.clearInterval(timer)
  }, [reducedMotion, state.tag])

  useEffect(() => {
    if (!selected) return
    let frame = 0
    const update = () => {
      const nextSample = sampleTimeline(clock.current.elapsed(), reducedMotion)
      setSample(nextSample)
      setState((current) => advanceToStage(current, nextSample.stage))
      if (nextSample.stage !== 'result') frame = requestAnimationFrame(update)
    }
    frame = requestAnimationFrame(update)
    return () => cancelAnimationFrame(frame)
  }, [reducedMotion, selected, state.run])

  const visibleMessages = useMemo(() => {
    if (selected && state.tag !== 'spinning') {
      const finalIndex = messages.findIndex(({ id }) => id === selected.id)
      const centerIndex = state.tag === 'slowing' ? finalIndex + sample.selectionOffset : finalIndex
      return centeredMessages(centerIndex)
    }
    return centeredMessages(spinIndex)
  }, [sample.selectionOffset, selected, spinIndex, state.tag])

  const selectPhrase = () => {
    if (state.tag !== 'spinning') return
    const next = chooseNextMessage(messages, recentIds.current, Math.random)
    recentIds.current = [...recentIds.current, next.id].slice(-8)
    setSelected(next)
    setState((current) => transition(current, { type: 'select', messageId: next.id }))
    setSample(sampleTimeline(0, reducedMotion))
    clock.current.start()
    audio.current.activate()
    audio.current.cue('select')
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
    const startedAt = performance.now()
    const reset = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 1500)
      setSample(resetSceneSample(progress))
      if (progress < 1) {
        resetFrame.current = requestAnimationFrame(reset)
        return
      }
      resetFrame.current = undefined
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
        {state.tag === 'spinning' && <button className="scene-trigger" type="button" onClick={selectPhrase}>让星空停下一句话</button>}
        <SoundToggle muted={muted} onToggle={toggleSound} />
        <p className="scene-title">星风来信</p>
        <PhraseCarousel
          state={state}
          selected={selected}
          visibleMessages={visibleMessages}
          progress={sample.stageProgress}
        />
        {state.tag === 'spinning' && <p className="intro-hint">点击，让星空为你留下一句话</p>}
        {state.tag === 'result' && <ReplayControl onReplay={replay} />}
      </Scene>
    </main>
  )
}
