import type { QuizOption } from '../content/types.ts'

type ArchiveOptionsProps = {
  options: readonly QuizOption[]
  selectedId: string | null
  eliminatedId: string | null
  onSelect: (optionId: string) => void
  onConfirm: () => void
  copy: { prompt: string; eliminated: string; stampAction: string; sealCharacter: string }
}

export function ArchiveOptions({ options, selectedId, eliminatedId, onSelect, onConfirm, copy }: ArchiveOptionsProps) {
  return (
    <fieldset className="archive-options">
      <legend>{copy.prompt}</legend>
      <div className="options-grid">
        {options.map((option, index) => {
          const eliminated = option.id === eliminatedId
          return (
            <button
              key={option.id}
              className={`${selectedId === option.id ? 'option-button selected' : 'option-button'}${eliminated ? ' eliminated' : ''}`}
              type="button"
              disabled={eliminated}
              aria-pressed={selectedId === option.id}
              onClick={() => onSelect(option.id)}
            >
              <span>{String.fromCharCode(65 + index)}</span>{option.label}{eliminated && <small>{copy.eliminated}</small>}
            </button>
          )
        })}
      </div>
      <button className="stamp-button" type="button" disabled={!selectedId} onClick={onConfirm}>
        <span aria-hidden="true">{copy.sealCharacter}</span><strong>{copy.stampAction}</strong>
      </button>
    </fieldset>
  )
}
