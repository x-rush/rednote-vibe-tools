import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import rawContent from '../content/content.json'
import { validateContent } from '../content/validate'
import { generateQuizResult, generateShareCardViewModel } from '../quiz/scoring'
import { selectQuestionIds } from '../quiz/selection'
import { ResultPage } from './ResultPage'

const content = validateContent(rawContent)

it('keeps Wenshan as a secondary result-help entry beside the beast profile', () => {
  const questionIds = selectQuestionIds(content, 'result-guide-test')
  const answers = questionIds.map((questionId) => {
    const question = content.content.questions.find((item) => item.id === questionId)!
    return { questionId, optionId: question.options[0].id }
  })
  const result = generateQuizResult(questionIds, answers, content)
  const profile = content.content.resultTypes.find((item) => item.code === result.code)!
  const neighbor = content.content.resultTypes.find((item) => item.code === result.summary.neighborCode)!
  const neighborCreature = content.content.creatures.find((item) => item.id === neighbor.creatureId)!
  const html = renderToStaticMarkup(
    <ResultPage
      result={result}
      profile={profile}
      neighborLabel={`${neighborCreature.name} · ${neighbor.chineseName}`}
      share={generateShareCardViewModel(result, content)}
      guide={content.content.experience.guide}
      identity={content.content.experience.identity}
      shareCardCopy={content.content.experience.shareCard}
      dimensionDefinitions={content.content.dimensions}
      onHome={vi.fn()}
      onRestart={vi.fn()}
    />,
  )

  expect(html).toContain('guide-presence--compact')
  expect(html).toContain('请闻山解释这份兽志')
  expect(html).toContain(profile.recognitionCard.kicker)
  expect(html).toContain(profile.recognitionCard.hook)
  expect(html).toContain(profile.recognitionCard.blessing)
  expect(html.indexOf('guide-presence--compact')).toBeLessThan(html.indexOf('beast-recognition-card'))
  expect(html.indexOf('beast-recognition-card')).toBeLessThan(html.indexOf('卷一 · 本相'))
  expect(html).toContain(`${result.summary.creatureName} · ${result.summary.typeName}`)
  expect(html).toContain('卷一 · 本相')
  expect(html).toContain('卷三 · 天赋与行旅')
  expect(html).toContain('卷五 · 风浪与回山')
  expect(html).toContain('可分享兽志签')
  expect(html).toContain('生成我的兽志卡')
  expect(html).toContain('闻山把异兽、本次四维足迹与批注誊成一张可保存的兽志卡。')
  expect(html).toContain((profile as typeof profile & { wenshanNote: string }).wenshanNote)
  for (const quote of (profile as typeof profile & { shareQuotes: string[] }).shareQuotes) expect(html).toContain(quote)
  expect(html).not.toContain(result.code)
  expect(html).not.toContain(result.summary.neighborCode)
})
