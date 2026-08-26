import { AssetIcon, type IconName } from './AssetIcon'
import type { ScreenOptionV2 } from '../app/viewV2'

export function ChoiceGrid({
  options,
  selected = [],
  icon,
  onChoose,
}: {
  options: ScreenOptionV2[]
  selected?: string[]
  icon?: IconName
  onChoose(option: ScreenOptionV2): void
}) {
  return (
    <div className="choice-grid">
      {options.map((option) => {
        const active = selected.includes(option.id)
        return (
          <button
            className={`paper-choice${active ? ' is-selected' : ''}`}
            type="button"
            key={option.id}
            aria-pressed={active}
            onClick={() => onChoose(option)}
          >
            {icon ? <AssetIcon name={icon} size={22} /> : null}
            <span><strong>{option.label}</strong>{option.description ? <small>{option.description}</small> : null}</span>
            <span className="choice-mark" aria-hidden="true">{active ? '✓' : '＋'}</span>
          </button>
        )
      })}
    </div>
  )
}
