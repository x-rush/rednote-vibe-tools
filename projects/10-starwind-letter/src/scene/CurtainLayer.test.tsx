import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { resetSceneSample, sampleTimeline } from '../experience/timeline'
import { CurtainLayer } from './CurtainLayer'

function firstPathNumbers(sample: ReturnType<typeof sampleTimeline>) {
  const html = renderToStaticMarkup(createElement(CurtainLayer, { sample }))
  const path = html.match(/<path d="([^"]+)"/)?.[1]
  if (!path) throw new Error('Expected a curtain path')
  return Array.from(path.matchAll(/-?\d+(?:\.\d+)?/g), ([number]) => Number(number))
}

describe('curtain reset motion', () => {
  it('approaches the resting strand geometry before reset completes', () => {
    const resting = firstPathNumbers(sampleTimeline(0, false))
    const almostReset = firstPathNumbers(resetSceneSample(0.999))
    const largestDelta = Math.max(...resting.map((value, index) => Math.abs(value - (almostReset[index] ?? value))))

    expect(largestDelta).toBeLessThan(2)
  })
})
