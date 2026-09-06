/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('../App.css', import.meta.url)), 'utf8')

describe('responsive overlays', () => {
  it('keeps the evolution choices inside their grid track so confirm remains clickable', () => {
    expect(css).toContain('.evolution-choices')
    const choicesRule = css.match(/\.evolution-choices\s*\{([^}]*)\}/)?.[1] ?? ''

    expect(choicesRule).toContain('height: 100%')
    expect(choicesRule).toContain('overflow-y: auto')
  })
})
