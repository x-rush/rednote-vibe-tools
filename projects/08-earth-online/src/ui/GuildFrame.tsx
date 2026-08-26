import type { Quest, UiContent } from '../content/schema'
import type { GuildDomainState } from '../domain/quests'
import type { PageState } from '../app/state'
import { levelFromXp } from '../domain/progression'
import { assets } from './asset-paths'

type GuildFrameProps = {
  ui: UiContent
  page: PageState
  level: number
  xp: number
  hideNavigation?: boolean
  onNavigate: (page: 'guildHall' | 'questHistory' | 'badgeList' | 'adventurerProfile') => void
  onHelp: () => void
  helpButtonRef?: React.RefObject<HTMLButtonElement | null>
  children: React.ReactNode
}

export function GuildFrame({ ui, page, level, xp, hideNavigation = false, onNavigate, onHelp, helpButtonRef, children }: GuildFrameProps) {
  const progress = levelFromXp(xp)
  const levelSpan = Math.max(1, progress.nextLevelXp - progress.levelStartXp)

  return (
    <div className="app-shell">
      <header className="safe-header">
        <div className="safe-header__bar">
          <button className="guild-mark" type="button" aria-label={ui.brand.shortTitle} onClick={() => onNavigate('guildHall')}><img src={assets.brand.mark} alt="" /><span className="guild-mark__title">{ui.brand.shortTitle}</span></button>
          <div className="header-actions">
            <button className="adventurer-status" type="button" aria-label={`${ui.hud.adventurerLabel} Lv.${level} · ${xp} XP`} onClick={() => onNavigate('adventurerProfile')}>
              <span className="adventurer-status__crest" aria-hidden="true">◇</span>
              <span className="adventurer-status__copy"><strong>{ui.hud.adventurerLabel}</strong><small>Lv.{level} · {xp} XP</small></span>
              <progress aria-label={ui.profile.levelProgress} value={progress.xpIntoLevel} max={levelSpan}>{progress.xpIntoLevel}/{levelSpan}</progress>
            </button>
            <button ref={helpButtonRef} className="mira-guide-chip" type="button" onClick={onHelp} aria-label={`${ui.hud.talkLabel} · ${ui.intro.name} · ${ui.hud.guideLabel}`}>
              <img src={assets.mira.avatar} alt="" width="34" height="34" />
              <span className="mira-guide-chip__copy"><strong>{ui.intro.name}</strong><small>{ui.hud.guideLabel}</small></span>
              <span className="mira-guide-chip__talk">{ui.hud.talkLabel}</span>
            </button>
          </div>
        </div>
        {!hideNavigation && <nav className="guild-navigation" aria-label={ui.brand.navigationLabel}>
          {ui.navigation.map((item) => <button key={item.id} type="button" aria-current={page === item.id ? 'page' : undefined} onClick={() => onNavigate(item.id)}><span aria-hidden="true">{navMark(item.id)}</span>{item.label}</button>)}
        </nav>}
      </header>
      <main className="guild-main">{children}</main>
      <footer className="local-footer">{ui.notices.privacy}</footer>
    </div>
  )
}

type GuildHallProps = {
  ui: UiContent
  guild: GuildDomainState
  activeQuest?: Quest
  onStart: () => void
  onContinue: () => void
}

export function GuildHall({ ui, guild, activeQuest, onStart, onContinue }: GuildHallProps) {
  if (activeQuest && guild.activeQuest) return (
    <section className="hall-scene hall-scene--active" aria-labelledby="hall-title">
      <div className="scene-copy"><p className="eyebrow">{ui.pages.questAccepted.eyebrow}</p><h1 id="hall-title">{ui.pages.questAccepted.title}</h1><p>{ui.pages.questAccepted.description}</p></div>
      <article className="active-paper">
        <img src={assets.status('active')} alt="" />
        <p>{activeQuest.timeCost} · XP {activeQuest.xp}</p>
        <h2>{activeQuest.title}</h2>
        <span>{guild.activeQuest.acceptedAt.slice(0, 16).replace('T', ' ')}</span>
      </article>
      <button className="button button--primary button--large" type="button" onClick={onContinue}>{ui.actions.continueQuest}</button>
    </section>
  )
  return (
    <section className="hall-scene" aria-labelledby="hall-title">
      <div className="scene-copy"><p className="eyebrow">{ui.brand.eyebrow}</p><h1 id="hall-title">{ui.brand.title}</h1><p>{ui.brand.description}</p></div>
      <div className="notice-board" aria-hidden="true">
        <img className="notice-board__art" src={assets.scenes.guildNoticeBoard} alt="" width="1152" height="864" />
        <span className="notice-board__magic" />
      </div>
      <button className="button button--primary button--large" type="button" onClick={onStart}>{ui.actions.start}</button>
    </section>
  )
}

function navMark(id: UiContent['navigation'][number]['id']): string {
  return ({ guildHall: '⌂', questHistory: '≡', badgeList: '◇', adventurerProfile: '○' })[id]
}
