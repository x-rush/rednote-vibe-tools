const GUIDE_ASSET_PATHS = {
  'asset-guide-xuzhao-master': 'assets/wuhualu/guide/guide-master-v1.webp',
  'asset-guide-xuzhao-journal': 'assets/wuhualu/guide/guide-journal-v1.webp',
  'asset-guide-xuzhao-finale': 'assets/wuhualu/guide/guide-finale-v1.webp',
} as const

export type GuideAssetId = keyof typeof GUIDE_ASSET_PATHS

export function resolveGuideAsset(assetId: string): string {
  const path = GUIDE_ASSET_PATHS[assetId as GuideAssetId] ?? GUIDE_ASSET_PATHS['asset-guide-xuzhao-master']
  return `${import.meta.env.BASE_URL}${path}`
}
