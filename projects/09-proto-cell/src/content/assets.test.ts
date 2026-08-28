import { describe, expect, it } from 'vitest'
import { getContent } from '.'
import { assetRegistry, collectAssetIds } from './assets'

describe('local launch assets', () => {
  it('maps every required content asset id to a unique local SVG path', () => {
    const ids = collectAssetIds(getContent())
    const paths = ids.map((id) => assetRegistry[id])

    expect(paths.filter((path) => !path?.startsWith('/assets/') || !path.endsWith('.svg'))).toEqual([])
    expect(new Set(paths).size).toBe(paths.length)
    expect(paths).toHaveLength(67)
    const files = Object.keys(import.meta.glob('../../public/assets/**/*.svg')).map((path) => path.replace('../../public', ''))
    expect(paths.filter((path) => !files.includes(path!))).toEqual([])
  })
})
