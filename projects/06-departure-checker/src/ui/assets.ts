export const SCENARIO_ICON_PATHS = {
  'icon-scenario-commute': './assets/icons/scenario-commute.svg',
  'icon-scenario-short-trip': './assets/icons/scenario-short-trip.svg',
  'icon-scenario-exercise': './assets/icons/scenario-exercise.svg',
  'icon-scenario-date': './assets/icons/scenario-date.svg',
  'icon-scenario-with-child': './assets/icons/scenario-with-child.svg',
  'icon-scenario-with-pet': './assets/icons/scenario-with-pet.svg',
  'icon-scenario-appointment': './assets/icons/scenario-appointment.svg',
  'icon-scenario-event': './assets/icons/scenario-event.svg',
} as const

export const CATEGORY_ICON_PATHS = {
  'icon-category-essentials': './assets/icons/category-essentials.svg',
  'icon-category-electronics': './assets/icons/category-electronics.svg',
  'icon-category-weather': './assets/icons/category-weather.svg',
  'icon-category-health': './assets/icons/category-health.svg',
  'icon-category-work': './assets/icons/category-work.svg',
  'icon-category-sports': './assets/icons/category-sports.svg',
  'icon-category-child': './assets/icons/category-child.svg',
  'icon-category-pet': './assets/icons/category-pet.svg',
  'icon-category-event': './assets/icons/category-event.svg',
  'icon-category-confirmation': './assets/icons/category-confirmation.svg',
  'icon-category-custom': './assets/icons/category-custom.svg',
} as const

export const LOCATION_ICON_PATHS = {
  'icon-location-desk': './assets/icons/location-desk.svg',
  'icon-location-charging': './assets/icons/location-charging.svg',
  'icon-location-bedroom': './assets/icons/location-bedroom.svg',
  'icon-location-bathroom': './assets/icons/location-bathroom.svg',
  'icon-location-fridge': './assets/icons/location-fridge.svg',
  'icon-location-entryway': './assets/icons/location-entryway.svg',
  'icon-location-documents': './assets/icons/location-documents.svg',
  'icon-location-pet-area': './assets/icons/location-pet-area.svg',
  'icon-location-child-area': './assets/icons/location-child-area.svg',
} as const

export const STATUS_ICON_PATHS = {
  'icon-completion-stamp': './assets/icons/completion-stamp.svg',
  'icon-partial-available': './assets/icons/partial-available.svg',
} as const

export const GUIDE_ASSETS = {
  master: './assets/guide/guide-master-v2.webp',
  avatar: './assets/guide/guide-avatar-v2.webp',
} as const

const ASSET_PATHS = {
  ...SCENARIO_ICON_PATHS,
  ...CATEGORY_ICON_PATHS,
  ...LOCATION_ICON_PATHS,
  ...STATUS_ICON_PATHS,
}

export const assetPathFor = (assetId: string): string | undefined =>
  ASSET_PATHS[assetId as keyof typeof ASSET_PATHS]
