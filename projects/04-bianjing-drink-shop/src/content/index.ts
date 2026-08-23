import rawContent from './content.json'
import type { ShopContentPackage } from './schema'
import { validateContent } from './schema'

const validation = validateContent(rawContent, 'production')
if (!validation.ok) throw new Error(`内容包校验失败：${validation.errors.join('；')}`)

export const shopContent = rawContent as unknown as ShopContentPackage
export const productById = new Map(shopContent.content.drinks.map((item) => [item.productId, item]))
export const eventById = new Map(shopContent.content.events.map((item) => [item.eventId, item]))
export const chainById = new Map(shopContent.content.chains.map((item) => [item.chainId, item]))
export const endingById = new Map(shopContent.content.endings.map((item) => [item.endingId, item]))
