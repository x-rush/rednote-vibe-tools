import { messages } from './content/messages'
import { sampleTimeline } from './experience/timeline'
import { Scene } from './scene/Scene'

export function App() {
  return (
    <main className="app-shell">
      <Scene sample={sampleTimeline(0, false)}>
        <div className="intro-copy">
          <p className="intro-eyebrow">星风来信</p>
          <p className="intro-phrase">{messages[0]?.text}</p>
          <p className="intro-hint">点击，让星空为你留下一句话</p>
        </div>
      </Scene>
    </main>
  )
}
