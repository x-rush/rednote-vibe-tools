import contactIcon from '../assets/art/topic-contact.svg'
import listeningIcon from '../assets/art/topic-listening.svg'
import conflictIcon from '../assets/art/topic-conflict.svg'
import spaceIcon from '../assets/art/topic-space.svg'
import careIcon from '../assets/art/topic-care.svg'
import boundaryIcon from '../assets/art/topic-boundary.svg'
import repairIcon from '../assets/art/topic-repair.svg'
import type {
  CardSectionId,
  QuestionnaireAnswer,
  RelationshipCategory,
  RelationshipQuestion,
} from '../content/schema'
import { validateSelection } from '../domain/answers'

export type TopicStatus = 'complete' | 'current' | 'upcoming'

export type TopicArtwork = {
  category: RelationshipCategory
  label: string
  description: string
  iconUrl: string
}

export type TopicProgressItem = TopicArtwork & {
  status: TopicStatus
  answeredCount: number
  questionCount: number
}

const TOPIC_ARTWORK: Record<RelationshipCategory, TopicArtwork> = {
  contact: { category: 'contact', label: '联系', description: '联系节奏', iconUrl: contactIcon },
  listening: { category: 'listening', label: '倾听', description: '倾听回应', iconUrl: listeningIcon },
  conflict: { category: 'conflict', label: '分歧', description: '分歧沟通', iconUrl: conflictIcon },
  space: { category: 'space', label: '空间', description: '独处空间', iconUrl: spaceIcon },
  care: { category: 'care', label: '关心', description: '关心表达', iconUrl: careIcon },
  boundary: { category: 'boundary', label: '边界', description: '隐私边界', iconUrl: boundaryIcon },
  repair: { category: 'repair', label: '修复', description: '修复承诺', iconUrl: repairIcon },
}

const TOPIC_ORDER: RelationshipCategory[] = [
  'contact',
  'listening',
  'conflict',
  'space',
  'care',
  'boundary',
  'repair',
]

export function buildTopicProgress(
  questions: RelationshipQuestion[],
  currentQuestionIndex: number,
  answers: QuestionnaireAnswer[],
): TopicProgressItem[] {
  const activeCategory = questions[currentQuestionIndex]?.category
  const answersByQuestionId = new Map(answers.map((answer) => [answer.questionId, answer]))

  return TOPIC_ORDER.map((category) => {
    const topicQuestions = questions.filter((question) => question.category === category)
    const answeredCount = topicQuestions.filter((question) => {
      const answer = answersByQuestionId.get(question.questionId)
      return answer ? validateSelection(question, answer.optionIds, answer.skipped).valid : false
    }).length
    const status: TopicStatus = category === activeCategory
      ? 'current'
      : answeredCount === topicQuestions.length
        ? 'complete'
        : 'upcoming'

    return {
      ...TOPIC_ARTWORK[category],
      status,
      answeredCount,
      questionCount: topicQuestions.length,
    }
  })
}

export function getTopicArtwork(category: RelationshipCategory): TopicArtwork {
  return TOPIC_ARTWORK[category]
}

export function getCardSectionArtwork(sectionId: CardSectionId): TopicArtwork & { shortLabel: string } {
  const artwork = TOPIC_ARTWORK[sectionId]
  return { ...artwork, shortLabel: artwork.label }
}

export function resetViewport(scrollTo: (options: ScrollToOptions) => void): void {
  scrollTo({ top: 0, left: 0, behavior: 'auto' })
}
