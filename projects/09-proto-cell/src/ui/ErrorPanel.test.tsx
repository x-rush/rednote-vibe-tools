import { createElement, type ComponentProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ErrorPanel } from './ErrorPanel'

describe('recoverable error panel', () => {
  it('offers an in-place retry without removing the return-to-lab escape hatch', () => {
    const props = {
      title: '显微视野中断',
      description: '本局已经暂停。',
      actionLabel: '重建当前视野',
      onAction: () => undefined,
      secondaryActionLabel: '返回培养舱',
      onSecondaryAction: () => undefined,
    } as ComponentProps<typeof ErrorPanel> & { secondaryActionLabel: string; onSecondaryAction(): void }

    const html = renderToStaticMarkup(createElement(ErrorPanel, props))

    expect(html).toContain('重建当前视野')
    expect(html).toContain('返回培养舱')
  })
})
