import { describe, expect, it } from 'vitest'
import { getOverlayEscapeAction } from './overlay'

describe('getOverlayEscapeAction', () => {
  it('uses the safe cancel action for every overlay', () => {
    expect(getOverlayEscapeAction('guide')).toEqual({ type: 'dismiss-guide' })
    expect(getOverlayEscapeAction('itemDetail')).toEqual({ type: 'close-detail' })
    expect(getOverlayEscapeAction('conditionDiff')).toEqual({ type: 'cancel-regeneration' })
    expect(getOverlayEscapeAction('customEditor')).toEqual({ type: 'close-overlay' })
    expect(getOverlayEscapeAction('help')).toEqual({ type: 'close-overlay' })
    expect(getOverlayEscapeAction('overwrite')).toEqual({ type: 'close-overlay' })
  })
})
