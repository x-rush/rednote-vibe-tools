import { useRef, useState } from 'react'
import type { ChapterDefinition, ChapterCode, GuideCopy } from '../content/types'
import { deriveGuideMoment } from '../guide/guideMoment'
import { deriveQuizCompanionLine } from '../guide/quizCompanion'
import { completeInterlude, initialInterlude, requestAdvanceInterlude, type QuizInterlude } from '../guide/interludeState'
import { ChapterInterlude } from './ChapterInterlude'
import { GuideTopicSheet } from './guide/GuideTopicSheet'
import { QuizPage, type QuizPageProps } from './QuizPage'

type QuizExperienceProps = Omit<QuizPageProps, 'guide' | 'guideLine' | 'onGuideOpen'> & {
  guide: GuideCopy
  chapters: ChapterDefinition[]
}

export function QuizExperience(props: QuizExperienceProps) {
  const current = props.current
  const [interlude, setInterlude] = useState<QuizInterlude | undefined>(() => initialInterlude(current))
  const [helpOpen, setHelpOpen] = useState(false)
  const [furthestCurrent, setFurthestCurrent] = useState(current)
  const completedTransitionsRef = useRef(new Set<number>())
  const guideReturnRef = useRef<HTMLButtonElement | null>(null)
  const revisiting = current < furthestCurrent
  const guideLine = deriveQuizCompanionLine({
    chapter: props.chapter.id,
    current: props.current,
    selected: Boolean(props.selectedOptionId),
    revisiting,
  }, props.guide.quizCompanion)
  const guideMoment = deriveGuideMoment({
    screen: 'quiz',
    requestedHelp: helpOpen ? 'quiz' : undefined,
    interlude: interlude ? { mode: interlude.mode, chapter: interlude.chapter } : undefined,
  })

  function chapterById(id: ChapterCode) {
    return props.chapters.find((chapter) => chapter.id === id)!
  }

  function advance() {
    setFurthestCurrent((previous) => Math.max(previous, current + 1))
    props.onNext()
  }

  function requestNext() {
    const nextInterlude = requestAdvanceInterlude(current, completedTransitionsRef.current)
    if (nextInterlude) setInterlude(nextInterlude)
    else advance()
  }

  function finishInterlude() {
    if (!interlude) return
    const completion = completeInterlude(interlude)
    if (completion.shouldAdvance) {
      completedTransitionsRef.current.add(current)
      advance()
    }
    setInterlude(completion.next)
  }

  function openHelp(trigger: HTMLButtonElement) {
    guideReturnRef.current = trigger
    setHelpOpen(true)
  }

  const interludeChapter = interlude ? chapterById(interlude.chapter) : undefined

  return (
    <>
      <QuizPage
        {...props}
        guide={props.guide}
        guideLine={guideLine}
        onNext={requestNext}
        onPrevious={() => {
          setInterlude(undefined)
          props.onPrevious()
        }}
        onGuideOpen={openHelp}
      />
      {interlude && interludeChapter && (guideMoment?.kind === 'chapter-start' || guideMoment?.kind === 'chapter-end') && (
        <ChapterInterlude mode={interlude.mode} chapter={interludeChapter} copy={props.guide} onComplete={finishInterlude} />
      )}
      {guideMoment?.kind === 'quiz-help' && (
        <GuideTopicSheet
          title={props.guide.quizCompanion.title}
          name={props.guide.name}
          role={props.guide.role}
          topics={props.guide.quizCompanion.topics}
          returnFocusRef={guideReturnRef}
          onClose={() => setHelpOpen(false)}
        />
      )}
    </>
  )
}
