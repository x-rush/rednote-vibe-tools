import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { messages } from '../content/messages'
import { PhraseCarousel } from './PhraseCarousel'

describe('phrase carousel', () => {
  it('renders scene lettering without a card or letter surface', () => {
    const html = renderToStaticMarkup(
      <PhraseCarousel
        state={{ tag: 'selected', run: 0, messageId: messages[0]?.id ?? '' }}
        selected={messages[0]}
        visibleMessages={messages.slice(0, 5)}
        progress={1}
      />,
    )
    expect(html).toContain('data-phrase-treatment="light-dust"')
    expect(html).not.toContain('card')
    expect(html).not.toContain('letter-sheet')
  })

  it('hides neighboring candidates after selection', () => {
    const html = renderToStaticMarkup(
      <PhraseCarousel
        state={{ tag: 'selected', run: 0, messageId: messages[0]?.id ?? '' }}
        selected={messages[0]}
        visibleMessages={messages.slice(0, 5)}
        progress={1}
      />,
    )
    expect(html.match(/data-phrase-row/g)).toHaveLength(1)
  })

  it('renders five candidates while spinning', () => {
    const html = renderToStaticMarkup(
      <PhraseCarousel
        state={{ tag: 'spinning', run: 0 }}
        visibleMessages={messages.slice(0, 5)}
        progress={0}
      />,
    )
    expect(html.match(/data-phrase-row/g)).toHaveLength(5)
  })

  it('keeps chance-wheel phrases obscured and reserves character reveal for the final selection', () => {
    const center = messages[2]
    if (!center) throw new Error('Expected a center message')
    const spinning = renderToStaticMarkup(
      <PhraseCarousel
        state={{ tag: 'spinning', run: 0 }}
        visibleMessages={messages.slice(0, 5)}
        progress={0}
      />,
    )
    const selected = renderToStaticMarkup(
      <PhraseCarousel
        state={{ tag: 'selected', run: 0, messageId: center.id }}
        selected={center}
        visibleMessages={messages.slice(0, 5)}
        progress={1}
      />,
    )

    expect(spinning).toContain('data-phrase-mode="chance"')
    expect(spinning).toMatch(/<div class="phrase-carousel[^>]+aria-hidden="true"/)
    expect(spinning).not.toContain('data-phrase-char')
    expect(spinning).not.toContain(center.text)
    expect(selected.match(/data-phrase-char/g)).toHaveLength(center.text.length)
    expect(selected).not.toMatch(/<div class="phrase-carousel[^>]+aria-hidden="true"/)
    const revealDuration = Number(selected.match(/data-reveal-total-ms="(\d+)"/)?.[1])
    expect(revealDuration).toBeLessThanOrEqual(700)
  })
})
