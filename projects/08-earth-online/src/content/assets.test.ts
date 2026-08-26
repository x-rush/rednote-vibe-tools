/// <reference types="node" />

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const assetRoot = new URL('../../public/assets/earth-online/', import.meta.url)
const svgFolders = ['categories', 'ranks', 'status', 'badges', 'props'] as const
const svgPaths = svgFolders.flatMap((folder) =>
  readdirSync(new URL(`${folder}/`, assetRoot))
    .filter((name) => name.endsWith('.svg'))
    .map((name) => `${folder}/${name}`),
)

describe('earth online art assets', () => {
  it('ships the complete local asset set', () => {
    expect(svgPaths).toHaveLength(30)
    expect(readdirSync(new URL('guide/', assetRoot)).sort()).toEqual([
      'mira-avatar-v3.webp',
      'mira-master-v3.png',
      'mira-placeholder-v3.webp',
    ])
  })

  it.each(svgPaths)('%s is a titled local SVG with the shared icon contract', (path) => {
    const source = readFileSync(new URL(path, assetRoot), 'utf8')
    expect(source).toContain('<title>')
    expect(source).toContain('viewBox="0 0 48 48"')
    expect(source).toContain('stroke-width="2.25"')
    expect(source).not.toMatch(/weapon|sword|coin|treasure|medical/i)
  })

  it('ships a self-contained, accessible square brand mark', () => {
    const source = readFileSync(new URL('brand/logo-mark.svg', assetRoot), 'utf8')
    expect(source).toMatch(/<title(?:\s[^>]*)?>地球 Online｜地球支线传送门<\/title>/)
    expect(source).toContain('aria-labelledby="logo-title logo-desc"')
    expect(source).toContain('viewBox="0 0 512 512"')
    expect(source).not.toContain('<text')
    expect(source).not.toMatch(/(?:href|src)=["']https?:/i)
  })

  it('keeps Mira derivatives within their budgets', () => {
    expect(statSync(new URL('guide/mira-avatar-v3.webp', assetRoot)).size).toBeLessThanOrEqual(24_576)
    expect(statSync(new URL('guide/mira-placeholder-v3.webp', assetRoot)).size).toBeLessThanOrEqual(8_192)
  })

  it('ships the complete guild notice board as a compressed local WebP', () => {
    const boardUrl = new URL('scenes/guild-notice-board-v1.webp', assetRoot)
    const source = readFileSync(boardUrl)
    expect(source.subarray(0, 4).toString('ascii')).toBe('RIFF')
    expect(source.subarray(8, 12).toString('ascii')).toBe('WEBP')
    expect(statSync(boardUrl).size).toBeLessThanOrEqual(500_000)
  })
})
