import rawContent from './content/content.json'
import { validateContent } from './content/validate'
import { useSbtiApp } from './app/useSbtiApp'
import { generateShareCardViewModel } from './quiz/scoring'
import { CalculatingPage } from './components/CalculatingPage'
import { ErrorPage } from './components/ErrorPage'
import { HistoryPage } from './components/HistoryPage'
import { IntroPage } from './components/IntroPage'
import { LandingPage } from './components/LandingPage'
import { QuizPage } from './components/QuizPage'
import { ResultPage } from './components/ResultPage'
import './App.css'

const contentResult = (() => {
  try { return { content: validateContent(rawContent) } }
  catch (error) { return { error: error instanceof Error ? error.message : '内容包未能读取。' } }
})()

function ValidatedApp() {
  const content = contentResult.content!
  const app = useSbtiApp(content)
  const copy = content.content.experience

  if (app.state.screen === 'error') return <ErrorPage message={app.state.message ?? '内容或本机数据异常。'} onRecover={() => app.dispatch({ type: 'RECOVER' })} />
  if (app.state.screen === 'intro') return <IntroPage copy={copy} onBack={() => app.dispatch({ type: 'HOME' })} onStart={() => app.start()} />
  if (app.state.screen === 'quiz' && app.state.progress && app.currentQuestion) {
    const chapter = content.content.chapters.find((item) => item.id === app.currentQuestion!.chapterId)!
    return <QuizPage question={app.currentQuestion} chapter={chapter} current={app.state.progress.currentIndex + 1} total={app.state.progress.questionIds.length} selectedOptionId={app.selectedOptionId} message={app.state.message} onChoose={app.choose} onPrevious={() => app.dispatch({ type: 'PREVIOUS' })} onNext={() => app.dispatch({ type: 'NEXT' })} onSubmit={() => app.dispatch({ type: 'SUBMIT' })} />
  }
  if (app.state.screen === 'calculating') return <CalculatingPage message={copy.calculating} />
  if (app.state.screen === 'result' && app.state.result) {
    const profile = content.content.resultTypes.find((item) => item.code === app.state.result!.code)!
    return <ResultPage result={app.state.result} profile={profile} share={generateShareCardViewModel(app.state.result, content)} onHome={() => app.dispatch({ type: 'HOME' })} onRestart={app.restart} />
  }
  if (app.state.screen === 'history') return <HistoryPage result={app.state.recentResult} emptyText={copy.emptyHistory} onOpen={() => app.dispatch({ type: 'OPEN_RECENT_RESULT' })} onBack={() => app.dispatch({ type: 'HOME' })} />
  return <LandingPage copy={copy} canContinue={Boolean(app.state.progress)} hasRecent={Boolean(app.state.recentResult)} muted={app.settings.muted} reducedMotion={app.settings.reducedMotion} onIntro={() => app.dispatch({ type: 'OPEN_INTRO' })} onContinue={() => app.state.progress && app.dispatch({ type: 'RESTORE', progress: app.state.progress })} onHistory={() => app.dispatch({ type: 'OPEN_HISTORY' })} onMuted={app.setMuted} onReducedMotion={app.setReducedMotion} onClear={app.clearAll} />
}

function App() {
  if (contentResult.error) return <ErrorPage message={contentResult.error} onRecover={() => window.location.reload()} />
  return <ValidatedApp />
}

export default App
