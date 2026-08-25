import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import { validateContent } from '../content/validate'
import type { DimensionResult } from './types'
import { formatResultIdentity, toDimensionDisplay } from './presentation'

const content = validateContent(rawContent)

describe('Chinese-only presentation models', () => {
  it('maps internal dimension data to Chinese display copy', () => {
    const definition = content.content.dimensions[0]
    const result: DimensionResult = {
      dimension: 'RH', leftPole: 'R', rightPole: 'H', leftScore: 8, rightScore: 4,
      preferredPole: 'R', strength: 1 / 3, label: '轻偏', isBalanced: false,
    }
    expect(toDimensionDisplay(result, definition)).toEqual({
      title: '与世界相遇', left: '应世', right: '隐世', preferred: '应世', strengthLabel: '轻偏',
    })
  })

  it('formats a result identity without its internal result code', () => {
    expect(formatResultIdentity('陆吾', '山司型')).toBe('陆吾 · 山司型')
  })
})
