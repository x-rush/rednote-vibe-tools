import { getContent } from '../content'
import type { HudSnapshot } from '../game/engine'
import { createHudViewModel } from '../app/view-model'
import { EcologyRadar, type RadarInput } from './EcologyRadar'

export function Hud({ snapshot, onPause, radar }: { snapshot: HudSnapshot; onPause: () => void; radar?: RadarInput }) {
  const content = getContent()
  const model = createHudViewModel(snapshot, content)

  return (
    <div className="game-hud">
      <section className="game-hud__panel" aria-label={content.ui.hud.combatStatus}>
        <dl className="game-hud__primary">
          <div>
            <dt>{content.ui.hud.engulfScore}</dt>
            <dd>{model.score}</dd>
          </div>
          <div>
            <dt>{content.ui.hud.journey}</dt>
            <dd>{model.formName} · {model.journey}</dd>
          </div>
        </dl>
        <div className="game-hud__secondary">
          <div className="game-hud__stage">
            <div><span>{content.ui.hud.bodyStage}</span><strong>{model.bodyStageName}</strong></div>
            <i
              aria-label={content.ui.hud.bodyStageProgress}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={model.bodyStageProgress}
            ><b style={{ width: `${model.bodyStageProgress}%` }} /></i>
            <i aria-label={content.ui.hud.evolution} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={model.tierProgress}><b style={{ width: `${model.tierProgress}%` }} /></i>
          </div>
          <dl className="game-hud__membrane">
            <div>
              <dt>{content.ui.hud.membraneIntegrity}</dt>
              <dd>{model.membrane}</dd>
            </div>
          </dl>
        </div>
      </section>
      <EcologyRadar input={radar ?? { world: { width: 1, height: 1 }, playerPosition: { x: 0, y: 0 }, warnedThreats: [] }} />
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
