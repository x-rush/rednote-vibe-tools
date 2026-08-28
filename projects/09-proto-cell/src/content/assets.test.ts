import { describe, expect, it } from 'vitest'
import { getContent } from '.'
import { assetRegistry, collectAssetIds } from './assets'

describe('local launch assets', () => {
  it('maps every required content asset id to a unique local bundled path', () => {
    const ids = collectAssetIds(getContent())
    const paths = ids.map((id) => assetRegistry[id])

    expect(paths.filter((path) => !path?.startsWith('/assets/') || !/\.(svg|png)$/.test(path))).toEqual([])
    expect(new Set(paths).size).toBe(paths.length)
    expect(paths).toHaveLength(69)
    expect(assetRegistry['environment-caustics']).toBe('/assets/environments/microscope-caustics-v2.png')
    expect(assetRegistry['environment-fibers']).toBe('/assets/environments/microscope-fibers-v2.png')
    const files = Object.keys(import.meta.glob('../../public/assets/**/*.{svg,png}')).map((path) => path.replace('../../public', ''))
    expect(paths.filter((path) => !files.includes(path!))).toEqual([])
  })
})
