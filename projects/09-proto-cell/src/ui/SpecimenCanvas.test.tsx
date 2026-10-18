import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createBuildState } from '../evolution/build'
import { drawSpecimen, SpecimenCanvas } from './SpecimenCanvas'

describe('shared specimen surface', () => {
  it('renders the selected lineage and deterministic hatch time with the live anatomy', () => {
    const paths: number[][] = []
    const colors: unknown[] = []
    let path: number[] = []
    const context = new Proxy({}, {
      get(_target, key) {
        if (key === 'createRadialGradient') return () => ({ addColorStop() {} })
        if (key === 'beginPath') return () => { path = [] }
        if (key === 'moveTo' || key === 'lineTo') return (x: number, y: number) => path.push(x, y)
        if (key === 'closePath') return () => paths.push([...path])
        return () => {}
      },
      set(_target, key, value) { if (key === 'strokeStyle') colors.push(value); return true },
    }) as CanvasRenderingContext2D
    const snapshots = ['dart', 'bastion', 'bloom'].map((family) => {
      paths.length = 0
      drawSpecimen(context, createBuildState(), 'form-primal-cell', 120, { visualRecipeId: `visual-lineage-${family}`, elapsedMs: 1200 })
      return paths[0]
    })
    expect(new Set(snapshots.map((points) => JSON.stringify(points))).size).toBe(3)
    expect(colors).toContain('#ffb56f')
    expect(colors).toContain('#a2bfff')
    expect(colors).toContain('#86f1bd')
  })
  it('keeps previews decorative with finite bounded resolution', () => {
    const build = createBuildState()
    const output = renderToStaticMarkup(<SpecimenCanvas build={build} formId="form-colony-body" size={Number.NaN} />)
    expect(output).toContain('aria-hidden="true"')
    expect(output).toContain('width="120"')
    expect(renderToStaticMarkup(<SpecimenCanvas build={build} formId="form-primal-cell" size={10000} />)).toContain('width="512"')
  })
})
