/// <reference types="node" />

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contentPackage } from '../content'
import { resolveEvidenceAsset, resolveEvidenceAssetSet } from './assets'
import * as evidenceAssetModule from './assets'

function readUint24LE(payload: Buffer, offset: number): number {
  return payload[offset] | (payload[offset + 1] << 8) | (payload[offset + 2] << 16)
}

function readWebpDimensions(payload: Buffer): { width: number, height: number } {
  const chunk = payload.subarray(12, 16).toString('ascii')
  if (chunk === 'VP8 ') {
    return { width: payload.readUInt16LE(26) & 0x3fff, height: payload.readUInt16LE(28) & 0x3fff }
  }
  if (chunk === 'VP8L') {
    return {
      width: 1 + payload[21] + ((payload[22] & 0x3f) << 8),
      height: 1 + (payload[22] >> 6) + (payload[23] << 2) + ((payload[24] & 0x0f) << 10),
    }
  }
  if (chunk === 'VP8X') {
    return { width: 1 + readUint24LE(payload, 24), height: 1 + readUint24LE(payload, 27) }
  }
  throw new Error(`unsupported WebP chunk ${chunk}`)
}

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

  it('ships 32 unique 1080×720 AI WebP plates under 200 KB with local SVG fallbacks', () => {
    const payloads = contentPackage.content.evidence.map((evidence) => {
      const assetSet = resolveEvidenceAssetSet(evidence.assetId)
      if (!assetSet) throw new Error(`missing asset mapping for ${evidence.id}`)
      expect(assetSet.primary, evidence.id).toMatch(/^\.\/assets\/evidence\/[a-z-]+\/[a-z0-9-]+-v3\.webp$/)
      expect(assetSet.fallback, evidence.id).toMatch(/^\.\/assets\/evidence\/[a-z-]+\/[a-z0-9-]+-v1\.svg$/)
      const primaryPath = resolve('public', assetSet.primary.slice(2))
      const fallbackPath = resolve('public', assetSet.fallback.slice(2))
      expect(existsSync(primaryPath), evidence.id).toBe(true)
      expect(existsSync(fallbackPath), `${evidence.id} fallback`).toBe(true)
      expect(statSync(primaryPath).size, evidence.id).toBeLessThanOrEqual(200_000)
      return { path: assetSet.primary, payload: readFileSync(primaryPath) }
    })
    const hashes = payloads.map(({ payload }) => createHash('sha256').update(payload).digest('hex'))

    expect(new Set(hashes).size).toBe(32)
    for (const { path, payload } of payloads) {
      expect(path).toContain('-v3.webp')
      expect(payload.subarray(0, 4).toString('ascii')).toBe('RIFF')
      expect(payload.subarray(8, 12).toString('ascii')).toBe('WEBP')
      expect(readWebpDimensions(payload)).toEqual({ width: 1080, height: 720 })
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
