import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { messages } from '../content/messages'
import { StarbornePhrase } from './StarbornePhrase'

describe('star-borne phrase', () => {
  it('hides flying glyphs from assistive technology and announces only the complete sentence', () => {
    const message = messages[0]
    if (!message) throw new Error('Expected a message')
    const flying = renderToStaticMarkup(
      <StarbornePhrase message={message} progress={0.55} complete={false} reducedMotion={false} />,
    )
    const complete = renderToStaticMarkup(
      <StarbornePhrase message={message} progress={1} complete reducedMotion={false} />,
    )
    expect(flying).toContain('data-letter-flight="true"')
    expect(flying).toContain('aria-hidden="true"')
    expect(flying).not.toContain('aria-live="polite"')
    expect(complete).toContain('aria-live="polite"')
    expect(complete).toContain(message.text)
  })

  it('renders one ordered glyph span per Unicode character', () => {
    const first = messages[0]
    if (!first) throw new Error('Expected a message')
    const message = { ...first, text: '星，风。' }
    const html = renderToStaticMarkup(
      <StarbornePhrase message={message} progress={1} complete reducedMotion={false} />,
    )
    expect(html.match(/data-flight-char/g)).toHaveLength(Array.from(message.text).length)
  })
})
