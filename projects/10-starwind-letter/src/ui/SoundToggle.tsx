interface SoundToggleProps { readonly muted: boolean; readonly onToggle: () => void }

export function SoundToggle({ muted, onToggle }: SoundToggleProps) {
  return (
    <button className="sound-toggle" type="button" aria-label={muted ? '开启音效' : '关闭音效'} onClick={onToggle}>
      <span aria-hidden="true">{muted ? '音' : '♪'}</span>
    </button>
  )
}
