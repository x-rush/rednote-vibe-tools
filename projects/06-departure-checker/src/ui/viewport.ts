type ScrollTarget = {
  scrollTo: (options: ScrollToOptions) => void
}

export const resetPageScroll = (target: ScrollTarget) => {
  target.scrollTo({ top: 0, left: 0, behavior: 'auto' })
}
