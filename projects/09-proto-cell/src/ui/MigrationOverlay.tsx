import { getContent, type JourneyStageDefinition } from '../content'

export function MigrationOverlay({
  routes,
  onSelect,
}: {
  routes: JourneyStageDefinition['routeOffers']
  onSelect: (routeId: string) => void
}) {
  const content = getContent()

  return (
    <section className="migration-overlay" aria-labelledby="migration-title">
      <header>
        <span>{content.ui.hud.journey}</span>
        <h2 id="migration-title">{content.ui.labels.journeyRoute}</h2>
      </header>
      <div className="migration-routes" role="group" aria-label={content.ui.labels.journeyRoute}>
        {routes.map((route, index) => {
          const environment = content.environments.find((item) => item.id === route.destinationEnvironmentId)
          return (
            <button className="migration-route" type="button" key={route.id} onClick={() => onSelect(route.id)}>
              <span className="migration-route__index">0{index + 1}</span>
              <strong>{environment?.name ?? route.destinationEnvironmentId}</strong>
              <span className="migration-route__fact migration-route__fact--reward">
                <b>{content.ui.labels.journeyReward}</b>
                {content.ui.labels[route.rewardId] ?? route.rewardId}
              </span>
              <span className="migration-route__fact migration-route__fact--risk">
                <b>{content.ui.labels.journeyRisk}</b>
                {content.ui.labels[route.riskId] ?? route.riskId}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
