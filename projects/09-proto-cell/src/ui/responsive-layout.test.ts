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

  it('keeps specimen captions in normal flow beneath each canvas', () => {
    const captionRule = css.match(/\.evolution-choice__preview\s+small\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(captionRule).toContain('position: static')
    expect(captionRule).not.toContain('bottom: -8px')
  })

  it('keeps the home backdrop free of a frame crossing the title and primary action', () => {
    const homeBackdrop = css.match(/\.lab-home::before\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(homeBackdrop).toContain('background:')
    expect(homeBackdrop).not.toContain('lab-frame.svg')
  })
})
