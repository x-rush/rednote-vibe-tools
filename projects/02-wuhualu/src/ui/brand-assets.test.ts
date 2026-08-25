/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { APP_ICON_ASSET, APP_ICON_URL } from './brand-assets.ts'

describe('brand icon', () => {
  it('ships the approved 1024px PNG from a project-local URL', () => {
    const iconPath = fileURLToPath(new URL('../../public/assets/wuhualu/brand/app-icon-v2.png', import.meta.url))
    const png = readFileSync(iconPath)

    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(png.readUInt32BE(16)).toBe(1024)
    expect(png.readUInt32BE(20)).toBe(1024)
    expect(APP_ICON_ASSET).toBe('assets/wuhualu/brand/app-icon-v2.png')
    expect(APP_ICON_URL).toBe('/assets/wuhualu/brand/app-icon-v2.png')
  })
})
