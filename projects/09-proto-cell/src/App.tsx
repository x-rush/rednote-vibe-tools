import content from './content/content.json'
import './App.css'

function App() {
  return (
    <main className="hatchery-shell">
      <div className="hatchery-ambient" aria-hidden="true" />
      <section className="hatchery-card" aria-labelledby="game-title">
        <p className="hatchery-region">{content.ui.labels.openingRegion}</p>
        <div className="prototype-cell" role="img" aria-label={content.ui.labels.prototypeCell}>
          <span className="prototype-cell__membrane" />
          <span className="prototype-cell__core" />
          <span className="prototype-cell__organelle prototype-cell__organelle--one" />
          <span className="prototype-cell__organelle prototype-cell__organelle--two" />
        </div>
        <div className="hatchery-copy">
          <h1 id="game-title">{content.meta.title}</h1>
          <p>{content.meta.tagline}</p>
        </div>
        <button className="hatchery-start" type="button">
          {content.ui.actions.start}
        </button>
        <small>{content.meta.fictionDisclaimer}</small>
      </section>
    </main>
  )
}

export default App
