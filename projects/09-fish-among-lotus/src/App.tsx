import { useEffect, useRef, useState } from 'react'
import { Pond } from './canvas/Pond.tsx'
import { validateBackgroundFile } from './canvas/background.ts'
import type { PosterBackground } from './canvas/draw.ts'
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
  const [background, setBackground] = useState<PosterBackground | null>(null)
  const [backgroundError, setBackgroundError] = useState<string | null>(null)
  const backgroundRef = useRef<ImageBitmap | null>(null)
  const retiredBackgroundsRef = useRef<ImageBitmap[]>([])
  const uploadRef = useRef<HTMLInputElement>(null)
  const uploadSequenceRef = useRef(0)

  useEffect(() => {
    document.title = content.title
    const timer = window.setTimeout(() => setHintDismissed(true), 4600)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    for (const image of retiredBackgroundsRef.current) image.close()
    retiredBackgroundsRef.current.length = 0
  }, [background])

  useEffect(() => () => {
    uploadSequenceRef.current += 1
    backgroundRef.current?.close()
    for (const image of retiredBackgroundsRef.current) image.close()
    retiredBackgroundsRef.current.length = 0
  }, [])

  const chooseBackground = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    const sequence = ++uploadSequenceRef.current
    const validationError = validateBackgroundFile(file)
    if (validationError) {
      setBackgroundError(validationError === 'type' ? content.backgroundTypeError : content.backgroundSizeError)
      return
    }

    try {
      const image = await createImageBitmap(file)
      if (sequence !== uploadSequenceRef.current) {
        image.close()
        return
      }
      if (backgroundRef.current) retiredBackgroundsRef.current.push(backgroundRef.current)
      backgroundRef.current = image
      setBackground({ image, width: image.width, height: image.height })
      setBackgroundError(null)
    } catch {
      if (sequence === uploadSequenceRef.current) setBackgroundError(content.backgroundDecodeError)
    }
  }

  const clearBackground = () => {
    uploadSequenceRef.current += 1
    if (backgroundRef.current) retiredBackgroundsRef.current.push(backgroundRef.current)
    backgroundRef.current = null
    setBackground(null)
    setBackgroundError(null)
  }

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
        background={background}
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
          <input
            ref={uploadRef}
            hidden
            type="file"
            accept="image/*"
            onChange={chooseBackground}
          />
          <div className="poster-actions">
            <button className="background-button" type="button" onClick={() => uploadRef.current?.click()}>
              {background ? content.replaceBackgroundLabel : content.uploadBackgroundLabel}
            </button>
            {background && (
              <button className="background-button" type="button" onClick={clearBackground}>
                {content.clearBackgroundLabel}
              </button>
            )}
            <button className="reset" type="button" onClick={() => setResetKey((value) => value + 1)}>
              {content.resetLabel}<span aria-hidden="true">↻</span>
            </button>
          </div>
          {backgroundError && <p className="background-error" role="status">{backgroundError}</p>}
        </div>
      </section>
    </main>
  )
}

export default App
