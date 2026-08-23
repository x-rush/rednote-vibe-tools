import { useEffect, useMemo, useReducer, useState, type FormEvent, type ReactNode } from 'react'
import rawContent from './content/content.json'
import type { CompletedQuest, EarthOnlineContent, EnergyLevel, QuestPreference, StoragePayload, TimeCost } from './content/schema'
import { validateContent } from './content/validate'
import { createPageViewModel } from './app/view-model'
import { appReducer, createInitialAppState, shouldPersistAppState, type AppState } from './app/state'
import { matchQuest } from './domain/matcher'
import { acceptQuest, abandonQuest, completeQuest, createGuildState, offerQuest, swapQuest, type GuildDomainState } from './domain/quests'
import { loadState, saveState, type StorageEnvelope } from './storage/storage'
import './App.css'

const content = rawContent as unknown as EarthOnlineContent
const questById = new Map(content.content.tasks.map((quest) => [quest.questId, quest]))
const defaultPreference: QuestPreference = { minutes: 15, energy: 1, environment: 'indoor', social: 'none', spend: 'none', timeOfDay: 'day', location: 'familiar-indoor', goalId: 'relax', excludedConditions: [] }

function App() {
  const [state, dispatch] = useReducer(appReducer, undefined, initializeState)
  const [preference, setPreference] = useState(state.guild.preference)
  const model = useMemo(() => createPageViewModel(state, content), [state])

  useEffect(() => {
    if (!shouldPersistAppState(state)) return
    const envelope: StorageEnvelope = { schemaVersion: 1, contentVersion: content.contentVersion, updatedAt: new Date().toISOString(), data: toStoragePayload(state.guild) }
    saveState(window.localStorage, envelope)
  }, [state])

  const issueQuest = (nextPreference: QuestPreference, swapping = false) => {
    const baseState = { ...state.guild, preference: nextPreference }
    const completed: CompletedQuest[] = baseState.history.filter((entry) => entry.status === 'completed' && entry.completionDate).map((entry) => ({ acceptanceId: entry.acceptanceId, questId: entry.questId, acceptedAt: entry.occurredAt, completedAt: entry.occurredAt, completionDate: entry.completionDate!, xpAwarded: entry.xpAwarded }))
    const result = matchQuest(content.content.tasks, nextPreference, { seed: baseState.rngState, nowDate: localDateKey(), recentQuestIds: baseState.recentQuestIds, completed, abandoned: baseState.history.filter(({ status }) => status === 'abandoned'), previousCategoryIds: baseState.history.flatMap(({ category }) => category ? [category] : []).slice(-2) })
    if (result.kind === 'no-match') { dispatch({ type: 'NO_MATCH', reasons: result.reasons }); return }
    const now = new Date().toISOString()
    dispatch(swapping ? { type: 'QUEST_SWAPPED', state: swapQuest(baseState, result, now) } : { type: 'OFFER_CREATED', state: offerQuest(baseState, result, now) })
  }

  const submitPreferences = (event: FormEvent) => { event.preventDefault(); issueQuest(preference) }
  const activeQuest = state.guild.activeQuest ? questById.get(state.guild.activeQuest.questId) : undefined
  const completeActive = () => {
    if (!activeQuest) return
    dispatch({ type: 'QUEST_COMPLETED', result: completeQuest(state.guild, activeQuest, content.content.badges, new Date().toISOString(), localDateKey()) })
  }

  return (
    <div className="app-shell">
      <header className="site-header"><div><p className="eyebrow">地球 Online · 本地冒险者公会</p><p className="brand">主线不用着急，先来领一个小任务。</p></div><button className="level-chip" onClick={() => dispatch({ type: 'NAVIGATE', page: 'adventurerProfile' })} aria-label="查看冒险者等级">Lv.{model.profile?.level} · {state.guild.xp} XP</button></header>
      <nav className="guild-nav" aria-label="公会导航"><button onClick={() => dispatch({ type: 'NAVIGATE', page: 'guildHall' })}>大厅</button><button onClick={() => dispatch({ type: 'NAVIGATE', page: 'questHistory' })}>日志</button><button onClick={() => dispatch({ type: 'NAVIGATE', page: 'badgeList' })}>徽章</button><button onClick={() => dispatch({ type: 'NAVIGATE', page: 'adventurerProfile' })}>档案</button></nav>
      <main><section className="page-card" aria-labelledby="page-title"><p className="section-kicker">{pageLabel(state.page)}</p><h1 id="page-title">{model.title}</h1><p className="lede">{model.description}</p>
        {state.page === 'guildHall' && <GuildHall state={state} onStart={() => dispatch({ type: 'OPEN_PREFERENCES' })} />}
        {state.page === 'preferenceSelect' && <PreferenceForm preference={preference} onChange={setPreference} onSubmit={submitPreferences} />}
        {state.page === 'questOffer' && model.quest && <QuestCard quest={model.quest} reasons={['匹配当前登记状态', '安全硬条件全部通过']} actions={<><button className="primary" onClick={() => dispatch({ type: 'QUEST_ACCEPTED', state: acceptQuest(state.guild, new Date().toISOString()) })}>接受任务</button><button onClick={() => issueQuest(state.guild.preference, true)}>换一个</button></>} />}
        {state.page === 'questAccepted' && model.quest && <QuestCard quest={model.quest} actions={<><button className="primary" onClick={completeActive}>标记完成</button><button onClick={() => dispatch({ type: 'QUEST_ABANDONED', state: abandonQuest(state.guild, new Date().toISOString()) })}>放弃任务</button></>} />}
        {state.page === 'questComplete' && <CompletionPanel state={state} onAgain={() => dispatch({ type: 'OPEN_PREFERENCES' })} />}
        {state.page === 'questAbandoned' && <div className="action-panel"><p>任务已经安全放回告示板，没有扣分。</p><button className="primary" onClick={() => dispatch({ type: 'OPEN_PREFERENCES' })}>重新登记状态</button></div>}
        {state.page === 'adventurerProfile' && model.profile && <ProfilePanel profile={model.profile} />}
        {state.page === 'questHistory' && model.history && <HistoryPanel history={model.history} />}
        {state.page === 'badgeList' && <BadgePanel state={state} />}
        {state.page === 'error' && <ErrorPanel state={state} onRecover={() => dispatch({ type: 'OPEN_PREFERENCES' })} />}
      </section></main>
      <footer>任务在本机匹配 · 不调用定位 · 不上传完成证明 · 数据可在浏览器中清除</footer>
    </div>
  )
}

function GuildHall({ state, onStart }: { state: AppState; onStart: () => void }) { return <div className="hall-grid"><article className="status-card"><h2>今日冒险者状态</h2><dl><div><dt>时间</dt><dd>{state.guild.preference.minutes} 分钟</dd></div><div><dt>精力</dt><dd>{state.guild.preference.energy} 级</dd></div><div><dt>金币</dt><dd>0 元任务可用</dd></div><div><dt>连续</dt><dd>{state.guild.streak.current} 天</dd></div></dl></article><div className="notice-board"><p>任务均来自 100 条人工审核的本地任务库。</p><button className="primary large" onClick={onStart}>领取一个小任务</button></div></div> }

function PreferenceForm({ preference, onChange, onSubmit }: { preference: QuestPreference; onChange: (value: QuestPreference) => void; onSubmit: (event: FormEvent) => void }) {
  const update = <K extends keyof QuestPreference>(key: K, value: QuestPreference[K]) => onChange({ ...preference, [key]: value, ...(key === 'environment' ? { location: value === 'indoor' ? 'familiar-indoor' : 'familiar-public-area' } : {}) })
  return <form className="preference-form" onSubmit={onSubmit}>
    <fieldset><legend>可用时间</legend><div className="choice-row">{[5, 10, 15, 20].map((value) => <button type="button" className={preference.minutes === value ? 'selected' : ''} key={value} onClick={() => update('minutes', value as TimeCost)}>{value} 分钟</button>)}</div></fieldset>
    <fieldset><legend>当前精力</legend><div className="choice-row">{[1, 2, 3].map((value) => <button type="button" className={preference.energy === value ? 'selected' : ''} key={value} onClick={() => update('energy', value as EnergyLevel)}>{['低', '中', '高'][value - 1]}</button>)}</div></fieldset>
    <fieldset><legend>当前环境</legend><div className="choice-row"><button type="button" className={preference.environment === 'indoor' ? 'selected' : ''} onClick={() => update('environment', 'indoor')}>室内</button><button type="button" className={preference.environment === 'outdoor' ? 'selected' : ''} onClick={() => update('environment', 'outdoor')}>户外</button></div></fieldset>
    <fieldset><legend>社交意愿</legend><div className="choice-row"><button type="button" className={preference.social === 'none' ? 'selected' : ''} onClick={() => update('social', 'none')}>想独处</button><button type="button" className={preference.social === 'optional' ? 'selected' : ''} onClick={() => update('social', 'optional')}>熟人互动也可以</button></div></fieldset>
    <fieldset><legend>花钱意愿</legend><div className="choice-row"><button type="button" className={preference.spend === 'none' ? 'selected' : ''} onClick={() => update('spend', 'none')}>不花钱</button><button type="button" className={preference.spend === 'allowed' ? 'selected' : ''} onClick={() => update('spend', 'allowed')}>可以，但优先免费</button></div></fieldset>
    <fieldset><legend>现在更想</legend><div className="choice-row">{content.content.goals.filter(({ id }) => ['relax', 'explore', 'organize', 'move', 'connect'].includes(id)).map((goal) => <button type="button" className={preference.goalId === goal.id ? 'selected' : ''} key={goal.id} onClick={() => update('goalId', goal.id)}>{goal.name}</button>)}</div></fieldset>
    <fieldset><legend>其他硬条件</legend><label className="select-label">时间段<select value={preference.timeOfDay} onChange={(event) => update('timeOfDay', event.target.value as QuestPreference['timeOfDay'])}><option value="day">白天</option><option value="night">夜间</option></select></label><p className="privacy-note">首发 100 项全部 0 元；安全、地点、不花钱和“不社交”选择永不放宽。</p></fieldset>
    <button className="primary large" type="submit">从任务板匹配</button>
  </form>
}

function QuestCard({ quest, reasons = [], actions }: { quest: EarthOnlineContent['content']['tasks'][number]; reasons?: string[]; actions: ReactNode }) { return <article className="quest-card"><div className="quest-meta"><span>{quest.difficulty === 'tiny' ? 'E 级' : 'D 级'}</span><span>{quest.timeCost} 分钟</span><span>0 元</span><span>{quest.energyLevel} 级精力</span></div><h2>{quest.title}</h2><p>{quest.description}</p>{reasons.length > 0 && <aside><h3>为什么推荐</h3><ul>{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></aside>}<h3>完成步骤</h3><ol>{quest.steps.map((step) => <li key={step}>{step}</li>)}</ol><p className="safety-note">{quest.abandonRule}</p><div className="actions">{actions}</div></article> }
function CompletionPanel({ state, onAgain }: { state: AppState; onAgain: () => void }) { return <div className="action-panel"><p className="xp-award">+{state.lastAwardedXp} XP</p><p>{state.newlyUnlockedBadgeIds.length > 0 ? `新解锁 ${state.newlyUnlockedBadgeIds.length} 枚文字徽章。` : '经验已经计入冒险者档案。'}</p><button className="primary" onClick={onAgain}>再领一项任务</button></div> }
function ProfilePanel({ profile }: { profile: NonNullable<ReturnType<typeof createPageViewModel>['profile']> }) { return <div className="profile-grid"><article><span>等级</span><strong>{profile.level}</strong></article><article><span>总经验</span><strong>{profile.xp}</strong></article><article><span>连续完成</span><strong>{profile.streak.current} 天</strong></article><article><span>累计完成</span><strong>{profile.completedCount}</strong></article><p className="progress-copy">距离下一级还需 {profile.xpToNextLevel} XP</p></div> }
function HistoryPanel({ history }: { history: NonNullable<ReturnType<typeof createPageViewModel>['history']> }) { return <div><dl className="history-summary"><div><dt>记录</dt><dd>{history.total}</dd></div><div><dt>完成</dt><dd>{history.completed}</dd></div><div><dt>放弃</dt><dd>{history.abandoned}</dd></div><div><dt>经验</dt><dd>{history.earnedXp}</dd></div></dl>{history.entries.length === 0 ? <p className="empty-state">还没有冒险日志。完成或放弃任务后会出现在这里。</p> : <ol className="history-list">{[...history.entries].reverse().map((entry) => <li key={`${entry.questId}-${entry.occurredAt}`}><strong>{entry.title}</strong><span>{statusLabel(entry.status)} · {entry.occurredAt.slice(0, 10)}</span></li>)}</ol>}</div> }
function BadgePanel({ state }: { state: AppState }) { return <ul className="badge-list">{content.content.badges.map((badge) => <li className={state.guild.unlockedBadgeIds.includes(badge.id) ? 'unlocked' : ''} key={badge.id}><span className="badge-placeholder" aria-hidden="true">印记</span><div><strong>{badge.title}</strong><p>{badge.description}</p><small>{state.guild.unlockedBadgeIds.includes(badge.id) ? '已解锁' : '尚未解锁'}</small></div></li>)}</ul> }
function ErrorPanel({ state, onRecover }: { state: AppState; onRecover: () => void }) { return <div className="error-panel" role="alert"><p>{state.error?.message ?? '发生了可恢复错误。'}</p>{state.error?.reasons && <ul>{state.error.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}<button className="primary" onClick={onRecover}>返回修改状态</button></div> }

function initializeState(): AppState {
  const validation = validateContent(content, 'production')
  const base = createGuildState(defaultPreference, 0x12345678)
  if (!validation.ok) return { ...createInitialAppState(base), page: 'error', error: { code: 'content', message: '内容包未能通过安全校验。', recoverable: false } }
  const loaded = loadState(window.localStorage, new Set(questById.keys()))
  if (loaded.status === 'ok') return { ...createInitialAppState(base), guild: { ...base, ...loaded.envelope.data, categoryCompletionCounts: deriveCategoryCounts(loaded.envelope.data) }, page: loaded.envelope.data.activeQuest ? 'questAccepted' : loaded.envelope.data.offeredQuestId ? 'questOffer' : 'guildHall' }
  if (loaded.status === 'corrupt' || loaded.status === 'future-version') return { ...createInitialAppState(base), page: 'error', error: { code: 'storage-recovery', message: loaded.status === 'corrupt' ? '本机记录已损坏，可以返回并从安全默认状态继续。' : '发现未知版本的本机记录，请使用当前安全默认状态。', recoverable: true } }
  return createInitialAppState(base)
}

function toStoragePayload(guild: GuildDomainState): StoragePayload { return { preference: guild.preference, offeredQuestId: guild.offeredQuestId, activeQuest: guild.activeQuest, recentQuestIds: guild.recentQuestIds, completedQuestIds: guild.completedQuestIds, history: guild.history, xp: guild.xp, streak: guild.streak, unlockedBadgeIds: guild.unlockedBadgeIds, rngState: guild.rngState } }
function deriveCategoryCounts(payload: StoragePayload): GuildDomainState['categoryCompletionCounts'] { const result: GuildDomainState['categoryCompletionCounts'] = {}; for (const entry of payload.history) if (entry.status === 'completed' && entry.category) result[entry.category] = (result[entry.category] ?? 0) + 1; return result }
function localDateKey(date = new Date()): string { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); return `${year}-${month}-${day}` }
function pageLabel(page: AppState['page']): string { return ({ guildHall: '公会入口', preferenceSelect: '冒险者状态', questOffer: '待接取', questAccepted: '执行中', questComplete: '结算完成', questAbandoned: '安全退出', adventurerProfile: '经验与等级', questHistory: '本机记录', badgeList: '成就接口', error: '安全回退' })[page] }
function statusLabel(status: 'completed' | 'abandoned' | 'swapped'): string { return ({ completed: '已完成', abandoned: '已放弃', swapped: '已更换' })[status] }

export default App
