import type { BusinessEvent, EventChain, EventChoice, EventCondition, EventEffect } from '../domain/types'
import type { ShopContent } from './schema'

const timings = new Set(['opening', 'business', 'closing'])
const locations = new Set(['counter', 'street', 'kitchen', 'market', 'back-room'])
const actorRoles = new Set(['none', 'worker', 'merchant', 'scholar', 'youth', 'elder', 'neighbor-woman', 'runner'])
const axes = new Set(['money', 'reputation', 'energy', 'relationships', 'inventory', 'future'])
const directions = new Set(['up', 'down', 'mixed', 'uncertain'])
const modifierTargets = new Set(['visitor-count', 'energy-cost', 'fixed-cost', 'sales-income', 'waste-return', 'product-demand'])
const operations = new Set(['add', 'multiply'])
const internalCode = /^[MERHFXC](?:\s*[·/,]\s*[MERHFXC])*$/
const exactPreviewValue = /[+-]?\d/

type PresentationItem = Pick<BusinessEvent, 'title' | 'content' | 'choices' | 'scene'>

function immediateAxis(effect: EventEffect) {
  if (effect.type === 'money-delta') return 'money'
  if (effect.type === 'stat-delta') return effect.stat
  if (effect.type === 'inventory-delta') return 'inventory'
  return undefined
}

function collectImmediateDirections(choice: EventChoice) {
  const totals = new Map<string, number>()
  for (const effect of choice.effects) {
    const axis = immediateAxis(effect)
    if (!axis || !('value' in effect)) continue
    totals.set(axis, (totals.get(axis) ?? 0) + effect.value)
  }
  return totals
}

function hasPersistentConsequence(choice: EventChoice) {
  return choice.followUpEventIds.length > 0 || choice.effects.some((effect) =>
    effect.type === 'add-flag'
      || effect.type === 'remove-flag'
      || effect.type === 'unlock-product'
      || effect.type === 'set-modifier'
      || effect.type === 'schedule-effect'
      || effect.type === 'start-chain'
      || effect.type === 'advance-chain'
      || effect.type === 'interrupt-chain',
  )
}

function immediateBenefitVector(choice: EventChoice) {
  const totals = new Map<string, number>()
  for (const effect of choice.effects) {
    let key: string | undefined
    if (effect.type === 'money-delta') key = 'money'
    if (effect.type === 'stat-delta') key = effect.stat
    if (effect.type === 'inventory-delta') key = `inventory:${effect.productId}`
    if (!key || !('value' in effect)) continue
    totals.set(key, (totals.get(key) ?? 0) + effect.value)
  }
  return totals
}

function strictlyDominates(left: EventChoice, right: EventChoice) {
  if (hasPersistentConsequence(left) || hasPersistentConsequence(right)) return false
  const leftVector = immediateBenefitVector(left)
  const rightVector = immediateBenefitVector(right)
  const axes = new Set([...leftVector.keys(), ...rightVector.keys()])
  if (axes.size === 0) return false
  let strictlyBetter = false
  for (const axis of axes) {
    const leftValue = leftVector.get(axis) ?? 0
    const rightValue = rightVector.get(axis) ?? 0
    if (leftValue < rightValue) return false
    if (leftValue > rightValue) strictlyBetter = true
  }
  return strictlyBetter
}

function validateChoice(choice: EventChoice, ownerId: string, errors: string[]) {
  const choicePath = `${ownerId}/${choice.choiceId}`
  const hints = choice.impactHints
  if (!Array.isArray(hints) || hints.length < 1 || hints.length > 3) errors.push(`${choicePath}.impactHints: 必须包含 1–3 项`)
  else hints.forEach((hint, index) => {
    if (!axes.has(hint.axis)) errors.push(`${choicePath}.impactHints[${index}].axis: 非法影响维度`)
    if (!directions.has(hint.direction)) errors.push(`${choicePath}.impactHints[${index}].direction: 非法影响方向`)
    if (!hint.text?.trim()) errors.push(`${choicePath}.impactHints[${index}].text: 必填`)
    else if (internalCode.test(hint.text.trim())) errors.push(`${choicePath}.impactHints[${index}].text: 禁止内部缩写`)
    else if (exactPreviewValue.test(hint.text)) errors.push(`${choicePath}.impactHints[${index}].text: 确认前不得揭示精确数值`)
  })
  if (!choice.resultText?.trim()) errors.push(`${choicePath}.resultText: 必填`)
  if (choice.effects.length === 0) errors.push(`${choicePath}.effects: 选择没有任何可执行后果`)
  if (hints?.some((hint) => hint.axis === 'future') && !hasPersistentConsequence(choice)) {
    errors.push(`${choicePath}.impactHints[future]: 长期提示没有真实后续`)
  }
  const immediateMoney = choice.effects
    .filter((effect): effect is Extract<EventEffect, { type: 'money-delta' }> => effect.type === 'money-delta')
    .reduce((sum, effect) => sum + effect.value, 0)
  if (immediateMoney < -20) errors.push(`${choicePath}.effects: 即时现钱损失不得低于 -20`)

  const totals = collectImmediateDirections(choice)
  for (const [axis, total] of totals) {
    if (total === 0) continue
    const hint = hints?.find((candidate) => candidate.axis === axis)
    const expected = total > 0 ? 'up' : 'down'
    if (!hint || (hint.direction !== expected && hint.direction !== 'mixed')) {
      errors.push(`${choicePath}.impactHints[${axis}]: 与确定效果方向不一致`)
    }
  }

  choice.effects.forEach((effect, index) => {
    if (effect.type !== 'set-modifier') return
    if (!modifierTargets.has(String(effect.target))) errors.push(`${choicePath}.effects[${index}].target: 不支持的长期效果目标`)
    if (!operations.has(String(effect.operation))) errors.push(`${choicePath}.effects[${index}].operation: 不支持的长期效果运算`)
  })
}

function validateItem(item: PresentationItem, ownerId: string, errors: string[]) {
  if (item.content === `${item.title}摆在柜前，你要如何应对？`) errors.push(`${ownerId}.content: 禁止标题模板正文`)
  if (!item.content?.trim()) errors.push(`${ownerId}.content: 必填`)
  if (!item.scene || !timings.has(String(item.scene.timing))) errors.push(`${ownerId}.scene.timing: 非法事件时段`)
  if (!item.scene || !locations.has(String(item.scene.location))) errors.push(`${ownerId}.scene.location: 非法场景位置`)
  if (!item.scene || !actorRoles.has(String(item.scene.actorRole))) errors.push(`${ownerId}.scene.actorRole: 非法角色类型`)
  item.choices.forEach((choice) => validateChoice(choice, ownerId, errors))
  if (item.choices.length === 2) {
    if (strictlyDominates(item.choices[0], item.choices[1])) errors.push(`${ownerId}/${item.choices[1].choiceId}: 被同事件另一选择严格支配`)
    if (strictlyDominates(item.choices[1], item.choices[0])) errors.push(`${ownerId}/${item.choices[0].choiceId}: 被同事件另一选择严格支配`)
  }
}

export function validateEventPresentation(events: BusinessEvent[], chains: EventChain[]) {
  const errors: string[] = []
  for (const event of [...events].sort((left, right) => left.eventId.localeCompare(right.eventId))) validateItem(event, event.eventId, errors)
  for (const chain of [...chains].sort((left, right) => left.chainId.localeCompare(right.chainId))) {
    for (const node of chain.nodes) {
      validateItem(node, `${chain.chainId}/${node.nodeId}`, errors)
      for (const variant of node.variants ?? []) {
        validateItem({ ...variant, scene: variant.scene ?? node.scene }, `${chain.chainId}/${node.nodeId}/${variant.variantId}`, errors)
      }
    }
  }
  return errors
}

function walkEffects(effects: EventEffect[], onFlag: (flag: string) => void) {
  for (const effect of effects) {
    if (effect.type === 'add-flag') onFlag(effect.flag)
    if (effect.type === 'schedule-effect') walkEffects(effect.effects, onFlag)
  }
}

function walkConditions(conditions: EventCondition[] | undefined, onFlag: (flag: string) => void) {
  for (const condition of conditions ?? []) {
    if (condition.type === 'has-flag' || condition.type === 'lacks-flag') onFlag(condition.flag)
    if (condition.type === 'all' || condition.type === 'any') walkConditions(condition.conditions, onFlag)
    if (condition.type === 'not') walkConditions([condition.condition], onFlag)
  }
}

export function validateEventQuality(content: ShopContent) {
  const errors = validateEventPresentation(content.events, content.chains)
  const produced = new Set<string>()
  const consumed = new Set<string>()
  for (const event of content.events) {
    if (event.allowedOperatingModes?.includes('rest') && event.scene.timing === 'business') {
      errors.push(`${event.eventId}.allowedOperatingModes: 休息日不得触发营业中事件`)
    }
    walkConditions(event.conditions, (flag) => consumed.add(flag))
    for (const choice of event.choices) walkEffects(choice.effects, (flag) => produced.add(flag))
  }
  for (const chain of content.chains) for (const node of chain.nodes) {
    walkConditions(node.conditions, (flag) => consumed.add(flag))
    for (const choice of node.choices) walkEffects(choice.effects, (flag) => produced.add(flag))
    for (const variant of node.variants ?? []) {
      walkConditions(variant.conditions, (flag) => consumed.add(flag))
      for (const choice of variant.choices) walkEffects(choice.effects, (flag) => produced.add(flag))
    }
  }
  for (const ending of content.endings) walkConditions(ending.conditions, (flag) => consumed.add(flag))
  for (const flag of [...produced].sort()) if (!consumed.has(flag)) errors.push(`flag:${flag}: 没有任何条件消费`)
  const eventById = new Map(content.events.map((event) => [event.eventId, event]))
  const followUpReferenceCounts = new Map<string, number>()
  for (const starter of content.events) for (const choice of starter.choices) {
    choice.followUpEventIds.forEach((eventId, index) => {
      followUpReferenceCounts.set(eventId, (followUpReferenceCounts.get(eventId) ?? 0) + 1)
      const followUp = eventById.get(eventId)
      if (followUp && starter.dayRange[0] + 2 > followUp.dayRange[1]) {
        errors.push(`${starter.eventId}/${choice.choiceId}.followUpEventIds[${index}]: 回访事件在最早可排期日已经过期`)
      }
    })
  }
  for (const followUp of content.events.filter((event) => event.tags.includes('follow-up'))) {
    if (followUp.weight !== 0) errors.push(`${followUp.eventId}.weight: 回访事件不得进入普通随机池`)
    if (followUpReferenceCounts.get(followUp.eventId) !== 1) errors.push(`${followUp.eventId}: 必须且只能由一个前序选择排入队列`)
  }
  for (const chain of [...content.chains].sort((left, right) => left.chainId.localeCompare(right.chainId))) {
    const startEvent = content.events.find((event) => event.eventId === chain.startEventId)
    const startChoice = startEvent?.choices.find((choice) => choice.choiceId === chain.startChoiceId)
    const starts = startChoice?.effects.filter((effect) => effect.type === 'start-chain' && effect.chainId === chain.chainId) ?? []
    if (starts.length !== 1) errors.push(`${chain.chainId}: 入口选择必须且只能启动该连锁一次`)
    if (chain.nodes.length !== 3) errors.push(`${chain.chainId}.nodes: 必须恰好三个后续节点`)
    if ((chain.nodes[0]?.minDelayDays ?? 0) < 1) errors.push(`${chain.chainId}.nodes[0].minDelayDays: 首个后续至少间隔一日`)
    if ((chain.nodes[1]?.variants?.length ?? 0) !== 2) errors.push(`${chain.chainId}.nodes[1].variants: 第二幕必须覆盖两种前序选择`)
    if ((chain.nodes[2]?.variants?.length ?? 0) !== 4) errors.push(`${chain.chainId}.nodes[2].variants: 第三幕必须覆盖四种前序组合`)
  }
  return errors
}
