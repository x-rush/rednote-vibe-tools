import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { EventResolutionView, EventView } from '../state/view-model'
import { EventChoicePanel, EventResultPanel, EventSettlementSummary, EventSituation } from './EventExperience'

const event: EventView = {
  id: 'event-old-customer',
  title: '檐下旧客',
  content: '骤雨压低檐角，常来买熟水的脚夫收伞站到柜前。',
  assetId: 'event-old-customer-illustration',
  category: 'customer',
  isChain: false,
  scene: {
    timing: 'business',
    timingLabel: '营业中',
    location: 'counter',
    locationLabel: '柜前',
    actorRole: 'worker',
    actorLabel: '脚夫',
  },
  choices: [
    {
      choiceId: 'a',
      text: '请他进来坐定',
      impactHints: [
        { axis: 'money', direction: 'down', text: '眼下少收两文' },
        { axis: 'relationships', direction: 'up', text: '街坊人情会上升' },
      ],
    },
    {
      choiceId: 'b',
      text: '包好让他带走',
      impactHints: [{ axis: 'future', direction: 'uncertain', text: '可能留下后续' }],
    },
  ],
}

const resolution: EventResolutionView = {
  eventId: event.id,
  choiceId: 'a',
  title: event.title,
  choiceText: event.choices[0].text,
  resultText: '旧客把伞靠在门边，喝完才走，临走替你扶正了招牌。',
  deltas: [
    { id: 'money', label: '资金', value: -2 },
    { id: 'relationships', label: '人情', value: 4 },
  ],
  modifierDetails: [{ label: '脚夫客流增加', remainingDays: 3, remainingText: '还将持续 3 日' }],
  chainTitle: '诗债与回声',
  chainStatusLabel: '这条街坊故事仍在继续',
}

describe('semantic event experience', () => {
  it('renders situation identity as text independent of its image', () => {
    const html = renderToStaticMarkup(<EventSituation event={event} eyebrow="铺中来事" continueLabel="看看如何处置" onContinue={() => {}} />)
    expect(html).toContain('营业中')
    expect(html).toContain('柜前')
    expect(html).toContain('脚夫')
    expect(html).toContain('骤雨压低檐角')
    expect(html).toContain('alt="脚夫 · 柜前"')
    expect(html).toContain('class="event-character-stage"')
  })

  it('renders full Chinese hints and explicit selection semantics', () => {
    const html = renderToStaticMarkup(<EventChoicePanel
      event={event}
      selectedChoiceId="a"
      isSubmitting={false}
      selectedLabel="已选，确认前仍可更换"
      confirmLabel="确认选择"
      onSelect={() => {}}
      onConfirm={() => {}}
    />)
    expect(html).toContain('眼下少收两文')
    expect(html).toContain('街坊人情会上升')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('aria-pressed="false"')
    expect(html).not.toMatch(/>[MERHFXC]</)

    const submittingHtml = renderToStaticMarkup(<EventChoicePanel
      event={event}
      selectedChoiceId="a"
      isSubmitting
      selectedLabel="已选，确认前仍可更换"
      confirmLabel="确认选择"
      onSelect={() => {}}
      onConfirm={() => {}}
    />)
    expect(submittingHtml).toContain('aria-pressed="true"')
    expect(submittingHtml).toContain('disabled')
    expect(submittingHtml).toContain('aria-busy="true"')
  })

  it('renders the confirmed result, signed deltas, modifiers, and chain clue', () => {
    const html = renderToStaticMarkup(<EventResultPanel resolution={resolution} acknowledgeLabel="记下结果" onAcknowledge={() => {}} />)
    expect(html).toContain('旧客把伞靠在门边')
    expect(html).toContain('-2')
    expect(html).toContain('+4')
    expect(html).toContain('脚夫客流增加 · 还将持续 3 日')
    expect(html).toContain('role="status"')
    expect(html).not.toMatch(/>[MERHFXC]</)
  })

  it('repeats result text, deltas, modifier duration, and chain progress at settlement', () => {
    const html = renderToStaticMarkup(<EventSettlementSummary resolution={resolution} title="今日事件回响" chainLabel="连锁进展" />)
    expect(html).toContain('今日事件回响')
    expect(html).toContain('旧客把伞靠在门边')
    expect(html).toContain('+4')
    expect(html).toContain('还将持续 3 日')
    expect(html).toContain('连锁进展 · 诗债与回声')
  })
})
