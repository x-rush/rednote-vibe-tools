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

function curtainPathXCoordinates(sample: ReturnType<typeof sampleTimeline>) {
  const html = renderToStaticMarkup(createElement(CurtainLayer, { sample }))
  return Array.from(html.matchAll(/<path d="([^"]+)"/g), ([, path]) => {
    const values = Array.from(path.matchAll(/-?\d+(?:\.\d+)?/g), ([number]) => Number(number))
    return [values[0], values[2], values[4], values[6]] as const
  }).flat()
}

describe('curtain opening and reset motion', () => {
  it('continues changing after the narrative reaches its result', () => {
    const first = firstPathNumbers(sampleTimeline(7000, false))
    const later = firstPathNumbers(sampleTimeline(8200, false))
    expect(later).not.toEqual(first)
  })

  it('approaches the resting strand geometry before reset completes', () => {
    const resting = firstPathNumbers(sampleTimeline(0, false))
    const almostReset = firstPathNumbers(resetSceneSample(0.999))
    const largestDelta = Math.max(...resting.map((value, index) => Math.abs(value - (almostReset[index] ?? value))))

    expect(largestDelta).toBeLessThan(2)
  })

  it('clears every curtain strand left of the portal before stars enter', () => {
    for (const elapsedMs of [1799, 1800]) {
      expect(Math.max(...curtainPathXCoordinates(sampleTimeline(elapsedMs, false)))).toBeLessThan(214)
    }
  })
})
