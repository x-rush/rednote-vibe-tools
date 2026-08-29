import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import rawContent from '../content/content.json'
import type { EarthOnlineContent, QuestPreference } from '../content/schema'
import { createGuildState } from '../domain/quests'
import { CheckIn } from './CheckIn'
import { GuildFrame, GuildHall } from './GuildFrame'
import { MiraGuide } from './MiraGuide'
import { ActiveQuestView, MatchingRitual, QuestOffer } from './QuestFlow'
import { AdventureLog, AdventurerProfile, RecoveryPanel, XpReceipt } from './ArchiveViews'
import { AbandonSheet, CompletionConfirm, MiraHelpSheet, UnsuitableSheet } from './FeedbackSheets'
import { createProfileViewModel } from '../domain/progression'

const content = rawContent as unknown as EarthOnlineContent
const preference: QuestPreference = { minutes: 15, energy: 1, environment: 'indoor', social: 'none', spend: 'none', timeOfDay: 'day', location: 'familiar-indoor', goalId: 'relax', excludedConditions: [] }
const noop = () => undefined

describe('competition UI semantics', () => {
  it('renders the first-run guide with local Mira art and usable controls', () => {
    const html = renderToStaticMarkup(<MiraGuide copy={content.content.ui.intro} step={0} onNext={noop} onSkip={noop} />)
    expect(html).toContain('主线不用着急')
    expect(html).toContain('./assets/earth-online/guide/mira-master-v3.png')
    expect(html.match(/<button/g)).toHaveLength(2)
  })

  it('renders guide progress as a chapter counter with three stateful crystals', () => {
    const first = renderToStaticMarkup(<MiraGuide copy={content.content.ui.intro} step={0} onNext={noop} onSkip={noop} />)
    const second = renderToStaticMarkup(<MiraGuide copy={content.content.ui.intro} step={1} onNext={noop} onSkip={noop} />)
    expect(first).toContain('mira-dialogue__counter')
    expect(first).toContain('<strong>01</strong><span>/ 03</span>')
    expect(first.match(/class="mira-dialogue__pip(?: [^"]+)?"/g)).toHaveLength(3)
    expect(first.match(/mira-dialogue__pip--active/g)).toHaveLength(1)
    expect(second.match(/mira-dialogue__pip--complete/g)).toHaveLength(1)
    expect(second.match(/mira-dialogue__pip--active/g)).toHaveLength(1)
  })

  it('ends the guide with an explicit transition into check-in', () => {
    const html = renderToStaticMarkup(<MiraGuide copy={content.content.ui.intro} step={2} onNext={noop} onSkip={noop} />)
    expect(html).toContain('去登记状态')
    expect(html).not.toContain(`>${content.content.ui.intro.skipLabel}</button></section>`)
  })

  it('renders the check-in as six named fieldsets with a real submit button', () => {
    const html = renderToStaticMarkup(<CheckIn content={content} preference={preference} onChange={noop} onSubmit={noop} />)
    expect(html.match(/<fieldset/g)).toHaveLength(6)
    expect(html.match(/class="choice-field__title"/g)).toHaveLength(6)
    expect(html).toContain('type="submit"')
    expect(html).toContain(content.content.ui.notices.privacy)
  })

  it('keeps global navigation inside the safe HUD and removes it from focused quest flows', () => {
    const shell = renderToStaticMarkup(<GuildFrame ui={content.content.ui} page="guildHall" level={2} xp={120} onNavigate={noop} onHelp={noop}><p>大厅内容</p></GuildFrame>)
    const focused = renderToStaticMarkup(<GuildFrame ui={content.content.ui} page="questComplete" level={1} xp={20} hideNavigation onNavigate={noop} onHelp={noop}><button type="button">结算动作</button></GuildFrame>)
    expect(shell.indexOf('<nav')).toBeGreaterThan(shell.indexOf('<header'))
    expect(shell.indexOf('<nav')).toBeLessThan(shell.indexOf('</header>'))
    expect(shell).toContain('./assets/earth-online/brand/logo-mark.svg')
    expect(shell).toContain('adventurer-status')
    expect(shell).toContain('mira-guide-chip')
    expect(shell.indexOf('adventurer-status')).toBeLessThan(shell.indexOf('mira-guide-chip'))
    expect(shell).toContain('<strong>冒险者</strong><small>Lv.2 · 120 XP</small>')
    expect(shell).toContain('<progress aria-label="本级进度" value="20" max="200">20/200</progress>')
    expect(shell).toContain('弥拉')
    expect(shell).toContain('公会向导')
    expect(focused).not.toContain('<nav')
  })

  it('renders the guild hall as one complete illustrated notice board', () => {
    const guild = createGuildState(preference, 1)
    const html = renderToStaticMarkup(<GuildHall ui={content.content.ui} guild={guild} onStart={noop} onContinue={noop} />)
    expect(html).toContain('notice-board__art')
    expect(html).toContain('./assets/earth-online/scenes/guild-notice-board-v1.webp')
    expect(html.match(/notice-board__paper/g)).toBeNull()
  })

  it('opens Mira help as a full portrait conversation with five dialogue choices', () => {
    const html = renderToStaticMarkup(<MiraHelpSheet ui={content.content.ui} onClose={noop} />)
    expect(html).toContain('mira-audience')
    expect(html).toContain('./assets/earth-online/guide/mira-master-v3.png')
    expect(html.match(/class="mira-audience__topic"/g)).toHaveLength(5)
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('结束交谈')
    expect(html).toContain('aria-live="polite"')
  })

  it('lets the final profile fact occupy a full row instead of leaving a false empty cell', () => {
    const profile = createProfileViewModel({ xp: 20, streak: { current: 1, best: 2 }, unlockedBadgeIds: [] }, content.content.badges, [])
    const html = renderToStaticMarkup(<AdventurerProfile profile={profile} ui={content.content.ui} />)
    expect(html).toContain('profile-fact--wide')
    expect(html).toContain(content.content.ui.profile.bestRecord)
  })

  it('renders semantic shell navigation and prioritizes an active quest in the hall', () => {
    const guild = { ...createGuildState(preference, 1), activeQuest: { acceptanceId: 'accept-1', questId: content.content.tasks[0].questId, acceptedAt: '2026-08-26T08:00:00.000Z', questContentVersion: content.content.tasks[0].contentVersion, preference } }
    const hall = <GuildHall ui={content.content.ui} guild={guild} activeQuest={content.content.tasks[0]} onStart={noop} onContinue={noop} />
    const html = renderToStaticMarkup(<GuildFrame ui={content.content.ui} page="guildHall" level={1} xp={0} onNavigate={noop} onHelp={noop}>{hall}</GuildFrame>)
    expect(html).toContain('<header')
    expect(html).toContain('<nav')
    expect(html).toContain(content.content.ui.actions.continueQuest)
    expect(html).not.toContain(content.content.ui.actions.start)
  })

  it('renders real relaxed reasons and permanent safety boundaries before offer actions', () => {
    const quest = content.content.tasks[0]
    const html = renderToStaticMarkup(<QuestOffer quest={quest} categoryName={content.content.categories[0].name} explanation={{ stage: 'goal-relaxed', score: 80, reasons: ['目标类型已放宽'], relaxed: ['目标类型'] }} ui={content.content.ui} onAccept={noop} onSwap={noop} onEditPreferences={noop} onUnsuitable={noop} />)
    expect(html.indexOf(content.content.ui.quest.labels.relaxed)).toBeLessThan(html.indexOf(quest.title))
    expect(html).toContain('目标类型已放宽')
    expect(html).toContain('目标类型')
    expect(html).toContain(quest.abandonRule)
    expect(html).toContain(content.content.ui.quest.neverRelaxed[0])
    expect(html).toContain(content.content.ui.checkIn.timeLabels[quest.timeCost])
    expect(html).toContain(`${quest.xp} XP`)
    expect(html).toContain('quest-tone')
    expect(html).toContain(quest.guildBrief)
    expect(html).toContain('rpg-spark-field')
    expect(html).toContain('返回修改条件')
  })

  it('renders matching from actual selected labels and an active quest without proof collection', () => {
    const matching = renderToStaticMarkup(<MatchingRitual ui={content.content.ui} conditions={['15 分钟', '很低', '仅室内']} onSkip={noop} />)
    expect(matching).toContain('15 分钟')
    expect(matching).toContain(content.content.ui.actions.skipMatching)
    expect(matching).toContain('rune-field')
    const quest = content.content.tasks[0]
    const active = renderToStaticMarkup(<ActiveQuestView quest={quest} categoryName={content.content.categories[0].name} ui={content.content.ui} onComplete={noop} onAbandon={noop} onUnsuitable={noop} />)
    expect(active).toContain(content.content.ui.notices.noProof)
    expect(active).toContain(quest.steps[0])
    expect(active).toContain(`${quest.xp} XP`)
  })

  it('labels a retired active quest as classic', () => {
    const quest = content.content.retiredTasks[0]
    const html = renderToStaticMarkup(<ActiveQuestView quest={quest} categoryName="恢复精力" classic ui={content.content.ui} onComplete={noop} onAbandon={noop} onUnsuitable={noop} />)
    expect(html).toContain('经典任务')
    expect(html).toContain(quest.title)
  })

  it('renders immutable history titles without looking up current tasks', () => {
    const quest = content.content.tasks[0]
    const history = [{ acceptanceId: 'history-1', questId: quest.questId, questTitle: '接取时的旧版标题', questContentVersion: '1.0.0', questCategory: quest.category, questDifficulty: quest.difficulty, status: 'completed' as const, occurredAt: '2026-08-28T08:00:00.000Z', completionDate: '2026-08-28', xpAwarded: 20 }]
    const html = renderToStaticMarkup(<AdventureLog history={history} categories={content.content.categories} filter="all" ui={content.content.ui} onFilter={noop} />)
    expect(html).toContain('接取时的旧版标题')
  })

  it('renders confirmation sheets with bounded reasons and no proof request', () => {
    const quest = content.content.tasks[0]
    const complete = renderToStaticMarkup(<CompletionConfirm questTitle={quest.title} ui={content.content.ui} onConfirm={noop} onClose={noop} />)
    const abandon = renderToStaticMarkup(<AbandonSheet questTitle={quest.title} ui={content.content.ui} onConfirm={noop} onClose={noop} />)
    const unsuitable = renderToStaticMarkup(<UnsuitableSheet questTitle={quest.title} ui={content.content.ui} isAvoided={false} onConfirm={noop} onUndo={noop} onClose={noop} />)
    expect(complete).toContain(quest.title)
    expect(complete).toContain(content.content.ui.notices.noProof)
    expect(abandon).toContain(content.content.ui.reasons['changed-mind'])
    expect(unsuitable).toContain(content.content.ui.reasons['unsafe-now'])
    expect(unsuitable).not.toContain('<textarea')
  })

  it('renders completion without monetary or streak-pressure language', () => {
    const quest = content.content.tasks[0]
    const profile = createProfileViewModel({ xp: 20, streak: { current: 1, best: 1 }, unlockedBadgeIds: [] }, content.content.badges, [])
    const html = renderToStaticMarkup(<XpReceipt awardedXp={20} completionText={quest.completionText} profile={profile} newBadges={[]} ui={content.content.ui} onLog={noop} onAgain={noop} />)
    expect(html).toContain('+20 XP')
    expect(html).toContain('xp-burst')
    expect(html).not.toMatch(/金币|断签|战斗力/)
  })

  it('labels temporary mode without claiming permanent rewards', () => {
    const html = renderToStaticMarkup(<RecoveryPanel kind="temporary" ui={content.content.ui} onPrimary={noop} />)
    expect(html).toContain('关闭页面后')
    expect(html).toContain('不会结算永久 XP')
  })
})
