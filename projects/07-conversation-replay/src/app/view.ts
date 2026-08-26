import { buildReplayCardViewModel } from '../domain/result'
import type { ConversationContentPackage, StoredReplay, ToneVariant } from '../domain/types'
import type { ReplayState, WizardStep } from '../state/replayState'

export type ScreenOption = { id: string; label: string; description?: string; value?: string }
export type ScreenSection = { id: string; title: string; body: string | string[] }
export type ScreenViewModel = {
  eyebrow: string
  title: string
  lead: string
  options: ScreenOption[]
  sections: ScreenSection[]
  toneCards: Array<{ tone: ToneVariant; label: string; text: string }>
  actions: Array<{ id: string; label: string; description: string }>
  shareSummary?: string
  primaryLabel?: string
}

export type SavedReplayViewModel = StoredReplay & { scenarioTitle: string }

export function buildSavedReplayViewModels(
  savedResults: StoredReplay[],
  content: ConversationContentPackage,
): SavedReplayViewModel[] {
  const titles = new Map(content.content.scenarios.map(({ scenarioId, title }) => [scenarioId, title]))
  return savedResults.map((entry) => ({
    ...entry,
    scenarioTitle: titles.get(entry.scenarioId) ?? '内容已更新',
  }))
}

const wizardCopy: Record<WizardStep, { eyebrow: string; title: string; lead: string; kind?: string }> = {
  relationship: { eyebrow: '第 1 步 · 关系', title: '当时，你们是什么关系？', lead: '只用于筛选合适的参考情境。', kind: 'relationship' },
  goal: { eyebrow: '第 2 步 · 目标', title: '你最想让这次表达做到什么？', lead: '不是寻找完美答案，只选此刻最重要的一项。', kind: 'goal' },
  conflict: { eyebrow: '第 3 步 · 程度', title: '这件事目前影响到什么程度？', lead: '涉及安全或强迫时，会先进入安全提示。', kind: 'conflict' },
  emotion: { eyebrow: '第 4 步 · 感受', title: '当时最接近哪一种感受？', lead: '感受没有好坏，也不会被用于诊断。' },
  expression: { eyebrow: '第 5 步 · 原表达', title: '当时的表达更接近哪一种？', lead: '选表达方式，不评价你这个人。', kind: 'original-expression' },
  response: { eyebrow: '第 6 步 · 对方反应', title: '对方当时的反应更接近哪一种？', lead: '这里只选择可观察到的回应，不推断动机。', kind: 'response' },
  intention: { eyebrow: '最后一步 · 去向', title: '现在想补救，还是为下次准备？', lead: '结果会同时给出补一句和下次表达。', kind: 'intention' },
}

function base(overrides: Partial<ScreenViewModel>): ScreenViewModel {
  return {
    eyebrow: '',
    title: '',
    lead: '',
    options: [],
    sections: [],
    toneCards: [],
    actions: [],
    ...overrides,
  }
}

export function buildScreenViewModel(
  state: ReplayState,
  content: ConversationContentPackage,
): ScreenViewModel {
  if (state.page === 'landing') return base({
    eyebrow: '纯前端 · 选项驱动 · 默认无痕',
    title: content.meta.title,
    lead: '不上传聊天记录，不判断谁对谁错。把那场对话，重新整理一次。',
    primaryLabel: '开始一次复盘',
  })
  if (state.page === 'intro') return base({
    eyebrow: '隐私与使用边界',
    title: '先说好：这次复盘由你掌握',
    lead: '你只选择结构化选项。无痕模式不持久化选择；主动保存时最多保留三份结构化结果。',
    sections: [
      { id: 'privacy', title: '这里不会做什么', body: ['不上传聊天或截图', '不分析自由文本', '不推断人格和动机', '不保证换种说法就能解决关系'] },
      { id: 'choice', title: '保存方式', body: '你可以无痕开始，也可以选择仅在本机保存结构化 ID。' },
    ],
  })
  if (state.page === 'scenarioSelect') return base({
    eyebrow: '选择入口',
    title: '哪一种情境更接近当时？',
    lead: '可以直接选参考情境，也可以选“不确定”，再通过关系、目标和表达方式匹配。',
    options: [
      ...content.content.scenarios.map(({ scenarioId, title, description }) => ({ id: scenarioId, label: title, description })),
      { id: 'scenario-unsure', label: '不确定，按选项帮我匹配', description: '无需输入聊天原文。' },
    ],
  })
  if (state.page === 'replayWizard') {
    const copy = wizardCopy[state.wizardStep]
    const options = state.wizardStep === 'emotion'
      ? content.content.feelings.map(({ id, label, category }) => ({ id, label, value: id, description: category }))
      : content.content.choices
          .filter(({ kind }) => kind === copy.kind)
          .map((choice) => ({ id: choice.id, label: choice.label, value: choice.kind === 'original-expression' ? choice.id : choice.value }))
    return base({ ...copy, options })
  }
  if (state.page === 'comparison') return base({
    eyebrow: '表达对比',
    title: '原表达和新结构，差在哪里？',
    lead: state.result?.matchReason ?? '正在整理匹配结果。',
    sections: state.result ? [
      { id: 'risk', title: '原来哪里容易让人误解', body: state.result.originalRisk },
      { id: 'structure', title: '可以换成这个结构', body: state.result.expressionStructure },
    ] : [],
    primaryLabel: '看看三种表达',
  })
  if (state.page === 'result' && state.result) {
    const card = buildReplayCardViewModel(state.result)
    return base({
      eyebrow: card.eyebrow,
      title: '如果再说一次',
      lead: card.title,
      sections: card.sections,
      toneCards: card.toneCards,
      actions: card.actions,
      shareSummary: card.shareSummary,
    })
  }
  if (state.page === 'savedResults') return base({
    eyebrow: '仅保存在这台设备',
    title: '保存在本机的复盘',
    lead: '最多三份，只包含选项 ID、情境 ID 和保存时间。',
  })
  if (state.page === 'safetyNotice') return base({
    eyebrow: '安全提示',
    title: '先把安全放在表达前面',
    lead: state.result?.safetyNotice?.message ?? '沟通技巧不能替代安全支持。',
    sections: state.result?.safetyNotice
      ? [{ id: 'safety-actions', title: state.result.safetyNotice.title, body: state.result.safetyNotice.actions }]
      : [],
    primaryLabel: '我知道了，查看安全版结果',
  })
  if (state.page === 'error') return base({
    eyebrow: '可恢复错误',
    title: '这次没有顺利打开',
    lead: state.error ?? '内容或本地数据无法读取，可以安全地重新开始。',
    primaryLabel: '重新开始',
  })
  return base({
    eyebrow: '空状态',
    title: '如果再说一次',
    lead: '这里暂时没有可显示的复盘。',
  })
}
