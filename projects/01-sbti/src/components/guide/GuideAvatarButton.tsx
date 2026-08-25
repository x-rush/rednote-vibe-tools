import type { ExperienceCopy } from '../../content/types'
import { GuidePresence } from './GuidePresence'

export function GuideAvatarButton({ copy, onOpen }: { copy: ExperienceCopy['guide']; onOpen: (trigger: HTMLButtonElement) => void }) {
  return (
    <GuidePresence name={copy.name} role={copy.role} line={copy.landing.fresh} onOpen={onOpen} />
  )
}
