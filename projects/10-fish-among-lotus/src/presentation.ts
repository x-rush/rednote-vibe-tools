export type PresentationState = {
  showDecorativeCopy: boolean
  compactSettingsToggle: boolean
}

export function getPresentationState(hasCustomBackground: boolean): PresentationState {
  return {
    showDecorativeCopy: !hasCustomBackground,
    compactSettingsToggle: hasCustomBackground,
  }
}
