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
      {snapshot.ecosystem && <section className="ecosystem-objective" aria-label={content.ui.hud.ecosystemObjective}>
        <div><strong>{snapshot.ecosystem.name}</strong><span>{content.ui.hud.ecologicalPressure} {Math.round(snapshot.ecosystem.pressure * 100)}%</span></div>
        <p>{snapshot.ecosystem.objective}</p>
        <div className="ecosystem-objective__progress"><span>{content.ui.hud.activeHunt} {Math.round(snapshot.ecosystem.activeBiomass)}/{snapshot.ecosystem.activeBiomassTarget}</span><span>{content.ui.hud.mutationsCompleted} {snapshot.ecosystem.mutationsCompleted}/{snapshot.ecosystem.mutationTarget}</span></div>
        <p className="ecosystem-objective__encounter" data-resolved={snapshot.ecosystem.encounterResolved}>{snapshot.ecosystem.encounterResolved ? content.ui.hud.encounterComplete : snapshot.ecosystem.encounterName} · {snapshot.ecosystem.encounterHint}</p>
        {snapshot.finaleStartedAtMs !== undefined ? <p className="ecosystem-objective__terrain" role="status">{content.ui.hud.finalFeast}</p> : snapshot.ecosystem.leviathanPhase && snapshot.ecosystem.leviathanPhase !== 'consumed' && <p className="ecosystem-objective__terrain" role="status" data-exposed={snapshot.ecosystem.leviathanPhase === 'exposed'}>{snapshot.ecosystem.leviathanPhase === 'exposed' ? content.ui.hud.leviathanExposed : content.ui.hud.leviathanArmored}</p>}
        {snapshot.wallContact && snapshot.territory?.canBreak && <p className="ecosystem-objective__terrain" role="status">{content.ui.hud.chamberBreak}</p>}
        {snapshot.territory?.concealed ? <p className="ecosystem-objective__terrain" role="status">{content.ui.hud.fiberCover}</p>
          : snapshot.fiberControl !== undefined && <p className="ecosystem-objective__terrain" role="status">{snapshot.territory?.canBreak ? content.ui.hud.fiberBreakReady : snapshot.fiberControl < 0.5 ? content.ui.hud.fiberSqueeze : content.ui.hud.fiberPush}</p>}
        {snapshot.territory && <div className="ecosystem-objective__territory"><span>{content.ui.hud.territorySight} {(snapshot.territory.sightRadius / (content.scaleTiers[0]!.radiusRange[0] * 2 * content.ecosystems[0]!.sightBodyWidths[0])).toFixed(1)}×</span>{snapshot.territory.brokenFibers > 0 && <span>{content.ui.hud.fiberBroken} {snapshot.territory.brokenFibers}</span>}</div>}
        {snapshot.ecosystem.reversalCount > 0 && <strong className="ecosystem-objective__reversal">{content.ui.hud.reversalCount} {snapshot.ecosystem.reversalCount}</strong>}
      </section>}
      {radar && (radar.encounterPosition || radar.exitPosition || radar.warnedThreats.length > 0) && <EcologyRadar input={radar} />}
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
