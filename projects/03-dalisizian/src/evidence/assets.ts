export type EvidenceAssetSet = Readonly<{
  primary: string
  fallback: string
}>

function evidenceAsset(primary: string, fallback = primary.replace(/-v\d+\.(?:svg|webp)$/, '-v1.svg')): EvidenceAssetSet {
  return Object.freeze({ primary, fallback })
}

const evidenceAssets: Readonly<Record<string, EvidenceAssetSet>> = Object.freeze({
  'asset-evidence-home-early-form': evidenceAsset('./assets/evidence/home/asset-evidence-home-early-form-v3.webp'),
  'asset-evidence-home-shuowen': evidenceAsset('./assets/evidence/home/asset-evidence-home-shuowen-v3.webp'),
  'asset-evidence-home-phonetic': evidenceAsset('./assets/evidence/home/asset-evidence-home-phonetic-v3.webp'),
  'asset-evidence-home-social-leap': evidenceAsset('./assets/evidence/home/asset-evidence-home-social-leap-v3.webp'),
  'asset-evidence-rest-components': evidenceAsset('./assets/evidence/rest/asset-evidence-rest-components-v3.webp'),
  'asset-evidence-rest-gloss': evidenceAsset('./assets/evidence/rest/asset-evidence-rest-gloss-v3.webp'),
  'asset-evidence-rest-method-limit': evidenceAsset('./assets/evidence/rest/asset-evidence-rest-method-limit-v3.webp'),
  'asset-evidence-rest-modern-shape': evidenceAsset('./assets/evidence/rest/asset-evidence-rest-modern-shape-v3.webp'),
  'asset-evidence-take-form': evidenceAsset('./assets/evidence/take/asset-evidence-take-form-v3.webp'),
  'asset-evidence-take-rite': evidenceAsset('./assets/evidence/take/asset-evidence-take-rite-v3.webp'),
  'asset-evidence-take-semantic-change': evidenceAsset('./assets/evidence/take/asset-evidence-take-semantic-change-v3.webp'),
  'asset-evidence-take-moral-fallacy': evidenceAsset('./assets/evidence/take/asset-evidence-take-moral-fallacy-v3.webp'),
  'asset-evidence-pick-form': evidenceAsset('./assets/evidence/pick/asset-evidence-pick-form-v3.webp'),
  'asset-evidence-pick-bian-distinction': evidenceAsset('./assets/evidence/pick/asset-evidence-pick-bian-distinction-v3.webp'),
  'asset-evidence-pick-extensions': evidenceAsset('./assets/evidence/pick/asset-evidence-pick-extensions-v3.webp'),
  'asset-evidence-pick-leaf-story': evidenceAsset('./assets/evidence/pick/asset-evidence-pick-leaf-story-v3.webp'),
  'asset-evidence-watch-form': evidenceAsset('./assets/evidence/watch/asset-evidence-watch-form-v3.webp'),
  'asset-evidence-watch-gloss': evidenceAsset('./assets/evidence/watch/asset-evidence-watch-gloss-v3.webp'),
  'asset-evidence-watch-mirror-relation': evidenceAsset('./assets/evidence/watch/asset-evidence-watch-mirror-relation-v3.webp'),
  'asset-evidence-watch-modern-story': evidenceAsset('./assets/evidence/watch/asset-evidence-watch-modern-story-v3.webp'),
  'asset-evidence-martial-form': evidenceAsset('./assets/evidence/martial/asset-evidence-martial-form-v3.webp'),
  'asset-evidence-martial-shuowen': evidenceAsset('./assets/evidence/martial/asset-evidence-martial-shuowen-v3.webp'),
  'asset-evidence-martial-foot': evidenceAsset('./assets/evidence/martial/asset-evidence-martial-foot-v3.webp'),
  'asset-evidence-martial-value-origin': evidenceAsset('./assets/evidence/martial/asset-evidence-martial-value-origin-v3.webp'),
  'asset-evidence-law-old-form': evidenceAsset('./assets/evidence/law/asset-evidence-law-old-form-v1.svg'),
  'asset-evidence-law-shuowen': evidenceAsset('./assets/evidence/law/asset-evidence-law-shuowen-v1.svg'),
  'asset-evidence-law-simplification': evidenceAsset('./assets/evidence/law/asset-evidence-law-simplification-v1.svg'),
  'asset-evidence-law-water-fairness': evidenceAsset('./assets/evidence/law/asset-evidence-law-water-fairness-v1.svg'),
  'asset-evidence-autumn-variants': evidenceAsset('./assets/evidence/autumn/asset-evidence-autumn-variants-v1.svg'),
  'asset-evidence-autumn-insect-fire': evidenceAsset('./assets/evidence/autumn/asset-evidence-autumn-insect-fire-v1.svg'),
  'asset-evidence-autumn-modern-form': evidenceAsset('./assets/evidence/autumn/asset-evidence-autumn-modern-form-v1.svg'),
  'asset-evidence-autumn-debate': evidenceAsset('./assets/evidence/autumn/asset-evidence-autumn-debate-v1.svg'),
})

const evidenceGlyphAssets: Readonly<Record<string, string>> = Object.freeze({
  'asset-glyph-home-oracle-pd': './assets/evidence/home/glyph-home-oracle-pd-v1.svg',
  'asset-glyph-home-bronze-pd': './assets/evidence/home/glyph-home-bronze-pd-v1.svg',
  'asset-glyph-home-seal-pd': './assets/evidence/home/glyph-home-seal-pd-v1.svg',
})

export function resolveEvidenceAsset(assetId: string): string | undefined {
  return resolveEvidenceAssetSet(assetId)?.primary
}

export function resolveEvidenceAssetSet(assetId: string): EvidenceAssetSet | undefined {
  return evidenceAssets[assetId]
}

export function resolveEvidenceGlyphAsset(assetId: string): string | undefined {
  return evidenceGlyphAssets[assetId]
}
