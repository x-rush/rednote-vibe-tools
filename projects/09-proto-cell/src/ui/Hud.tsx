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
      {snapshot.swarm && (
        <div className="game-hud__swarm" role="status">
          <strong>{content.ui.hud.swarm} ×{snapshot.swarm.bodyCount}</strong>
          <span>{snapshot.swarm.minimumRemainingMs > 0
            ? `${content.ui.hud.swarmStabilizing} ${Math.ceil(snapshot.swarm.minimumRemainingMs / 1000)}s`
            : content.ui.hud.swarmHint}</span>
          <i aria-hidden="true"><b style={{ width: `${snapshot.swarm.fusionProgress * 100}%` }} /></i>
        </div>
      )}
      <button className="game-hud__pause top-control" type="button" onClick={onPause} aria-label={content.ui.actions.pause}>
        <span aria-hidden="true">Ⅱ</span>
      </button>
    </div>
  )
}
