import content from '../content/content.json'
import type { HudSnapshot } from '../game/engine'

export function Hud({ snapshot, onPause }: { snapshot: HudSnapshot; onPause: () => void }) {
  const metrics = [
    [content.ui.hud.membrane, snapshot.membrane],
    [content.ui.hud.energy, snapshot.energy],
    [content.ui.hud.stability, snapshot.stability],
    [content.ui.hud.biomass, snapshot.biomass],
  ] as const

  return (
    <div className="game-hud">
      <dl className="game-hud__metrics">
        {metrics.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{Math.round(value)}</dd>
          </div>
        ))}
      </dl>
      <div className="game-hud__evolution" aria-label={content.ui.hud.evolution}>
        <span style={{ width: `${Math.min(100, snapshot.biomass / snapshot.evolutionThreshold * 100)}%` }} />
      </div>
      <button className="game-hud__pause top-control" type="button" onClick={onPause} aria-label={content.ui.actions.pause}>
        <span aria-hidden="true">Ⅱ</span>
      </button>
    </div>
  )
}
