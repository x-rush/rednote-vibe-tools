import { chapterPosition } from '../guide/journey'

const VOLUMES = ['入境', '寻迹', '异变', '归来'] as const

export function VolumeProgress({ current, total }: { current: number; total: number }) {
  const position = chapterPosition(current)
  return (
    <section className="volume-progress" aria-label={`第 ${position.chapterIndex + 1} 章 · ${current} / ${total}`}>
      <div className="volume-progress__summary">第 {position.chapterIndex + 1} 章 · {current} / {total}</div>
      <ol className="volume-progress__seals">
        {VOLUMES.map((name, index) => {
          const state = index < position.chapterIndex ? 'completed' : index === position.chapterIndex ? 'current' : 'upcoming'
          const stateLabel = state === 'completed' ? '已完成' : state === 'current' ? '当前章' : '未开始'
          return (
            <li className={`volume-progress__seal volume-progress__seal--${state}`} data-state={state} key={name} aria-current={state === 'current' ? 'step' : undefined}>
              <span aria-hidden="true">卷{index + 1}</span>
              <small>{name}</small>
              <span className="sr-only">{name} · {stateLabel}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
