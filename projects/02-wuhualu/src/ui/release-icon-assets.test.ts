/// <reference types="node" />

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import releaseManifest from '../../release-assets/manifest.json'

const expectedAssets = [
  ['tool-icon-v1.png', 512, '2be30a6d3110860c6697735025ee3ba86caab2f0ca372f04e9776953768fa42d'],
  ['qa-tool-icon-128.png', 128, 'a60ffeb92a33e51a1c176408040e1e7cfb7ccfa6b792cfa175fa859130feb591'],
  ['qa-tool-icon-64.png', 64, 'bb59da5ff26a56e791b3d88d8d051c4ca3f875ef31411b6f0c7dd19f0cff28e8'],
] as const

describe('release icon assets', () => {
  it('declares the approved V2 brand icon as the release source', () => {
    expect(releaseManifest.portal.icon.source).toBe('public/assets/wuhualu/brand/app-icon-v2.png')
  })

  it.each(expectedAssets)('%s is the approved deterministic %ipx derivative', (filename, size, expectedHash) => {
    const path = fileURLToPath(new URL(`../../release-assets/${filename}`, import.meta.url))
    const png = readFileSync(path)

    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(png.readUInt32BE(16)).toBe(size)
    expect(png.readUInt32BE(20)).toBe(size)
    expect(createHash('sha256').update(png).digest('hex')).toBe(expectedHash)
  })
})
