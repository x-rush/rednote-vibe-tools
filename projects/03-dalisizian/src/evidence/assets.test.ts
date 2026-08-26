/// <reference types="node" />

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contentPackage } from '../content'
import { resolveEvidenceAsset } from './assets'

describe('evidence asset resolver', () => {
  it('resolves every evidence asset ID to a packaged SVG', () => {
    for (const evidence of contentPackage.content.evidence) {
      const path = resolveEvidenceAsset(evidence.assetId)
      expect(path, evidence.id).toMatch(/^\.\/assets\/evidence\/[a-z-]+\/[a-z0-9-]+-v1\.svg$/)
      expect(existsSync(resolve('public', path!.slice(2))), evidence.id).toBe(true)
    }
    expect(resolveEvidenceAsset('asset-evidence-unknown')).toBeUndefined()
  })

  it('ships 32 distinct inert SVG plates without embedded prose or remote payloads', () => {
    const payloads = contentPackage.content.evidence.map((evidence) => {
      const path = resolveEvidenceAsset(evidence.assetId)
      if (!path) throw new Error(`missing asset mapping for ${evidence.id}`)
      return readFileSync(resolve('public', path.slice(2)), 'utf8')
    })
    const hashes = payloads.map((payload) => createHash('sha256').update(payload).digest('hex'))

    expect(new Set(hashes).size).toBe(32)
    for (const payload of payloads) {
      expect(payload).toContain('viewBox="0 0 720 480"')
      expect(payload).not.toMatch(/<script|(?:href|src)=["']https?:\/\/|data:|<text\b/i)
    }
  })
})
