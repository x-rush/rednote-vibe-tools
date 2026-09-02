import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { resetSceneSample, sampleTimeline } from '../experience/timeline'
import { CurtainLayer } from './CurtainLayer'

function firstPathNumbers(sample: ReturnType<typeof sampleTimeline>, reducedMotion = false) {
  const html = renderToStaticMarkup(createElement(CurtainLayer, { sample, reducedMotion }))
  const path = html.match(/<path d="([^"]+)"/)?.[1]
  if (!path) throw new Error('Expected a curtain path')
  return Array.from(path.matchAll(/-?\d+(?:\.\d+)?/g), ([number]) => Number(number))
}

function outermostPathNumbers(sample: ReturnType<typeof sampleTimeline>, reducedMotion = false) {
  const html = renderToStaticMarkup(createElement(CurtainLayer, { sample, reducedMotion }))
  const paths = Array.from(html.matchAll(/<path d="([^"]+)"/g), ([, path]) => (
    Array.from(path.matchAll(/-?\d+(?:\.\d+)?/g), ([number]) => Number(number))
  ))
  const outermost = paths.reduce<readonly number[] | undefined>((selected, path) => (
    !selected || (path[0] ?? 0) > (selected[0] ?? 0) ? path : selected
  ), undefined)
  if (!outermost) throw new Error('Expected an outer curtain path')
  return outermost
}

function curtainPathStartXCoordinates(sample: ReturnType<typeof sampleTimeline>) {
  const html = renderToStaticMarkup(createElement(CurtainLayer, { sample }))
  return Array.from(html.matchAll(/<path d="([^"]+)"/g), ([, path]) => {
    const values = Array.from(path.matchAll(/-?\d+(?:\.\d+)?/g), ([number]) => Number(number))
    return values[0] ?? 0
  })
}

function curtainPathTailXCoordinates(sample: ReturnType<typeof sampleTimeline>) {
  const html = renderToStaticMarkup(createElement(CurtainLayer, { sample }))
  return Array.from(html.matchAll(/<path d="([^"]+)"/g), ([, path]) => {
    const values = Array.from(path.matchAll(/-?\d+(?:\.\d+)?/g), ([number]) => Number(number))
    return values.at(-2) ?? 0
  })
}

function curtainStrandTailXCoordinates(sample: ReturnType<typeof sampleTimeline>) {
  const html = renderToStaticMarkup(createElement(CurtainLayer, { sample }))
  return Array.from(html.matchAll(/<path d="([^"]+)"/g), ([, path]) => (
    Array.from(path.matchAll(/-?\d+(?:\.\d+)?/g), ([number]) => Number(number))
  ))
    .filter((values) => values.length > 60)
    .map((values) => values.at(-2) ?? 0)
}

function tailX(values: readonly number[]) {
  return values.at(-2) ?? 0
}

function tailY(values: readonly number[]) {
  return values.at(-1) ?? 0
}

function bodyX(values: readonly number[]) {
  return values[42] ?? 0
}

function curtainVeilPath(sample: ReturnType<typeof sampleTimeline>) {
  const html = renderToStaticMarkup(createElement(CurtainLayer, { sample }))
  const path = html.match(/data-layer="curtain-veil" d="([^"]+)"/)?.[1]
  if (!path) throw new Error('Expected a curtain veil path')
  return path
}

describe('curtain opening and reset motion', () => {
  it('layers translucent threads and suspended sparkle highlights', () => {
    const html = renderToStaticMarkup(createElement(CurtainLayer, { sample: sampleTimeline(7600, false) }))
    expect(html.match(/data-curtain-depth=/g)).toHaveLength(3)
    expect(html).toContain('data-layer="curtain-sparkles"')
    expect(html.match(/data-curtain-sparkle/g)?.length ?? 0).toBeGreaterThanOrEqual(40)
  })

  it('rests as a still unlit curtain before the user calls the wind', () => {
    const html = renderToStaticMarkup(createElement(CurtainLayer, { sample: sampleTimeline(0, false) }))
    const sparkleLayer = html.match(/<g data-layer="curtain-sparkles" opacity="([^"]+)"/)?.[1]

    expect(sparkleLayer).toBe('0')
    expect(html).toContain('data-layer="curtain-veil"')
    expect(html.match(/gradientUnits="userSpaceOnUse"/g)?.length ?? 0).toBeGreaterThanOrEqual(4)
  })

  it('starts lifting the curtain in the first gust before the main opening beat', () => {
    const resting = firstPathNumbers(sampleTimeline(0, false))
    const gust = firstPathNumbers(sampleTimeline(299, false))
    expect(gust).not.toEqual(resting)
  })

  it('continues changing after the narrative reaches its result', () => {
    const first = firstPathNumbers(sampleTimeline(7000, false))
    const later = firstPathNumbers(sampleTimeline(8200, false))
    expect(later).not.toEqual(first)
  })

  it('builds the opening arc from a strong outward tail sweep', () => {
    const resting = outermostPathNumbers(sampleTimeline(0, false))
    const caught = outermostPathNumbers(sampleTimeline(600, false))
    const easing = outermostPathNumbers(sampleTimeline(950, false))
    expect(tailX(caught)).toBeGreaterThan(tailX(resting) + 28)
    expect(tailY(caught)).toBeLessThan(tailY(resting) - 30)
    expect(tailX(easing)).toBeLessThan(tailX(caught) - 30)
  })

  it('lets the first gust catch a broad bundle instead of moving only the outermost strand', () => {
    const tails = curtainStrandTailXCoordinates(sampleTimeline(650, false))
    const swept = tails.filter((x) => x > 275)

    expect(tails.length).toBeGreaterThan(64)
    expect(swept.length / tails.length).toBeGreaterThan(0.34)
  })

  it('snaps the rings inward while loose tails catch the same early gust', () => {
    const restingHeaders = curtainPathStartXCoordinates(sampleTimeline(0, false))
    const pulledHeaders = curtainPathStartXCoordinates(sampleTimeline(600, false))
    const restingTails = curtainPathTailXCoordinates(sampleTimeline(0, false))
    const balloonedTails = curtainPathTailXCoordinates(sampleTimeline(600, false))

    expect(Math.max(...pulledHeaders)).toBeLessThan(Math.max(...restingHeaders) - 60)
    expect(Math.max(...balloonedTails)).toBeGreaterThan(Math.max(...restingTails) + 28)
  })

  it('finishes gathering the header before the inertial tail settles', () => {
    const gatheredHeaders = curtainPathStartXCoordinates(sampleTimeline(1100, false))

    expect(Math.max(...gatheredHeaders)).toBeLessThan(240)
  })

  it('settles under gravity without throwing the opened curtain right again', () => {
    const following = outermostPathNumbers(sampleTimeline(600, false))
    const overshot = outermostPathNumbers(sampleTimeline(950, false))
    const settling = outermostPathNumbers(sampleTimeline(1500, false))
    const opened = outermostPathNumbers(sampleTimeline(1750, false))

    expect(tailX(overshot)).toBeLessThan(tailX(following) - 30)
    expect(tailX(settling)).toBeLessThan(tailX(overshot) - 12)
    expect(tailX(opened)).toBeLessThan(tailX(settling) + 12)
  })

  it('deforms the translucent curtain body with the wind instead of fading a fixed polygon', () => {
    expect(curtainVeilPath(sampleTimeline(520, false))).not.toBe(curtainVeilPath(sampleTimeline(0, false)))
    expect(curtainVeilPath(sampleTimeline(950, false))).not.toBe(curtainVeilPath(sampleTimeline(520, false)))
  })

  it('keeps a visible micro-sway after the reveal', () => {
    const first = outermostPathNumbers(sampleTimeline(7000, false))
    const later = outermostPathNumbers(sampleTimeline(8200, false))
    const travel = Math.max(...first.map((value, index) => Math.abs(value - (later[index] ?? value))))
    expect(travel).toBeGreaterThan(10)
    expect(travel).toBeLessThan(28)
  })

  it('keeps the settled tassel breeze gentle and visible', () => {
    const samples = Array.from({ length: 24 }, (_, index) => outermostPathNumbers(sampleTimeline(6500 + index * 320, false)))
    const tails = samples.map(tailX)
    const bodies = samples.map(bodyX)
    expect(Math.max(...tails) - Math.min(...tails)).toBeGreaterThan(46)
    expect(Math.max(...tails) - Math.min(...tails)).toBeLessThan(90)
    expect(Math.max(...bodies) - Math.min(...bodies)).toBeGreaterThan(18)
    expect(Math.max(...bodies) - Math.min(...bodies)).toBeLessThan(55)
  })

  it('reduces persistent curtain travel when reduced motion is requested', () => {
    const first = sampleTimeline(7000, false)
    const later = sampleTimeline(8200, false)
    const normalStart = outermostPathNumbers(first)
    const normalEnd = outermostPathNumbers(later)
    const reducedStart = outermostPathNumbers(first, true)
    const reducedEnd = outermostPathNumbers(later, true)
    const travel = (start: readonly number[], end: readonly number[]) => (
      Math.max(...start.map((value, index) => Math.abs(value - (end[index] ?? value))))
    )

    expect(travel(reducedStart, reducedEnd)).toBeLessThan(travel(normalStart, normalEnd) * 0.6)
  })

  it('approaches the resting strand geometry before reset completes', () => {
    const resting = firstPathNumbers(sampleTimeline(0, false))
    const almostReset = firstPathNumbers(resetSceneSample(0.999))
    const largestDelta = Math.max(...resting.map((value, index) => Math.abs(value - (almostReset[index] ?? value))))

    expect(largestDelta).toBeLessThan(3)
  })

  it('keeps every curtain anchor left of the portal while tassel tails sweep across it', () => {
    for (const elapsedMs of [1799, 1800]) {
      expect(Math.max(...curtainPathStartXCoordinates(sampleTimeline(elapsedMs, false)))).toBeLessThanOrEqual(214)
    }
  })
})
