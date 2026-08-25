import rawContent from './content/content.json'
import { validateContent } from './content/validate'
import { useSbtiApp } from './app/useSbtiApp'
import { generateShareCardViewModel } from './quiz/scoring'
import { CalculatingPage } from './components/CalculatingPage'
import { ErrorPage } from './components/ErrorPage'
import { HistoryPage } from './components/HistoryPage'
import { IntroPage } from './components/IntroPage'
import { LandingPage } from './components/LandingPage'
import { QuizExperience } from './components/QuizExperience'
import { ResultPage } from './components/ResultPage'
import { effectiveReducedMotion, useSystemReducedMotion } from './ui/reducedMotion'
import './App.css'

const contentResult = (() => {
  try { return { content: validateContent(rawContent) } }
  catch (error) { return { error: error instanceof Error ? error.message : '内容包未能读取。' } }
})()

function ValidatedApp() {
  const content = contentResult.content!
  const app = useSbtiApp(content)
  const systemReducedMotion = useSystemReducedMotion()
  const reducedMotion = effectiveReducedMotion(app.settings.reducedMotion, systemReducedMotion)
  const copy = content.content.experience
  const continuationChapter = app.state.progress && app.currentQuestion
    ? content.content.chapters.find((item) => item.id === app.currentQuestion!.chapterId)
    : undefined
  const continuation = app.state.progress && continuationChapter ? {
    chapterLabel: `卷${continuationChapter.order} · ${continuationChapter.name}`,
    chapterId: continuationChapter.id,
    chapterName: continuationChapter.name,
    current: app.state.progress.currentIndex + 1,
    total: app.state.progress.questionIds.length,
    updatedAt: app.lastSavedAt,
  } : undefined

  if (app.state.screen === 'error') return <ErrorPage message={app.state.message ?? '内容或本机数据异常。'} reason={app.state.errorReason ?? 'storage'} recoveryKind={app.state.recoveryKind} guide={copy.guide} onRecover={() => app.dispatch({ type: 'RECOVER' })} />
  if (app.state.screen === 'intro') return <IntroPage copy={copy} onBack={() => app.dispatch({ type: 'HOME' })} onStart={() => app.start()} />
  if (app.state.screen === 'quiz' && app.state.progress && app.currentQuestion) {
    const chapter = content.content.chapters.find((item) => item.id === app.currentQuestion!.chapterId)!
    return <QuizExperience question={app.currentQuestion} chapter={chapter} chapters={content.content.chapters} guide={copy.guide} current={app.state.progress.currentIndex + 1} total={app.state.progress.questionIds.length} selectedOptionId={app.selectedOptionId} message={app.state.message} onChoose={app.choose} onPrevious={() => app.dispatch({ type: 'PREVIOUS' })} onNext={() => app.dispatch({ type: 'NEXT' })} onSubmit={() => app.dispatch({ type: 'SUBMIT' })} />
  }
  if (app.state.screen === 'calculating') return <CalculatingPage guide={copy.guide} dimensions={content.content.dimensions} reducedMotion={reducedMotion} onComplete={app.completeReveal} />
  if (app.state.screen === 'result' && app.state.result) {
    const profile = content.content.resultTypes.find((item) => item.code === app.state.result!.code)!
    const neighbor = content.content.resultTypes.find((item) => item.code === app.state.result!.summary.neighborCode)
    const neighborCreature = neighbor && content.content.creatures.find((item) => item.id === neighbor.creatureId)
    if (!neighbor || !neighborCreature) return <ErrorPage message="相邻兽格映射缺失。" reason="content" guide={copy.guide} onRecover={() => window.location.reload()} />
    const neighborLabel = `${neighborCreature.name} · ${neighbor.chineseName}`
    return <ResultPage result={app.state.result} profile={profile} neighborLabel={neighborLabel} share={generateShareCardViewModel(app.state.result, content)} guide={copy.guide} identity={copy.identity} shareCardCopy={copy.shareCard} dimensionDefinitions={content.content.dimensions} onHome={() => app.dispatch({ type: 'HOME' })} onRestart={app.restart} />
  }
  if (app.state.screen === 'history') return <HistoryPage result={app.state.recentResult} emptyText={copy.emptyHistory} onOpen={() => app.dispatch({ type: 'OPEN_RECENT_RESULT' })} onBack={() => app.dispatch({ type: 'HOME' })} />
  return <LandingPage copy={copy} continuation={continuation} hasRecent={Boolean(app.state.recentResult)} muted={app.settings.muted} reducedMotion={app.settings.reducedMotion} onIntro={() => app.dispatch({ type: 'OPEN_INTRO' })} onRestart={app.restart} onContinue={() => app.state.progress && app.dispatch({ type: 'RESTORE', progress: app.state.progress })} onHistory={() => app.dispatch({ type: 'OPEN_HISTORY' })} onMuted={app.setMuted} onReducedMotion={app.setReducedMotion} onClear={app.clearAll} />
}

function App() {
  if (contentResult.error) return <ErrorPage message={contentResult.error} reason="content" onRecover={() => window.location.reload()} />
  return <ValidatedApp />
}

export default App
