import rawContent from '../content/content.json'
import { describe, expect, it } from 'vitest'
import { validateContent } from '../content/validate'
import type { QuizResult } from '../quiz/types'
import { generateShareCardViewModel } from '../quiz/scoring'
import { createShareCardModel } from './shareCardModel'

const content = validateContent(rawContent)

const result: QuizResult = {
  code: 'RTLS',
  completedAt: '2026-08-25T00:00:00.000Z',
  contentVersion: content.contentVersion,
  summary: {
    code: 'RTLS',
    typeName: '镇岳守序者',
    creatureId: 'luwu',
    creatureName: '陆吾',
    coreDescription: '你习惯先看清边界，再稳稳守住值得托付的秩序。',
    neighborCode: 'RTLM',
    dimensions: [
      { dimension: 'RH', leftPole: 'R', rightPole: 'H', leftScore: 8, rightScore: 4, preferredPole: 'R', strength: 1 / 3, label: '轻偏', isBalanced: false },
      { dimension: 'TV', leftPole: 'T', rightPole: 'V', leftScore: 9, rightScore: 3, preferredPole: 'T', strength: 1 / 2, label: '明显偏好', isBalanced: false },
      { dimension: 'LE', leftPole: 'L', rightPole: 'E', leftScore: 7, rightScore: 5, preferredPole: 'L', strength: 1 / 6, label: '轻偏', isBalanced: false },
      { dimension: 'SM', leftPole: 'S', rightPole: 'M', leftScore: 10, rightScore: 2, preferredPole: 'S', strength: 2 / 3, label: '明显偏好', isBalanced: false },
    ],
  },
}

describe('share card model', () => {
  it('turns a result into a Chinese-only public card without internal result codes', () => {
    const profile = content.content.resultTypes.find((item) => item.code === result.code)!
    const model = createShareCardModel({
      result,
      profile,
      share: generateShareCardViewModel(result, content),
      dimensions: content.content.dimensions,
      identity: content.content.experience.identity,
      copy: content.content.experience.shareCard,
    })

    expect(model).toMatchObject({
      creatureName: '陆吾',
      typeName: '山司型',
      preferredPoles: ['应世', '察微', '衡理', '守形'],
      brand: 'SHBTI｜山海兽格测试',
      boundary: '娱乐性自我探索工具，不是专业心理测评。',
      imageSrc: './assets/shbti/beasts/luwu/profile-v2-reference-verified.webp',
      placeholderSrc: './assets/shbti/beasts/luwu/placeholder-v2.webp',
      imageFocusY: 0.5,
    })
    expect(JSON.stringify(model)).not.toContain('RTLS')
    expect(JSON.stringify(model)).not.toContain('RH')
  })
})
