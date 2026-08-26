import type { AppOverlay } from './state'

type OverlayEscapeAction =
  | { type: 'dismiss-guide' }
  | { type: 'close-detail' }
  | { type: 'cancel-regeneration' }
  | { type: 'close-overlay' }

export const getOverlayEscapeAction = (overlay: AppOverlay): OverlayEscapeAction => {
  if (overlay === 'guide') return { type: 'dismiss-guide' }
  if (overlay === 'itemDetail') return { type: 'close-detail' }
  if (overlay === 'conditionDiff') return { type: 'cancel-regeneration' }
  return { type: 'close-overlay' }
}
