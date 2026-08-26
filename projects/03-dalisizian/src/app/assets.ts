export type CharacterAssetSet = {
  master: string
  avatar: string
  placeholder: string
}

const characterAssets: Record<string, CharacterAssetSet> = {
  'asset-character-temple-official': {
    master: '/assets/characters/shenyan/shenyan-master-v3.webp',
    avatar: '/assets/characters/shenyan/shenyan-avatar-v3.webp',
    placeholder: '/assets/characters/shenyan/shenyan-placeholder-v3.webp',
  },
  'asset-character-record-clerk': {
    master: '/assets/characters/record-clerk/record-clerk-base-v1.webp',
    avatar: '/assets/characters/record-clerk/record-clerk-avatar-v1.webp',
    placeholder: '/assets/characters/record-clerk/record-clerk-placeholder-v1.webp',
  },
  'asset-character-home-witness': {
    master: '/assets/characters/home-witness/home-witness-base-v1.webp',
    avatar: '/assets/characters/home-witness/home-witness-avatar-v1.webp',
    placeholder: '/assets/characters/home-witness/home-witness-placeholder-v1.webp',
  },
}

const sceneByKind = {
  court: '/assets/scenes/home-court/home-court-v1.webp',
  archive: '/assets/scenes/official-records-room/records-room-v2.webp',
  street: '/assets/scenes/home-street/home-street-v1.webp',
} as const

export function resolveCharacterAsset(assetId: string): CharacterAssetSet | undefined {
  return characterAssets[assetId]
}

export function resolveSceneAsset(assetId: string): string | undefined {
  const kind = Object.keys(sceneByKind).find((item) => assetId.endsWith(`-${item}`)) as keyof typeof sceneByKind | undefined
  return kind ? sceneByKind[kind] : undefined
}
