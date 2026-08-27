import type { EventActorRole } from '../domain/types'

const actorAssets: Partial<Record<EventActorRole, string>> = {
  worker: './assets/customers/market-worker.webp',
  merchant: './assets/customers/merchant.webp',
  scholar: './assets/customers/scholar.webp',
  youth: './assets/customers/youth.webp',
  elder: './assets/customers/elder.webp',
  'neighbor-woman': './assets/customers/neighbor-woman.webp',
  runner: './assets/customers/runner.webp',
}

export function actorAssetPath(role: EventActorRole): string | undefined {
  return actorAssets[role]
}
