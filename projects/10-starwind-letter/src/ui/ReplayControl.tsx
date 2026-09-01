interface ReplayControlProps { readonly onReplay: () => void }

export function ReplayControl({ onReplay }: ReplayControlProps) {
  return <button className="replay-control" type="button" onClick={onReplay}>再听一次星空</button>
}
