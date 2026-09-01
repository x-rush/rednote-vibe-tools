import { useEffect, useMemo, useRef, useState } from 'react'
import { messages, type StarMessage } from './content/messages'
import { chooseNextMessage } from './domain/random'
import { transition, type ExperienceState } from './experience/machine'
import { createTimelineClock, sampleTimeline, type TimelineStage } from './experience/timeline'
import { Scene } from './scene/Scene'
import { PhraseCarousel } from './ui/PhraseCarousel'

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
  const recentIds = useRef<string[]>([])
  const clock = useRef(createTimelineClock())

  useEffect(() => {
    if (state.tag !== 'spinning') return
    const timer = window.setInterval(() => setSpinIndex((index) => (index + 1) % messages.length), 105)
    return () => window.clearInterval(timer)
  }, [state.tag])

  useEffect(() => {
    if (!selected) return
    let frame = 0
    const update = () => {
      const nextSample = sampleTimeline(clock.current.elapsed(), false)
      setSample(nextSample)
      setState((current) => advanceToStage(current, nextSample.stage))
      if (nextSample.stage !== 'result') frame = requestAnimationFrame(update)
    }
    frame = requestAnimationFrame(update)
    return () => cancelAnimationFrame(frame)
  }, [selected, state.run])

  const visibleMessages = useMemo(() => {
    if (selected && state.tag !== 'spinning') {
      return centeredMessages(messages.findIndex(({ id }) => id === selected.id))
    }
    return centeredMessages(spinIndex)
  }, [selected, spinIndex, state.tag])

  const selectPhrase = () => {
    if (state.tag !== 'spinning') return
    const next = chooseNextMessage(messages, recentIds.current, Math.random)
    recentIds.current = [...recentIds.current, next.id].slice(-8)
    setSelected(next)
    setState((current) => transition(current, { type: 'select', messageId: next.id }))
    setSample(sampleTimeline(0, false))
    clock.current.start()
  }

  return (
    <main className="app-shell" onClick={selectPhrase}>
      <Scene sample={sample}>
        <p className="scene-title">星风来信</p>
        <PhraseCarousel
          state={state}
          selected={selected}
          visibleMessages={visibleMessages}
          progress={sample.stageProgress}
        />
        {state.tag === 'spinning' && <p className="intro-hint">点击，让星空为你留下一句话</p>}
      </Scene>
    </main>
  )
}
