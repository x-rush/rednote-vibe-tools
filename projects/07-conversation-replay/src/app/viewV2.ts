import { buildReplayResultV2, filterScenarioCatalog, resolveScenario, type ReplayResultV2 } from '../domain/replay'
import { assetUrl, COMPANION_ASSETS, GUIDE_ASSETS } from '../assets/manifest'
import type { ConversationContentPackage, NpcMoment, ToneVariant } from '../domain/types'
import type { ReplayStateV2 } from '../state/replayStateV2'
import type { StoredReplayV2 } from '../storage/storageV2'

export type ScreenOptionV2 = {
  id: string
  label: string
  description?: string
  value?: string
}

export type ScreenSectionV2 = {
  id: string
  title: string
  body: string | string[]
}

export type ScreenViewModelV2 = {
  eyebrow: string
  title: string
  lead: string
  primaryLabel: string
  secondaryLabel?: string
  options: ScreenOptionV2[]
  sections: ScreenSectionV2[]
  result?: ReplayResultV2
  step?: { index: number; total: number; label: string }
  companion: CompanionViewModel
}

export type CompanionViewModel = NpcMoment & {
  name: string
  role: string
  featured: boolean
  imageSrc: string
  fallbackSrc: string
}

function selectedScenario(state: ReplayStateV2, content: ConversationContentPackage) {
  try {
    return resolveScenario(state.draft, content)
  } catch {
    return content.content.scenarios[0]
  }
}

function resultFor(state: ReplayStateV2, content: ConversationContentPackage) {
  try {
    return buildReplayResultV2(state.draft, content)
  } catch {
    return undefined
  }
}

const stepByPage = {
  fact: { index: 1, total: 5, label: '事实' },
  feeling: { index: 2, total: 5, label: '感受' },
  inference: { index: 3, total: 5, label: '推测' },
  need: { index: 4, total: 5, label: '需要' },
  request: { index: 5, total: 5, label: '请求' },
} as const

export function buildScreenViewModelV2(
  state: ReplayStateV2,
  content: ConversationContentPackage,
  savedResults: StoredReplayV2[],
): ScreenViewModelV2 {
  const npc = content.content.npc
  const moment = npc.moments[state.page]
  const companion: CompanionViewModel = {
    ...moment,
    name: npc.name,
    role: npc.role,
    featured: ['relationship', 'goal', 'scenario'].includes(state.page),
    imageSrc: assetUrl(COMPANION_ASSETS[moment.pose]),
    fallbackSrc: assetUrl(GUIDE_ASSETS.placeholder),
  }
  const base = (overrides: Partial<Omit<ScreenViewModelV2, 'companion'>>): ScreenViewModelV2 => ({
    eyebrow: '',
    title: '',
    lead: '',
    primaryLabel: '继续',
    options: [],
    sections: [],
    ...overrides,
    companion,
  })

  if (state.page === 'landing') {
    const landing = content.content.intro.landing
    return base({
      eyebrow: landing.eyebrow,
      title: content.meta.title,
      lead: landing.lead,
      primaryLabel: landing.primaryLabel,
      secondaryLabel: landing.secondaryLabel,
    })
  }
  if (state.page === 'privacy') {
    const privacy = content.content.intro.privacy
    return base({
      eyebrow: privacy.eyebrow,
      title: privacy.title,
      lead: privacy.lead,
      primaryLabel: privacy.primaryLabel,
      secondaryLabel: privacy.secondaryLabel,
      sections: privacy.sections,
    })
  }
  if (state.page === 'guide') {
    const guide = [
      ['不用上传聊天记录', '先用关系和目标缩小范围，再从参考情境中选择最接近的一种。'],
      ['先把一句话拆开', '迟言只帮助区分事实、感受、推测、需要和请求。'],
      ['决定权仍在你', '这里不会判断谁对谁错，也不替你决定关系去留。'],
    ][state.guideStep]!
    return base({ eyebrow: `迟言 · ${state.guideStep + 1} / 3`, title: guide[0], lead: guide[1], primaryLabel: state.guideStep === 2 ? '开始定位情境' : '下一步', secondaryLabel: '跳过引导' })
  }
  if (state.page === 'relationship') return base({
    eyebrow: '情境定位 · 1 / 2', title: '当时，你们是什么关系？', lead: '只用于缩小参考情境范围。', primaryLabel: '选择一项',
    options: content.content.choices.filter(({ kind }) => kind === 'relationship').map((choice) => ({ id: choice.id, label: choice.label, value: choice.kind === 'original-expression' ? choice.id : choice.value })),
  })
  if (state.page === 'goal') return base({
    eyebrow: '情境定位 · 2 / 2', title: '当时你最想表达什么？', lead: '选择此刻最重要的一项目标。', primaryLabel: '选择一项',
    options: content.content.choices.filter(({ kind }) => kind === 'goal').map((choice) => ({ id: choice.id, label: choice.label, value: choice.kind === 'original-expression' ? choice.id : choice.value })),
  })
  if (state.page === 'scenario') {
    const matches = filterScenarioCatalog(content.content.scenarios, state.draft).slice(0, 6)
    return base({
      eyebrow: `${matches.length} 个接近的参考情境`, title: '哪一种更接近当时？', lead: '不用复述每句话，也不用粘贴聊天记录。', primaryLabel: '选择情境',
      options: [...matches.map(({ scenarioId, title, description }) => ({ id: scenarioId, label: title, description })), { id: 'scenario-unsure', label: '不确定，继续帮我整理', description: '使用通用且安全的结构。' }],
    })
  }
  const scenario = selectedScenario(state, content)
  if (state.page === 'fact') return base({
    eyebrow: '事实 · 1 / 5', title: '摄像机可以记录到什么？', lead: '暂时不解释动机，只选择可以观察或核对的行为。', primaryLabel: '确认事实', step: stepByPage.fact,
    options: scenario?.replay.factOptions.map(({ id, label, explanation }) => ({ id, label, description: explanation })) ?? [],
  })
  if (state.page === 'feeling') return base({
    eyebrow: '感受 · 2 / 5', title: '这件事发生时，你更接近什么感受？', lead: '选择 1–2 项；强度只帮助选词，不是评分。', primaryLabel: '确认感受', step: stepByPage.feeling,
    options: content.content.feelings.filter(({ id }) => scenario?.emotionIds.includes(id)).map(({ id, label }) => ({ id, label })),
  })
  if (state.page === 'inference') {
    const inferenceId = scenario?.replay.inferenceExpressionIds[0]
    const inferencePattern = content.content.choices.find((choice) => choice.kind === 'original-expression' && choice.id === inferenceId)
    const rewrite = content.content.rewrites.find(({ id }) => id === scenario?.rewriteId)
    const inferenceCopy = rewrite?.discouragedExpressions[0]
    return base({
      eyebrow: '推测 · 3 / 5', title: '有些判断很贴近当时的感受，但还不是可核对事实。', lead: '把对动机的判断放到推测栏，是为了留下核对空间。', primaryLabel: '确认推测', step: stepByPage.inference,
      options: inferenceId && inferenceCopy
        ? [{ id: inferenceId, label: inferenceCopy, description: inferencePattern?.kind === 'original-expression' ? inferencePattern.risks.map(({ explanation }) => explanation).join('；') : '先放在待核对栏，不等于否定它带来的感受。' }]
        : [],
    })
  }
  if (state.page === 'need') return base({
    eyebrow: '需要 · 4 / 5', title: '这次，你更想守住什么？', lead: '需要不是对方必须服从的命令。', primaryLabel: '确认需要', step: stepByPage.need,
    options: content.content.needs.filter(({ id }) => scenario?.needIds.includes(id)).map(({ id, label }) => ({ id, label })),
  })
  if (state.page === 'request') return base({
    eyebrow: '请求 · 5 / 5', title: '什么请求最具体，也允许协商？', lead: '检查时间、行为和边界是否清楚。', primaryLabel: '整理表达草稿', step: stepByPage.request,
    options: scenario?.replay.requestOptions.map(({ id, label, structure }) => ({ id, label, description: `${structure.when} · ${structure.boundary}` })) ?? [],
  })
  const result = resultFor(state, content)
  if (state.page === 'draft') return base({ eyebrow: '表达草稿', title: '如果再说一次，我想这样表达', lead: '柔和、直接、坚定没有高低；选择适合当前边界的一种。', primaryLabel: '做一次无压力演练', secondaryLabel: '先看表达结构', result })
  if (state.page === 'practice') return base({
    eyebrow: '无压力演练', title: '如果对方这样回应，我下一句可以怎么说？', lead: '这不是预测，只是提前练习一个可能的节点。', primaryLabel: '选择下一句',
    options: scenario?.replay.practiceOptions.map(({ id, label }) => ({ id, label })) ?? [], result,
  })
  if (state.page === 'comparison') return base({ eyebrow: '表达结构', title: '不是哪句话正确，而是哪一层更清楚。', lead: '原表达容易只留下动机判断；新结构把事实、感受、推测、需要和请求分开，推测仍保持待核对。', primaryLabel: '查看复盘卡', result })
  if (state.page === 'result') return base({ eyebrow: '本次沟通复盘', title: result ? `“${result.scenarioTitle}”可以这样重新整理` : '这份复盘需要继续补充', lead: result?.summary ?? '返回上一步补齐选择。', primaryLabel: '保存这份结构化复盘', secondaryLabel: '重新复盘', result })
  if (state.page === 'saved') return base({ eyebrow: '仅保存在这台设备', title: '保存在本机的复盘', lead: `当前 ${savedResults.length} / 3 份。`, primaryLabel: '返回首页', sections: savedResults.length === 0 ? [{ id: 'empty', title: '还没有主动保存', body: '无痕复盘不会出现在这里。' }] : [] })
  if (state.page === 'exit') return base({ eyebrow: '无痕退出', title: '如果现在退出，这些内容会消失。', lead: '当前情境、五步选择、三语气编辑和演练状态不会被保存。', primaryLabel: '继续整理', secondaryLabel: '不保存退出' })
  if (state.page === 'safety') {
    const safety = content.content.safetyRules[0]
    return base({ eyebrow: '安全优先 · 不是风险评分', title: '现在更重要的，可能不是把话说得更好。', lead: safety?.message ?? '普通沟通建议已暂停。', primaryLabel: '退出并清除本次内容', secondaryLabel: '返回情境选择', sections: safety ? [{ id: 'safety-actions', title: safety.title, body: safety.actions }] : [] })
  }
  if (state.page === 'recovery') return base({ eyebrow: '当前内容仍在内存', title: '这次复盘没有丢。', lead: state.message ?? '可以重试保存，或返回继续编辑；当前内容仍保留在这次会话里。', primaryLabel: '重新尝试保存', secondaryLabel: '返回继续编辑' })
  return base({ eyebrow: '可恢复状态', title: '继续这次复盘', lead: '当前内容仍然保留。', primaryLabel: '继续' })
}

export const TONE_ORDER: ToneVariant[] = ['gentle', 'direct', 'firm']
