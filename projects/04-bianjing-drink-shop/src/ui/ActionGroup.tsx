import type { ReactNode } from 'react'

export function ActionGroup({ layout, surface, children }: {
  layout: 'stack' | 'split'
  surface: 'dark' | 'paper'
  children: ReactNode
}) {
  const layoutClass = layout === 'stack' ? 'action-stack' : 'split-actions'
  return <div className={`${layoutClass} action-surface-${surface}`}>{children}</div>
}
