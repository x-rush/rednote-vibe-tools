import type { ReactNode } from 'react'

export interface AyuanStageProps {
  variant: 'tutorial' | 'morning' | 'preparation' | 'rest' | 'settlement' | 'crisis'
  tone: 'neutral' | 'positive' | 'warning'
  name: string
  role: string
  text: string
  children?: ReactNode
}

export function AyuanStage({ variant, tone, name, role, text, children }: AyuanStageProps) {
  const nameId = `ayuan-${variant}-name`
  return <aside className={`ayuan-stage ayuan-stage-${variant} ayuan-tone-${tone}`} aria-labelledby={nameId}>
    <div className={`ayuan-portrait${variant === 'morning' ? ' ayuan-portrait-natural' : ''}`}>
      <img src="./assets/guide/ayuan-master.webp" alt={name} />
    </div>
    <div className="ayuan-dialogue">
      <strong id={nameId}>{name}</strong>
      <small>{role}</small>
      <p>{text}</p>
      {children}
    </div>
  </aside>
}
