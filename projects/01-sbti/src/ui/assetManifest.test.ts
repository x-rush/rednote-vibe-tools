/// <reference types="node" />

import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import manifest from '../../public/assets/sbti/asset-manifest.json'

const publicRoot = fileURLToPath(new URL('../../public/', import.meta.url))
type ReleaseAsset = {
  id: string
  src?: string
  bytes?: number
  maxBytes?: number
  contentIds?: string[]
  fallback?: string
  fallbackBytes?: number
  shippingBlocked?: boolean
}
const releaseManifest = manifest as { items: ReleaseAsset[] }

function diskPath(src: string) {
  return resolve(publicRoot, `.${src}`)
}

describe('SBTI release asset manifest', () => {
  const profiles = releaseManifest.items.filter((item) => item.id.startsWith('sbti.beast.') && item.id.endsWith('.profile'))
  const placeholders = releaseManifest.items.filter((item) => item.id.startsWith('sbti.beast.') && item.id.endsWith('.placeholder'))

  it('ships one reference-verified profile and one same-beast placeholder for all 16 types', () => {
    expect(profiles).toHaveLength(16)
    expect(placeholders).toHaveLength(16)
    expect(new Set(profiles.flatMap((item) => item.contentIds ?? []).filter((value) => /^[A-Z]{4}$/.test(value)))).toHaveLength(16)
    expect(new Set(placeholders.map((item) => item.src))).toHaveLength(16)
  })

  it('points every runtime image at an existing file with synchronized byte metadata', () => {
    for (const item of releaseManifest.items) {
      if (!item.src?.startsWith('/assets/')) continue
      const path = diskPath(item.src)
      expect(existsSync(path), `${item.id}: ${item.src}`).toBe(true)
      expect(statSync(path).size, `${item.id}: byte metadata`).toBe(item.bytes)
      expect(item.bytes, `${item.id}: maxBytes`).toBeLessThanOrEqual(item.maxBytes ?? Number.POSITIVE_INFINITY)
    }
  })

  it('keeps all beast profiles releasable and wired to an existing lightweight fallback', () => {
    for (const profile of profiles) {
      expect(profile.shippingBlocked).toBe(false)
      expect(profile.fallback).toMatch(/^\/assets\/sbti\/beasts\/.+\/placeholder-v\d+\.webp$/)
      const fallbackPath = diskPath(profile.fallback!)
      expect(existsSync(fallbackPath), `${profile.id}: ${profile.fallback}`).toBe(true)
      expect(statSync(fallbackPath).size).toBe(profile.fallbackBytes)
      expect(profile.fallbackBytes).toBeLessThanOrEqual(4_000)
    }
  })
})
