export type AnimatedTag = 'selected' | 'wind' | 'window-opening' | 'stars-entering' | 'result'

export type ExperienceState =
  | { readonly tag: 'loading'; readonly run: number }
  | { readonly tag: 'spinning'; readonly run: number }
  | { readonly tag: 'slowing'; readonly run: number; readonly messageId: string }
  | { readonly tag: AnimatedTag; readonly run: number; readonly messageId: string }
  | { readonly tag: 'resetting'; readonly run: number; readonly previousMessageId: string }

export type ExperienceEvent =
  | { readonly type: 'loaded' }
  | { readonly type: 'select'; readonly messageId: string }
  | { readonly type: 'advance' }
  | { readonly type: 'replay' }
  | { readonly type: 'reset-complete' }

const nextAnimatedTag: Partial<Record<AnimatedTag, AnimatedTag>> = {
  selected: 'wind',
  wind: 'window-opening',
  'window-opening': 'stars-entering',
  'stars-entering': 'result',
}

export function transition(state: ExperienceState, event: ExperienceEvent): ExperienceState {
  if (state.tag === 'loading' && event.type === 'loaded') {
    return { tag: 'spinning', run: state.run }
  }
  if (state.tag === 'spinning' && event.type === 'select') {
    return { tag: 'slowing', run: state.run, messageId: event.messageId }
  }
  if (state.tag === 'slowing' && event.type === 'advance') {
    return { tag: 'selected', run: state.run, messageId: state.messageId }
  }
  if (
    (state.tag === 'selected'
      || state.tag === 'wind'
      || state.tag === 'window-opening'
      || state.tag === 'stars-entering')
    && event.type === 'advance'
  ) {
    const nextTag = nextAnimatedTag[state.tag]
    if (nextTag) return { tag: nextTag, run: state.run, messageId: state.messageId }
  }
  if (state.tag === 'result' && event.type === 'replay') {
    return { tag: 'resetting', run: state.run, previousMessageId: state.messageId }
  }
  if (state.tag === 'resetting' && event.type === 'reset-complete') {
    return { tag: 'spinning', run: state.run + 1 }
  }
  return state
}
