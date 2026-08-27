import { useEffect, useState, type ReactNode } from 'react'

interface ScreenFrameProps {
  children: ReactNode
  className?: string
  labelledBy?: string
  surface: 'dark' | 'paper'
}

export function ScreenFrame({ children, className = '', labelledBy, surface }: ScreenFrameProps) {
  const [entering, setEntering] = useState(true)

  useEffect(() => {
    const timeout = window.setTimeout(() => setEntering(false), 220)
    return () => window.clearTimeout(timeout)
  }, [])

  return <main
    id="screen-root"
    className={`app-shell surface-${surface} ${entering ? 'screen-entering ' : ''}${className}`.trim()}
    aria-labelledby={labelledBy}
    tabIndex={-1}
  >
    {children}
  </main>
}
