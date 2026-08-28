export type NumberKind = 'biomass' | 'damage' | 'block'

export type NumberEffectInput = {
  kind: NumberKind
  amount: number
  entityId: string
  atMs: number
}

export type NumberEffect = NumberEffectInput & {
  id: number
  chain: number
}

export type NumberFeed = {
  push(effect: NumberEffectInput): void
  update(nowMs: number): void
  visible(): readonly NumberEffect[]
  draw(context: CanvasRenderingContext2D, width: number, height: number, nowMs: number): void
}

const EFFECT_LIFETIME_MS = 920

export function createNumberFeed(options: { aggregateMs: number; maxVisible: number }): NumberFeed {
  let nextId = 1
  let effects: NumberEffect[] = []

  return {
    push(input) {
      const aggregatable = [...effects].reverse().find((effect) => (
        effect.kind === input.kind
        && effect.entityId === input.entityId
        && input.atMs >= effect.atMs
        && input.atMs - effect.atMs <= options.aggregateMs
      ))

      if (aggregatable) {
        aggregatable.amount += input.amount
        aggregatable.chain += 1
        aggregatable.atMs = input.atMs
        return
      }

      effects.push({ ...input, id: nextId, chain: 1 })
      nextId += 1
      if (effects.length > options.maxVisible) effects = effects.slice(-options.maxVisible)
    },
    update(nowMs) {
      effects = effects.filter((effect) => nowMs - effect.atMs <= EFFECT_LIFETIME_MS)
    },
    visible() {
      return effects.map((effect) => ({ ...effect }))
    },
    draw(context, width, height, nowMs) {
      this.update(nowMs)
      context.save()
      context.textAlign = 'center'
      context.textBaseline = 'middle'

      effects.forEach((effect, index) => {
        const age = Math.max(0, nowMs - effect.atMs)
        const progress = Math.min(1, age / EFFECT_LIFETIME_MS)
        const y = height * 0.43 - progress * 54 - index * 24
        context.globalAlpha = 1 - progress * progress
        context.font = `800 ${effect.chain > 1 ? 27 : 23}px Inter, sans-serif`
        context.fillStyle = effect.kind === 'damage' ? '#ff7f7a' : effect.kind === 'block' ? '#a9c8ff' : '#91fff1'
        context.shadowColor = context.fillStyle
        context.shadowBlur = 12
        const prefix = effect.kind === 'biomass' ? '+' : effect.kind === 'damage' ? '−' : '◆'
        const chain = effect.chain > 1 ? ` ×${effect.chain}` : ''
        context.fillText(`${prefix}${formatAmount(effect.amount)}${chain}`, width / 2, y)
      })

      context.restore()
    },
  }
}

function formatAmount(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(1)
}
