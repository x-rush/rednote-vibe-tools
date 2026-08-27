import type { DailyResult, Product, SettlementReason } from '../domain/types'

export function deriveSettlementReason(result: DailyResult, products: Product[]): SettlementReason {
  if (result.operatingMode === 'rest') return 'rested'
  if (result.demandResolution) {
    if (result.moneyDelta < 0) return 'loss'
    if (result.demandResolution.losses.price > 0) return 'price-high'
    if (result.demandResolution.losses.menuMismatch > 0) return 'poor-fit'
    if (result.demandResolution.losses.service > 0) return 'low-energy'
    if (result.demandResolution.losses.stockout > 0) return 'stockout'
    const prepared = result.sales.reduce((sum, sale) => sum + sale.prepared, 0)
    const unsold = result.sales.reduce((sum, sale) => sum + sale.unsold, 0)
    if (prepared > 0 && unsold / prepared >= 0.35) return 'waste'
    return 'profitable'
  }
  if ((result.unserved ?? 0) > 0) return 'low-energy'

  const priced = result.sales.flatMap((sale) => {
    const product = products.find((item) => item.productId === sale.productId)
    return product ? [{ ratio: sale.price / product.basePrice, weight: Math.max(1, sale.prepared) }] : []
  })
  const priceWeight = priced.reduce((sum, item) => sum + item.weight, 0)
  const averagePriceRatio = priceWeight === 0 ? 1 : priced.reduce((sum, item) => sum + item.ratio * item.weight, 0) / priceWeight
  if (averagePriceRatio >= 1.15 && (result.conversionRate ?? 1) < 0.6) return 'price-high'

  if (result.sales.some((sale) => sale.demand > sale.sold)) return 'stockout'
  const prepared = result.sales.reduce((sum, sale) => sum + sale.prepared, 0)
  const unsold = result.sales.reduce((sum, sale) => sum + sale.unsold, 0)
  if (prepared > 0 && unsold / prepared >= 0.35) return 'waste'
  if ((result.conversionRate ?? 1) < 0.5) return 'poor-fit'
  if (result.moneyDelta < 0) return 'loss'
  return 'profitable'
}
