export type NativeContextMenuEvent = {
  preventDefault: () => void
  stopPropagation: () => void
}

export function suppressNativeContextMenu(event: NativeContextMenuEvent): void {
  event.preventDefault()
  event.stopPropagation()
}
