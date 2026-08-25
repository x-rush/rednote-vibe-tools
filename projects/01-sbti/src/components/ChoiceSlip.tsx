export type ChoiceSlipProps = {
  name: string
  optionId: string
  text: string
  selected: boolean
  disabled?: boolean
  onChoose: (optionId: string) => void
}

export function ChoiceSlip({ name, optionId, text, selected, disabled = false, onChoose }: ChoiceSlipProps) {
  return (
    <label className={`choice-slip${selected ? ' choice-slip--selected' : ''}`} data-state={selected ? 'selected' : 'idle'}>
      <input
        type="radio"
        name={name}
        value={optionId}
        checked={selected}
        disabled={disabled}
        onChange={() => onChoose(optionId)}
      />
      <span className="choice-slip__marker" aria-hidden="true">{selected ? '选' : '·'}</span>
      <span className="choice-slip__text">{text}</span>
    </label>
  )
}
