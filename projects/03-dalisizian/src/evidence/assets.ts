const evidenceAssets: Readonly<Record<string, string>> = Object.freeze({
  'asset-evidence-home-early-form': './assets/evidence/home/asset-evidence-home-early-form-v2.webp',
  'asset-evidence-home-shuowen': './assets/evidence/home/asset-evidence-home-shuowen-v1.svg',
  'asset-evidence-home-phonetic': './assets/evidence/home/asset-evidence-home-phonetic-v1.svg',
  'asset-evidence-home-social-leap': './assets/evidence/home/asset-evidence-home-social-leap-v1.svg',
  'asset-evidence-rest-components': './assets/evidence/rest/asset-evidence-rest-components-v1.svg',
  'asset-evidence-rest-gloss': './assets/evidence/rest/asset-evidence-rest-gloss-v1.svg',
  'asset-evidence-rest-method-limit': './assets/evidence/rest/asset-evidence-rest-method-limit-v1.svg',
  'asset-evidence-rest-modern-shape': './assets/evidence/rest/asset-evidence-rest-modern-shape-v1.svg',
  'asset-evidence-take-form': './assets/evidence/take/asset-evidence-take-form-v1.svg',
  'asset-evidence-take-rite': './assets/evidence/take/asset-evidence-take-rite-v1.svg',
  'asset-evidence-take-semantic-change': './assets/evidence/take/asset-evidence-take-semantic-change-v1.svg',
  'asset-evidence-take-moral-fallacy': './assets/evidence/take/asset-evidence-take-moral-fallacy-v1.svg',
  'asset-evidence-pick-form': './assets/evidence/pick/asset-evidence-pick-form-v1.svg',
  'asset-evidence-pick-bian-distinction': './assets/evidence/pick/asset-evidence-pick-bian-distinction-v1.svg',
  'asset-evidence-pick-extensions': './assets/evidence/pick/asset-evidence-pick-extensions-v1.svg',
  'asset-evidence-pick-leaf-story': './assets/evidence/pick/asset-evidence-pick-leaf-story-v1.svg',
  'asset-evidence-watch-form': './assets/evidence/watch/asset-evidence-watch-form-v1.svg',
  'asset-evidence-watch-gloss': './assets/evidence/watch/asset-evidence-watch-gloss-v1.svg',
  'asset-evidence-watch-mirror-relation': './assets/evidence/watch/asset-evidence-watch-mirror-relation-v1.svg',
  'asset-evidence-watch-modern-story': './assets/evidence/watch/asset-evidence-watch-modern-story-v1.svg',
  'asset-evidence-martial-form': './assets/evidence/martial/asset-evidence-martial-form-v1.svg',
  'asset-evidence-martial-shuowen': './assets/evidence/martial/asset-evidence-martial-shuowen-v1.svg',
  'asset-evidence-martial-foot': './assets/evidence/martial/asset-evidence-martial-foot-v1.svg',
  'asset-evidence-martial-value-origin': './assets/evidence/martial/asset-evidence-martial-value-origin-v1.svg',
  'asset-evidence-law-old-form': './assets/evidence/law/asset-evidence-law-old-form-v1.svg',
  'asset-evidence-law-shuowen': './assets/evidence/law/asset-evidence-law-shuowen-v1.svg',
  'asset-evidence-law-simplification': './assets/evidence/law/asset-evidence-law-simplification-v1.svg',
  'asset-evidence-law-water-fairness': './assets/evidence/law/asset-evidence-law-water-fairness-v1.svg',
  'asset-evidence-autumn-variants': './assets/evidence/autumn/asset-evidence-autumn-variants-v1.svg',
  'asset-evidence-autumn-insect-fire': './assets/evidence/autumn/asset-evidence-autumn-insect-fire-v1.svg',
  'asset-evidence-autumn-modern-form': './assets/evidence/autumn/asset-evidence-autumn-modern-form-v1.svg',
  'asset-evidence-autumn-debate': './assets/evidence/autumn/asset-evidence-autumn-debate-v1.svg',
})

const evidenceGlyphAssets: Readonly<Record<string, string>> = Object.freeze({
  'asset-glyph-home-oracle-pd': './assets/evidence/home/glyph-home-oracle-pd-v1.svg',
  'asset-glyph-home-bronze-pd': './assets/evidence/home/glyph-home-bronze-pd-v1.svg',
  'asset-glyph-home-seal-pd': './assets/evidence/home/glyph-home-seal-pd-v1.svg',
})

export function resolveEvidenceAsset(assetId: string): string | undefined {
  return evidenceAssets[assetId]
}

export function resolveEvidenceGlyphAsset(assetId: string): string | undefined {
  return evidenceGlyphAssets[assetId]
}
