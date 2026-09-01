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

  it('splits the central phrase into characters for a staggered stardust reveal', () => {
    const center = messages[2]
    if (!center) throw new Error('Expected a center message')
    const html = renderToStaticMarkup(
      <PhraseCarousel
        state={{ tag: 'spinning', run: 0 }}
        visibleMessages={messages.slice(0, 5)}
        progress={0}
      />,
    )
    expect(html.match(/data-phrase-char/g)).toHaveLength(center.text.length)
  })
})
