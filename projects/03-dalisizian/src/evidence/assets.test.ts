/// <reference types="node" />

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contentPackage } from '../content'
import { resolveEvidenceAsset, resolveEvidenceAssetSet } from './assets'
import * as evidenceAssetModule from './assets'

describe('evidence asset resolver', () => {
  it('keeps an explicit local fallback beside the formal evidence plate', () => {
    expect(resolveEvidenceAssetSet('asset-evidence-home-early-form')).toEqual({
      primary: './assets/evidence/home/asset-evidence-home-early-form-v3.webp',
      fallback: './assets/evidence/home/asset-evidence-home-early-form-v1.svg',
    })
    expect(resolveEvidenceAssetSet('asset-evidence-unknown')).toBeUndefined()
  })

  it('resolves every evidence asset ID to a packaged local plate', () => {
    for (const evidence of contentPackage.content.evidence) {
      const path = resolveEvidenceAsset(evidence.assetId)
      expect(path, evidence.id).toMatch(/^\.\/assets\/evidence\/[a-z-]+\/[a-z0-9-]+-v\d+\.(?:svg|webp)$/)
      expect(existsSync(resolve('public', path!.slice(2))), evidence.id).toBe(true)
    }
    expect(resolveEvidenceAsset('asset-evidence-home-early-form')).toBe('./assets/evidence/home/asset-evidence-home-early-form-v3.webp')
    expect(resolveEvidenceAsset('asset-evidence-unknown')).toBeUndefined()
  })

  it('ships 32 distinct inert local plates without embedded prose or remote payloads', () => {
    const payloads = contentPackage.content.evidence.map((evidence) => {
      const path = resolveEvidenceAsset(evidence.assetId)
      if (!path) throw new Error(`missing asset mapping for ${evidence.id}`)
      return { path, payload: readFileSync(resolve('public', path.slice(2))) }
    })
    const hashes = payloads.map(({ payload }) => createHash('sha256').update(payload).digest('hex'))

    expect(new Set(hashes).size).toBe(32)
    for (const { path, payload } of payloads) {
      if (path.endsWith('.webp')) {
        expect(payload.subarray(0, 4).toString('ascii')).toBe('RIFF')
        expect(payload.subarray(8, 12).toString('ascii')).toBe('WEBP')
        continue
      }
      const source = payload.toString('utf8')
      expect(source).toContain('viewBox="0 0 720 480"')
      expect(source).not.toMatch(/<script|(?:href|src)=["']https?:\/\/|data:|<text\b/i)
    }
  })

  it('resolves the three public-domain home glyphs to inert local SVG files', () => {
    const resolveEvidenceGlyphAsset = (evidenceAssetModule as Partial<typeof evidenceAssetModule & {
      resolveEvidenceGlyphAsset: (assetId: string) => string | undefined
    }>).resolveEvidenceGlyphAsset
    const expected = [
      './assets/evidence/home/glyph-home-oracle-pd-v1.svg',
      './assets/evidence/home/glyph-home-bronze-pd-v1.svg',
      './assets/evidence/home/glyph-home-seal-pd-v1.svg',
    ]

    expect([
      resolveEvidenceGlyphAsset?.('asset-glyph-home-oracle-pd'),
      resolveEvidenceGlyphAsset?.('asset-glyph-home-bronze-pd'),
      resolveEvidenceGlyphAsset?.('asset-glyph-home-seal-pd'),
    ]).toEqual(expected)
    for (const path of expected) {
      expect(existsSync(resolve('public', path.slice(2)))).toBe(true)
      const source = readFileSync(resolve('public', path.slice(2)), 'utf8')
      expect(source).not.toMatch(/<script|(?:href|src)=["']https?:\/\/|data:|<text\b/i)
    }
  })
})
