import type { CrisisContractDefinition, ShopContent } from '../content/schema'
import type { ContractSceneTrigger, DailyResult, FinancialPhase, GameState, LedgerLine } from '../domain/types'
import { clampStat } from '../domain/numbers'
import { conditionsMatch } from './conditions'
import { calendarDayAfterTurns, remainingOperatingDays } from './campaign'

export type FinancialAssessment = FinancialPhase | 'bankruptcy'

const healthOf = (state: GameState) => state.financialHealth ?? { phase: 'normal' as const, rescueUsed: false }

export function assessFinancialHealth(state: GameState, content: ShopContent): FinancialAssessment {
  const health = healthOf(state)
  if (health.activeContract) {
    if (state.money < content.balance.crisis.hardDebtFloor) return 'bankruptcy'
    if (state.day >= health.activeContract.graceEndsDay) return state.money >= 0 ? 'normal' : 'bankruptcy'
    return 'grace'
  }
  if (health.rescueUsed && state.money < content.balance.crisis.hardDebtFloor) return 'bankruptcy'
  if (health.rescueUsed && state.money < 0) return 'bankruptcy'
  if (state.money < 0 && remainingOperatingDays(state.operatingDay, content.balance.campaign) < content.balance.crisis.graceDays) {
    return 'bankruptcy'
  }
  if (state.money < 0) return 'offer'
  if (state.money < content.balance.crisis.warningMoney) return 'warning'
  return 'normal'
}

export function requiredFinancialPage(state: GameState, content: ShopContent): 'financialCrisis' | undefined {
  return state.pendingContractScene || assessFinancialHealth(state, content) === 'offer' ? 'financialCrisis' : undefined
}

export function availableCrisisContracts(state: GameState, content: ShopContent): CrisisContractDefinition[] {
  if (healthOf(state).rescueUsed) return []
  if (remainingOperatingDays(state.operatingDay, content.balance.campaign) < content.balance.crisis.graceDays) return []
  return content.crisisContracts.filter((contract) => conditionsMatch(contract.eligibility, state))
}

export function queueContractScene(state: GameState, trigger: ContractSceneTrigger): GameState {
  const contractId = healthOf(state).activeContract?.contractId
  if (!contractId) return state
  return { ...state, pendingContractScene: { contractId, trigger } }
}

export function acknowledgeCrisisScene(state: GameState): GameState {
  const scene = state.pendingContractScene
  if (!scene) return state
  const shouldClose = state.flags.includes('financial-crisis-close')
  if (scene.trigger === 'target-failure' && shouldClose) return {
    ...state,
    page: 'financialCrisis',
    pendingContractScene: { contractId: scene.contractId, trigger: 'grace-failure' },
  }
  if (scene.trigger === 'target-success' && !healthOf(state).activeContract) return {
    ...state,
    page: 'financialCrisis',
    pendingContractScene: { contractId: scene.contractId, trigger: 'grace-success' },
  }
  return {
    ...state,
    pendingContractScene: undefined,
    page: shouldClose ? 'bankruptcy' : 'morning',
    currentEndingId: shouldClose ? 'ending-closed-early' : state.currentEndingId,
    unlockedEndingIds: shouldClose
      ? [...new Set([...state.unlockedEndingIds, 'ending-closed-early'])]
      : state.unlockedEndingIds,
  }
}

export function acceptCrisisContract(
  state: GameState,
  contractId: string,
  content: ShopContent,
): { state: GameState; ledger: LedgerLine[] } {
  const contract = content.crisisContracts.find((item) => item.contractId === contractId)
  if (!contract) throw new Error('周转契约不存在')
  if (healthOf(state).rescueUsed) throw new Error('周转机会已经使用')
  if (assessFinancialHealth(state, content) !== 'offer') throw new Error('当前尚未进入周转危机')
  if (!availableCrisisContracts(state, content).some((item) => item.contractId === contractId)) throw new Error('尚未满足这份周转契约的条件')

  let next: GameState = {
    ...state,
    money: state.money + contract.immediateMoney,
    financialHealth: {
      phase: 'grace',
      rescueUsed: true,
      activeContract: {
        contractId,
        acceptedDay: state.day,
        graceEndsDay: calendarDayAfterTurns(state.day, content.balance.crisis.graceDays, content.balance.campaign),
        preorderProgress: 0,
      },
    },
    pendingContractScene: { contractId, trigger: 'accepted' },
  }
  if (contract.obligation.type === 'operating-modifier') {
    next = {
      ...next,
      modifiers: [
        ...next.modifiers.filter((item) => item.modifierId !== `${contractId}-obligation`),
        {
          modifierId: `${contractId}-obligation`,
          target: contract.obligation.target,
          operation: contract.obligation.operation,
          value: contract.obligation.value,
          expiresDay: content.balance.campaign.totalCalendarDays,
          playerLabel: contract.obligation.playerLabel,
          durationBasis: 'operating',
          remainingOperatingDays: contract.obligation.operatingDays,
        },
      ],
    }
  }
  if (contract.obligation.type === 'repayment') {
    next = {
      ...next,
      pendingEffects: [
        ...next.pendingEffects,
        ...contract.obligation.installments.map((installment, index) => ({
          scheduledEffectId: `${contractId}-installment-${index + 1}`,
          dueDay: calendarDayAfterTurns(state.day, installment.delayDays, content.balance.campaign),
          effects: [{ type: 'money-delta' as const, value: installment.amount, labelId: installment.labelId }],
          contractId,
          contractSceneTrigger: (index === 0 ? 'first-installment' : 'second-installment') as ContractSceneTrigger,
        })),
      ],
    }
  }
  return {
    state: next,
    ledger: [{ kind: 'event', labelId: 'crisis-contract-funds', amount: contract.immediateMoney, entityId: contractId }],
  }
}

export function recordContractSales(state: GameState, result: DailyResult, content: ShopContent): GameState {
  const active = healthOf(state).activeContract
  if (!active || state.flags.includes('crisis-preorder-target-complete')) return state
  const contract = content.crisisContracts.find((item) => item.contractId === active.contractId)
  if (!contract || contract.obligation.type !== 'sales-target') return state
  const primaryTags = new Set(content.demandSegments
    .filter((segment) => contract.obligation.type === 'sales-target' && contract.obligation.segmentIds.includes(segment.segmentId))
    .flatMap((segment) => segment.primaryTags))
  const qualifyingSold = result.sales.reduce((sum, sale) => {
    const product = content.drinks.find((item) => item.productId === sale.productId)
    return sum + (product?.preferenceTags.some((tag) => primaryTags.has(tag)) ? sale.sold : 0)
  }, 0)
  const progress = Math.min(contract.obligation.targetCount, active.preorderProgress + qualifyingSold)
  let next: GameState = {
    ...state,
    financialHealth: { ...healthOf(state), activeContract: { ...active, preorderProgress: progress } },
  }
  if (progress >= contract.obligation.targetCount) {
    next = {
      ...next,
      money: next.money + contract.obligation.successMoney,
      reputation: clampStat(next.reputation + contract.obligation.successReputation),
      flags: [...new Set([...next.flags, 'crisis-preorder-target-complete'])],
      pendingContractScene: { contractId: contract.contractId, trigger: 'target-success' },
    }
  }
  return next
}

export function advanceCrisisDay(state: GameState, content: ShopContent): { state: GameState; shouldClose: boolean } {
  const health = healthOf(state)
  const active = health.activeContract
  if (!active) {
    const shouldClose = assessFinancialHealth(state, content) === 'bankruptcy'
    return {
      state: shouldClose ? { ...state, flags: [...new Set([...state.flags, 'financial-crisis-close'])] } : state,
      shouldClose,
    }
  }
  const contract = content.crisisContracts.find((item) => item.contractId === active.contractId)
  const belowFloor = state.money < content.balance.crisis.hardDebtFloor
  if (!belowFloor && state.day < active.graceEndsDay) return { state, shouldClose: false }

  let next = state
  if (contract?.obligation.type === 'sales-target' && !state.flags.includes('crisis-preorder-target-complete')) {
    next = {
      ...next,
      reputation: clampStat(next.reputation + contract.obligation.failureReputation),
      flags: [...new Set([...next.flags, 'crisis-preorder-target-failed'])],
      pendingContractScene: { contractId: contract.contractId, trigger: 'target-failure' },
    }
  }
  const shouldClose = belowFloor || next.money < 0
  next = {
    ...next,
    financialHealth: { phase: shouldClose ? 'offer' : next.money < content.balance.crisis.warningMoney ? 'warning' : 'normal', rescueUsed: true },
    flags: shouldClose ? [...new Set([...next.flags, 'financial-crisis-close'])] : next.flags,
    pendingContractScene: next.pendingContractScene?.trigger === 'target-failure' || next.pendingContractScene?.trigger === 'target-success'
      ? next.pendingContractScene
      : { contractId: active.contractId, trigger: shouldClose ? 'grace-failure' : 'grace-success' },
  }
  return { state: next, shouldClose }
}
