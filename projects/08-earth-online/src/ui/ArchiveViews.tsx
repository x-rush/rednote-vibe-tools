import type { BadgeDefinition, QuestCategoryDefinition, QuestHistoryEntry, UiContent } from '../content/schema'
import type { AdventurerProfileViewModel } from '../domain/progression'
import type { LogFilter } from './state'
import { assets } from './asset-paths'
import { XpBurst } from './RpgEffects'

type XpReceiptProps = {
  awardedXp: number
  completionText: string
  profile: AdventurerProfileViewModel
  newBadges: BadgeDefinition[]
  ui: UiContent
  temporary?: boolean
  onLog: () => void
  onAgain: () => void
}

export function XpReceipt({ awardedXp, completionText, profile, newBadges, ui, temporary = false, onLog, onAgain }: XpReceiptProps) {
  const levelSpan = Math.max(1, profile.nextLevelXp - profile.levelStartXp)
  return (
    <section className="xp-receipt" aria-live="polite">
      <XpBurst />
      <img className="completion-seal" src={assets.completionSeal} alt="" />
      <p className="xp-award">+{awardedXp} XP</p>
      <p className="completion-copy">{completionText}</p>
      <div className="level-progress">
        <div><span>{ui.profile.level}</span><strong>Lv.{profile.level}</strong></div>
        <progress value={profile.xpIntoLevel} max={levelSpan}>{profile.xpIntoLevel}/{levelSpan}</progress>
        <small>{ui.profile.nextLevel} · {profile.xpToNextLevel} XP</small>
      </div>
      {newBadges.length > 0 && <ul className="new-badges">{newBadges.map((badge) => <li key={badge.id}><img src={assets.badge(badge.assetId)} alt="" /><span>{ui.archive.unlocked}</span><strong>{badge.title}</strong></li>)}</ul>}
      <div className="quest-actions">
        <button className="button button--primary button--large" type="button" onClick={onLog}>{temporary ? ui.actions.backHall : ui.actions.logQuest}</button>
        <button className="button button--ghost" type="button" onClick={onAgain}>{ui.actions.again}</button>
      </div>
    </section>
  )
}

type AdventureLogProps = {
  history: QuestHistoryEntry[]
  categories: QuestCategoryDefinition[]
  filter: LogFilter
  ui: UiContent
  degraded?: boolean
  onFilter: (filter: LogFilter) => void
}

export function AdventureLog({ history, categories, filter, ui, degraded = false, onFilter }: AdventureLogProps) {
  const categoryMap = new Map(categories.map((category) => [category.id, category.name]))
  const entries = [...history].reverse().filter((entry) => filter === 'all' || entry.status === filter)
  return (
    <section className="archive-stack">
      {degraded && <p className="degraded-notice" role="status">{ui.notices.indexedDb}</p>}
      <div className="filter-tabs" aria-label={ui.pages.questHistory.title}>
        {(Object.keys(ui.archive.filters) as LogFilter[]).map((value) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => onFilter(value)}>{ui.archive.filters[value]}</button>)}
      </div>
      {entries.length === 0 ? <div className="paper-panel empty-state"><img src={assets.prop('ticket-stub')} alt="" /><p>{ui.archive.empty}</p></div> : <ol className="adventure-log">{entries.map((entry) => {
        return <li key={`${entry.acceptanceId}-${entry.status}`}>
          <img src={entry.status === 'swapped' ? assets.prop('route-slip') : assets.status(entry.status)} alt="" />
          <div><span>{categoryMap.get(entry.questCategory) ?? entry.questCategory} · {entry.occurredAt.slice(0, 10)}</span><strong>{entry.questTitle}</strong><small>{ui.archive.statuses[entry.status]} · {entry.xpAwarded} XP</small></div>
        </li>
      })}</ol>}
    </section>
  )
}

export function CategoryCodex({ categories, goals, counts, ui }: { categories: QuestCategoryDefinition[]; goals: { id: string; name: string }[]; counts: Partial<Record<QuestCategoryDefinition['id'], number>>; ui: UiContent }) {
  const goalMap = new Map(goals.map((goal) => [goal.id, goal.name]))
  return <section className="codex-grid">{categories.map((category) => {
    const count = counts[category.id] ?? 0
    return <article key={category.id} className={count > 0 ? 'codex-card codex-card--visited' : 'codex-card'}>
      <img src={assets.category(category.id)} alt="" />
      <div><h2>{category.name}</h2><p>{category.goalIds.map((id) => goalMap.get(id)).filter(Boolean).join(' · ')}</p><strong>{count > 0 ? `${ui.archive.categoryCount} · ${count}` : ui.archive.categoryEmpty}</strong></div>
    </article>
  })}</section>
}

export function BadgeShelf({ badges, unlockedIds, categories, ui }: { badges: BadgeDefinition[]; unlockedIds: string[]; categories: QuestCategoryDefinition[]; ui: UiContent }) {
  const categoryMap = new Map(categories.map((category) => [category.id, category.name]))
  return <section className="badge-shelf">{badges.map((badge) => {
    const unlocked = unlockedIds.includes(badge.id)
    return <article key={badge.id} className={unlocked ? 'badge-card badge-card--unlocked' : 'badge-card'}>
      <img src={assets.badge(badge.assetId)} alt="" />
      <div><span>{unlocked ? ui.archive.unlocked : ui.archive.locked}</span><h2>{badge.title}</h2><p>{badge.description}</p><small>{ui.archive.badgeCondition} · {badgeRuleText(badge, categoryMap, ui)}</small></div>
    </article>
  })}</section>
}

export function AdventurerProfile({ profile, ui }: { profile: AdventurerProfileViewModel; ui: UiContent }) {
  const levelSpan = Math.max(1, profile.nextLevelXp - profile.levelStartXp)
  const facts = [
    [ui.profile.level, `Lv.${profile.level}`],
    [ui.profile.totalXp, `${profile.xp} XP`],
    [ui.profile.completed, String(profile.completedCount)],
    [ui.profile.currentRecord, `${profile.streak.current} ${ui.profile.days}`],
    [ui.profile.bestRecord, `${profile.streak.best} ${ui.profile.days}`],
  ]
  return <section className="profile-sheet"><div className="profile-medallion">{profile.level}</div><dl>{facts.map(([label, value], index) => <div className={index === facts.length - 1 && facts.length % 2 === 1 ? 'profile-fact--wide' : undefined} key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><div className="level-progress"><span>{ui.profile.levelProgress}</span><progress value={profile.xpIntoLevel} max={levelSpan}>{profile.xpIntoLevel}/{levelSpan}</progress><small>{ui.profile.nextLevel} · {profile.xpToNextLevel} XP</small></div><p>{ui.profile.explanation}</p></section>
}

type RecoveryKind = 'no-match' | 'temporary' | 'storage' | 'content' | 'indexeddb'
export function RecoveryPanel({ kind, ui, details = [], onPrimary, onSecondary }: { kind: RecoveryKind; ui: UiContent; details?: string[]; onPrimary: () => void; onSecondary?: () => void }) {
  const titles: Record<RecoveryKind, string> = { 'no-match': ui.recovery.noMatchTitle, temporary: ui.recovery.temporaryTitle, storage: ui.recovery.storageTitle, content: ui.recovery.contentTitle, indexeddb: ui.recovery.indexedDbTitle }
  const bodies: Record<RecoveryKind, string> = { 'no-match': ui.pages.error.description, temporary: ui.notices.temporary, storage: ui.recovery.resetWarning, content: ui.pages.error.description, indexeddb: ui.notices.indexedDb }
  const labels: Record<RecoveryKind, string> = { 'no-match': ui.actions.openCheckIn, temporary: ui.actions.temporary, storage: ui.actions.reset, content: ui.actions.retry, indexeddb: ui.actions.retry }
  return <section className={`recovery-panel recovery-panel--${kind}`} role="alert"><img src={assets.status(kind === 'temporary' ? 'temporary' : 'unsuitable')} alt="" /><h2>{titles[kind]}</h2><p>{bodies[kind]}</p>{details.length > 0 && <ul>{details.map((detail) => <li key={detail}>{detail}</li>)}</ul>}<button className="button button--primary" type="button" onClick={onPrimary}>{labels[kind]}</button>{onSecondary && <button className="button button--ghost" type="button" onClick={onSecondary}>{ui.actions.close}</button>}</section>
}

function badgeRuleText(badge: BadgeDefinition, categoryMap: Map<string, string>, ui: UiContent): string {
  switch (badge.rule.type) {
    case 'completed-count': return `${ui.profile.completed} × ${badge.rule.count}`
    case 'streak': return `${ui.profile.bestRecord} × ${badge.rule.days} ${ui.profile.days}`
    case 'level': return `${ui.profile.level} · Lv.${badge.rule.level}`
    case 'category-count': return `${categoryMap.get(badge.rule.category) ?? badge.rule.category} · ${ui.archive.completedCount} × ${badge.rule.count}`
  }
}
