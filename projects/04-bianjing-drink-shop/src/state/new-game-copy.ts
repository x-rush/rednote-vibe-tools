interface NewGameCopy {
  firstOpening: string
  startAnotherShop: string
}

export function newGameLabel(hasSave: boolean, copy: NewGameCopy): string {
  return hasSave ? copy.startAnotherShop : copy.firstOpening
}
