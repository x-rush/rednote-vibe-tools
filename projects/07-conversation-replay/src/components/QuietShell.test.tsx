import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { QuietShell } from './QuietShell'

describe('QuietShell', () => {
  it('uses Chiyan avatar as the help entry', () => {
    const html = renderToStaticMarkup(
      <QuietShell
        canGoBack={false}
        saveMode="ephemeral"
        onBack={() => undefined}
        onSaved={() => undefined}
        onHelp={() => undefined}
      >
        <p>当前页面</p>
      </QuietShell>,
    )

    expect(html).toContain('aria-label="问迟言"')
    expect(html).toContain('guide-entry-avatar')
    expect(html).toContain('guide-entry-label')
    expect(html).toContain('/assets/guide/chiyan-guide-master.webp')
    expect(html).toContain('>问迟言<')
  })
})
