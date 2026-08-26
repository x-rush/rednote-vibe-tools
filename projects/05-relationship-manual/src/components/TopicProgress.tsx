import type { TopicProgressItem } from '../app/presentation'

export function TopicProgress({ topics }: { topics: TopicProgressItem[] }) {
  return (
    <nav className="topic-progress" aria-label="七个整理主题">
      {topics.map((topic) => (
        <span className={`topic-progress__item topic-progress__item--${topic.status}`} key={topic.category} aria-current={topic.status === 'current' ? 'step' : undefined}>
          <span className="topic-progress__icon"><img src={topic.iconUrl} alt="" /></span>
          <span>{topic.label}</span>
        </span>
      ))}
    </nav>
  )
}
