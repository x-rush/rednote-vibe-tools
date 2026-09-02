import { describe, expect, it } from 'vitest'
import { getContent } from '.'
import { assetPath, assetRegistry, collectAssetIds } from './assets'

describe('local launch assets', () => {
  it('maps every required content asset id to a unique local bundled path', () => {
    const ids = collectAssetIds(getContent())
    const paths = ids.map((id) => assetRegistry[id])

    expect(paths.filter((path) => !path?.startsWith('./assets/') || !/\.(svg|webp)$/.test(path))).toEqual([])
    expect(new Set(paths).size).toBe(paths.length)
    expect(paths).toHaveLength(75)
    expect(assetRegistry['environment-caustics']).toBe('./assets/environments/microscope-caustics-v2.webp')
    expect(assetRegistry['environment-fibers']).toBe('./assets/environments/microscope-fibers-v2.webp')
    const files = Object.keys(import.meta.glob('../../public/assets/**/*.{svg,webp}')).map((path) => `.${path.replace('../../public', '')}`)
    expect(paths.filter((path) => !files.includes(path!))).toEqual([])
  })

  it('maps every environment to a local arcade background', () => {
    for (const environment of getContent().environments) {
      expect(assetPath(`${environment.id}:arcade`)).toMatch(/^\.\/assets\/environments\/arcade-.+\.webp$/)
    }
  })
})
