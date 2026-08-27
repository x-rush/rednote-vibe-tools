import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { FinancialCrisisView } from '../state/view-model'
import { FinancialCrisis } from './FinancialCrisis'

const crisis: FinancialCrisisView = {
  title: '三日周转', status: '铺子还有一次把账救回来的机会。', phase: 'offer', rescueUsed: false,
  contracts: [
    { contractId: 'crisis-pawn', title: '典当备用铜壶', content: '先换回周转钱。', eligible: true, immediateBenefit: '+28 文', obligation: '未来 7 个营业日，每日多耗 2 点体力' },
    { contractId: 'crisis-credit', title: '请街坊联保赊账', content: '由街坊作保。', eligible: false, immediateBenefit: '+22 文', obligation: '第 4 日与第 7 日各归还 11 文' },
  ],
}

const copy = {
  crisisGraceLabel: '转正期限', crisisImmediateBenefit: '眼前可得', crisisObligationLabel: '随后要承担',
  crisisAccept: '确认这份周转契约', crisisIneligible: '尚未满足条件', crisisUsed: '机会已使用', nextDay: '继续经营',
  crisisContinue: '继续今日经营',
  crisisFailureContinue: '记下失约，处理最后期限',
  crisisCloseContinue: '合上账页，查看停业结果',
  crisisSuccessContinue: '记下履约，查看周转结果',
}

describe('financial crisis Galgame screen', () => {
  it('shows the one-time choice, exact obligations and disabled ineligible contracts', () => {
    const html = renderToStaticMarkup(<FinancialCrisis crisis={crisis} copy={copy} isSubmitting={false} onAccept={() => {}} onAcknowledge={() => {}} />)
    expect(html).toContain('三日周转')
    expect(html).toContain('未来 7 个营业日，每日多耗 2 点体力')
    expect(html).toContain('第 4 日与第 7 日各归还 11 文')
    expect(html).toContain('ayuan-stage-crisis')
    expect(html).toContain('disabled=""')
    expect(html).toContain('尚未满足条件')
  })

  it('renders a pending story consequence as an acknowledgement scene', () => {
    const html = renderToStaticMarkup(<FinancialCrisis crisis={{ ...crisis, phase: 'grace', graceDaysRemaining: 2, pendingScene: {
      title: '铜壶离柜', content: '二十八文推到你面前。', assetId: 'event-shop-renovation-illustration', actorRole: 'merchant', actorLabel: '行商掌事', trigger: 'accepted',
    } }} copy={copy} isSubmitting={false} onAccept={() => {}} onAcknowledge={() => {}} />)
    expect(html).toContain('铜壶离柜')
    expect(html).toContain('二十八文推到你面前')
    expect(html).toContain('src="./assets/customers/merchant.webp"')
    expect(html).toContain('继续今日经营')
    expect(html).not.toContain('确认这份周转契约')
  })

  it.each([
    ['target-failure', '记下失约，处理最后期限'],
    ['grace-failure', '合上账页，查看停业结果'],
  ] as const)('gives %s scenes an action matching their real destination', (trigger, expectedAction) => {
    const html = renderToStaticMarkup(<FinancialCrisis crisis={{ ...crisis, phase: 'grace', pendingScene: {
      title: '账期结果', content: '这一笔已经有了结果。', assetId: 'ending-closed-early-illustration', actorRole: 'elder', actorLabel: '老客', trigger,
    } }} copy={copy} isSubmitting={false} onAccept={() => {}} onAcknowledge={() => {}} />)
    expect(html).toContain(expectedAction)
    expect(html).not.toContain('继续今日经营')
  })

  it('does not promise ordinary business when deadline success still has a closing scene to show', () => {
    const html = renderToStaticMarkup(<FinancialCrisis crisis={{ ...crisis, phase: 'normal', pendingScene: {
      title: '第十二盏如约交出', content: '熟客付清尾款。', assetId: 'event-old-regular-illustration', actorRole: 'elder', actorLabel: '老客', trigger: 'target-success',
    } }} copy={copy} isSubmitting={false} onAccept={() => {}} onAcknowledge={() => {}} />)
    expect(html).toContain('记下履约，查看周转结果')
    expect(html).not.toContain('继续今日经营')
  })
})
