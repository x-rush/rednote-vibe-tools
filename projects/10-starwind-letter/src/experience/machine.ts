export type AnimatedTag = 'wind' | 'curtain-opening' | 'stars-and-letters' | 'result'

export type ExperienceState =
  | { readonly tag: 'idle'; readonly run: number }
  | { readonly tag: AnimatedTag; readonly run: number; readonly messageId: string }
  | { readonly tag: 'resetting'; readonly run: number; readonly previousMessageId: string }

export type ExperienceEvent =
  | { readonly type: 'begin'; readonly messageId: string }
  | { readonly type: 'advance' }
  | { readonly type: 'replay' }
  | { readonly type: 'reset-complete' }

const nextAnimatedTag: Partial<Record<AnimatedTag, AnimatedTag>> = {
  wind: 'curtain-opening',
  'curtain-opening': 'stars-and-letters',
  'stars-and-letters': 'result',
}

export function transition(state: ExperienceState, event: ExperienceEvent): ExperienceState {
  if (state.tag === 'idle' && event.type === 'begin') {
    return { tag: 'wind', run: state.run, messageId: event.messageId }
  }
  if (state.tag in nextAnimatedTag && event.type === 'advance') {
    const tag = nextAnimatedTag[state.tag as AnimatedTag]
    if (tag && 'messageId' in state) return { tag, run: state.run, messageId: state.messageId }
  }
  if (state.tag === 'result' && event.type === 'replay') {
    return { tag: 'resetting', run: state.run, previousMessageId: state.messageId }
  }
  if (state.tag === 'resetting' && event.type === 'reset-complete') {
    return { tag: 'idle', run: state.run + 1 }
  }
  return state
}
