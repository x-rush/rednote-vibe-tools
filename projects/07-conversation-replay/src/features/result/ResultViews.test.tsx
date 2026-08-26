import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import rawContent from '../../content/content.json'
import { parseContent } from '../../content/validate'
import type { ReplayResultV2 } from '../../domain/replay'
import { BeforeAfter, ReplayCard } from './ResultViews'

const copy = parseContent(rawContent).content.intro

const result: ReplayResultV2 = {
  scenarioId: 'friend-late',
  scenarioTitle: '朋友迟到',
  layers: {
    facts: ['约定十五点见面，对方十五点三十五分到达。'],
    feelings: ['担心'],
    inferences: ['你根本不在乎我。'],
    needs: ['及时沟通'],
    request: '下次晚到十分钟以上，请提前告诉我。',
  },
  tones: {
    gentle: '柔和表达',
    direct: '直接表达',
    firm: '坚定表达',
  },
  selectedTone: 'direct',
  selectedText: '下次晚到十分钟以上，请提前告诉我。',
  summary: '把人格评价换成时间事实和通知请求。',
  shareSummary: '迟到沟通：事实、影响、可执行通知。',
  nextSteps: [],
}

describe('ReplayCard', () => {
  it('shows all five replay layers and marks inferences as unverified', () => {
    const html = renderToStaticMarkup(<ReplayCard result={result} copy={copy} />)

    expect(html).toContain('事实')
    expect(html).toContain('感受')
    expect(html).toContain('推测（待核对）')
    expect(html).toContain('你根本不在乎我。')
    expect(html).toContain('需要')
    expect(html).toContain('请求')
  })

  it('keeps inference visible and marked as unverified in the structure comparison', () => {
    const html = renderToStaticMarkup(<BeforeAfter result={result} copy={copy} onNext={() => undefined} />)

    expect(html).toContain('<dt>推测（待核对）</dt>')
    expect(html).toContain('你根本不在乎我。')
  })
})
