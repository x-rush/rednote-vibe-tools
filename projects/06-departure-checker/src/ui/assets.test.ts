import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { assetPathFor, GUIDE_ASSETS, STATUS_ICON_PATHS } from './assets'

const svgFiles = import.meta.glob('../../public/assets/icons/*.svg', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>
const guideFiles = import.meta.glob('../../public/assets/guide/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>

const contentAssetIds = [
  ...rawContent.content.scenarios.map((item) => item.iconAssetId),
  ...rawContent.content.categories.map((item) => item.iconAssetId),
  ...rawContent.content.locations.map((item) => item.iconAssetId),
]

describe('art asset manifest', () => {
  it('uses package-relative paths for every runtime asset', () => {
    const runtimePaths = [
      ...contentAssetIds.map((assetId) => assetPathFor(assetId)),
      ...Object.values(STATUS_ICON_PATHS),
      ...Object.values(GUIDE_ASSETS),
    ]

    expect(runtimePaths.every((path) => path?.startsWith('./assets/'))).toBe(true)
  })

  it('resolves every displayed content asset to a unique local file', async () => {
    expect(new Set(contentAssetIds).size).toBe(contentAssetIds.length)
    for (const assetId of contentAssetIds) {
      const path = `../../public/${assetPathFor(assetId)?.replace(/^\.\//, '')}`
      expect(svgFiles[path]).toBeTypeOf('string')
    }
  })

  it('ships uniform accessible SVG files', async () => {
    const assetIds = [...contentAssetIds, ...Object.keys(STATUS_ICON_PATHS)]
    for (const assetId of assetIds) {
      const svg = svgFiles[`../../public/${assetPathFor(assetId)?.replace(/^\.\//, '')}`]
      expect(svg).toContain('viewBox="0 0 24 24"')
      expect(svg).toContain('<title>')
      expect(svg).toContain('stroke-width="2"')
    }
  })

  it('ships both local guide images', async () => {
    expect(guideFiles[`../../public/${GUIDE_ASSETS.master.replace(/^\.\//, '')}`]).toBeTypeOf('string')
    expect(guideFiles[`../../public/${GUIDE_ASSETS.avatar.replace(/^\.\//, '')}`]).toBeTypeOf('string')
  })
})
