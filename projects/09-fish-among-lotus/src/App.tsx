import { useEffect, useState } from 'react'
import { Pond } from './canvas/Pond.tsx'
import content from './content/content.json'

type SegmentedControlProps = {
  label: string
  value: number
  names: string[]
  onChange: (value: number) => void
}

function SegmentedControl({ label, value, names, onChange }: SegmentedControlProps) {
  return (
    <fieldset className="control">
      <legend>{label}</legend>
      <div className="segments">
        {names.map((name, option) => (
          <button
            type="button"
            key={name}
            className={value === option ? 'active' : ''}
            onClick={() => onChange(option)}
            aria-pressed={value === option}
          >
            {name}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function App() {
  const [leafLevel, setLeafLevel] = useState(1)
  const [fishLevel, setFishLevel] = useState(1)
  const [speedLevel, setSpeedLevel] = useState(1)
  const [resetKey, setResetKey] = useState(0)
  const [following, setFollowing] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [hintDismissed, setHintDismissed] = useState(false)

  useEffect(() => {
    document.title = content.title
    const timer = window.setTimeout(() => setHintDismissed(true), 4600)
    return () => window.clearTimeout(timer)
  }, [])

  const hintVisible = following || !hintDismissed

  return (
    <main className={`app-shell ${panelOpen ? 'panel-open' : ''}`}>
      <Pond
        leafLevel={leafLevel}
        fishLevel={fishLevel}
        speedLevel={speedLevel}
        resetKey={resetKey}
        ariaLabel={content.canvasLabel}
        keyboardHint={content.keyboardHint}
        onFollowing={setFollowing}
        onHintUsed={() => setHintDismissed(true)}
      />

      <header className="masthead">
        <p className="eyebrow">{content.eyebrow}</p>
        <h1 aria-label={content.title}>
          <span className="title-lead" aria-hidden="true">{content.titleLead}</span>
          <span className="title-tail" aria-hidden="true">{content.titleTail}</span>
        </h1>
        <p className="subtitle">{content.subtitle}</p>
      </header>

      <aside className="poster-note" aria-label={content.posterNoteLabel}>
        <span>{content.posterEnglish}</span>
        <i aria-hidden="true" />
        <span>{content.posterSeries}</span>
      </aside>

      <p className="edition-note">{content.editionNote}</p>

      {hintVisible && (
        <div className={`touch-hint ${following ? 'following' : ''}`} aria-live="polite">
          <span className="ripple-icon" aria-hidden="true" />
          {following ? content.hintActive : content.hintIdle}
        </div>
      )}

      <section className={`settings ${panelOpen ? 'open' : 'closed'}`} aria-label={content.settingsLabel}>
        <button
          className="panel-toggle"
          type="button"
          onClick={() => setPanelOpen((value) => !value)}
          aria-expanded={panelOpen}
          aria-controls="pond-settings"
        >
          <span>{panelOpen ? content.hideLabel : content.showLabel}</span>
          <b aria-hidden="true">{panelOpen ? '↓' : '↑'}</b>
        </button>
        <div className="settings-body" id="pond-settings" hidden={!panelOpen}>
          <div className="settings-title"><span>{content.settingsTitle}</span><i aria-hidden="true" /></div>
          <div className="control-grid">
            <SegmentedControl label={content.lotusLabel} value={leafLevel} onChange={setLeafLevel} names={content.amountNames} />
            <SegmentedControl label={content.fishLabel} value={fishLevel} onChange={setFishLevel} names={content.amountNames} />
            <SegmentedControl label={content.speedLabel} value={speedLevel} onChange={setSpeedLevel} names={content.speedNames} />
          </div>
          <button className="reset" type="button" onClick={() => setResetKey((value) => value + 1)}>
            {content.resetLabel}<span aria-hidden="true">↻</span>
          </button>
        </div>
      </section>
    </main>
  )
}

export default App
