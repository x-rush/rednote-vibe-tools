import { useState, type RefObject } from 'react'
import type { GuideTopicCopy } from '../../content/types'
import { GuideSheet } from './GuideSheet'

export type GuideTopicSheetProps = {
  title: string
  name: string
  role: string
  topics: readonly GuideTopicCopy[]
  returnFocusRef?: RefObject<HTMLButtonElement | null>
  onClose: () => void
}

export function GuideTopicSheet(props: GuideTopicSheetProps) {
  const [activeId, setActiveId] = useState(props.topics[0]?.id)
  const active = props.topics.find((topic) => topic.id === activeId) ?? props.topics[0]

  return (
    <GuideSheet
      title={props.title}
      name={props.name}
      role={props.role}
      lines={active ? [active.answer] : []}
      portrait
      portraitVariant="read-seals"
      returnFocusRef={props.returnFocusRef}
      onClose={props.onClose}
    >
      <div className="guide-topics" role="group" aria-label={`${props.title}问题`}>
        {props.topics.map((topic) => {
          const selected = topic.id === active?.id
          return (
            <button
              type="button"
              className={`guide-topic${selected ? ' guide-topic--active' : ''}`}
              aria-pressed={selected}
              onClick={() => setActiveId(topic.id)}
              key={topic.id}
            >
              {topic.label}
            </button>
          )
        })}
      </div>
      <span className="sr-only">当前回答</span>
    </GuideSheet>
  )
}
