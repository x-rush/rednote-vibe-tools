import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ActionGroup } from './ActionGroup'

describe('ActionGroup', () => {
  it.each([
    ['dark', 'split', 'split-actions action-surface-dark'],
    ['paper', 'stack', 'action-stack action-surface-paper'],
  ] as const)('marks %s actions on a %s layout', (surface, layout, expected) => {
    const html = renderToStaticMarkup(<ActionGroup surface={surface} layout={layout}><button>Action</button></ActionGroup>)
    expect(html).toContain(`class="${expected}"`)
  })
})
