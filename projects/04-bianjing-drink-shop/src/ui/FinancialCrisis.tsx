import type { FinancialCrisisView } from '../state/view-model'
import { AyuanStage } from './AyuanStage'
import { actorAssetPath } from './actor-assets'

type Copy = Record<string, string>

export function FinancialCrisis({ crisis, copy, isSubmitting, onAccept, onAcknowledge }: {
  crisis: FinancialCrisisView
  copy: Copy
  isSubmitting: boolean
  onAccept: (contractId: string) => void
  onAcknowledge: () => void
}) {
  if (crisis.pendingScene) {
    const actorAsset = actorAssetPath(crisis.pendingScene.actorRole)
    const actionLabel = crisis.pendingScene.trigger === 'grace-failure'
      ? copy.crisisCloseContinue
      : crisis.pendingScene.trigger === 'target-failure'
        ? copy.crisisFailureContinue
        : crisis.pendingScene.trigger === 'target-success' && crisis.phase !== 'grace'
          ? copy.crisisSuccessContinue
        : copy.crisisContinue
    return <article className="paper-panel crisis-panel crisis-scene" aria-labelledby="crisis-scene-title">
    <p className="section-kicker">{crisis.pendingScene.actorLabel}</p>
    <h1 id="crisis-scene-title">{crisis.pendingScene.title}</h1>
    <div className={`event-character-stage crisis-character-stage${actorAsset ? '' : ' event-character-stage-text-only'}`}>
      {actorAsset && <img className="event-actor" src={actorAsset} alt={crisis.pendingScene.actorLabel} />}
      <div className="crisis-scene-dialogue"><strong>{crisis.pendingScene.actorLabel}</strong><p className="event-body">{crisis.pendingScene.content}</p></div>
    </div>
    {crisis.graceDaysRemaining !== undefined && <p className="crisis-grace">{copy.crisisGraceLabel} · {crisis.graceDaysRemaining} 日</p>}
    <button className="primary-action" type="button" onClick={onAcknowledge}>{actionLabel}</button>
  </article>
  }

  return <article className="paper-panel crisis-panel" aria-labelledby="crisis-title">
    <p className="section-kicker">{copy.crisisGraceLabel} · 3 日</p>
    <h1 id="crisis-title">{crisis.title}</h1>
    <AyuanStage variant="crisis" tone="warning" name="阿沅" role="饮子铺店伙计 · 记账搭档" text={crisis.status} />
    {crisis.rescueUsed && <p className="notice" role="status">{copy.crisisUsed}</p>}
    <div className="crisis-contracts">
      {crisis.contracts.map((contract) => <section className={`crisis-contract${contract.eligible ? '' : ' crisis-contract-locked'}`} key={contract.contractId}>
        <h2>{contract.title}</h2>
        <p>{contract.content}</p>
        <dl>
          <div><dt>{copy.crisisImmediateBenefit}</dt><dd className="positive">{contract.immediateBenefit}</dd></div>
          <div><dt>{copy.crisisObligationLabel}</dt><dd>{contract.obligation}</dd></div>
        </dl>
        {!contract.eligible && <p className="contract-ineligible">{copy.crisisIneligible}</p>}
        <button type="button" className="primary-action" disabled={!contract.eligible || crisis.rescueUsed || isSubmitting} onClick={() => onAccept(contract.contractId)}>{copy.crisisAccept}</button>
      </section>)}
    </div>
  </article>
}
