import { describe, expect, it } from 'vitest'
import rawContent from './content.json'
import { validateContent } from './schema'

describe('production content package', () => {
  it('passes the production schema', () => {
    expect(validateContent(rawContent, 'production')).toEqual({ ok: true, errors: [] })
  })

  it('contains the frozen launch quantities', () => {
    expect(rawContent.content.drinks).toHaveLength(10)
    expect(rawContent.content.ingredients).toHaveLength(10)
    expect(rawContent.content.customers).toHaveLength(12)
    expect(rawContent.content.events).toHaveLength(80)
    expect(rawContent.content.chains).toHaveLength(5)
    expect(rawContent.content.endings).toHaveLength(8)
  })

  it('uses unique stable entity and choice IDs', () => {
    const entityIds = [
      ...rawContent.content.drinks.map((item) => item.productId),
      ...rawContent.content.ingredients.map((item) => item.ingredientId),
      ...rawContent.content.recipes.map((item) => item.recipeId),
      ...rawContent.content.customers.map((item) => item.customerId),
      ...rawContent.content.weather.map((item) => item.weatherId),
      ...rawContent.content.seasons.map((item) => item.seasonId),
      ...rawContent.content.events.map((item) => item.eventId),
      ...rawContent.content.chains.map((item) => item.chainId),
      ...rawContent.content.endings.map((item) => item.endingId),
    ]
    expect(new Set(entityIds).size).toBe(entityIds.length)
    for (const event of rawContent.content.events) {
      expect(new Set(event.choices.map((choice) => choice.choiceId)).size).toBe(event.choices.length)
    }
  })

  it('rejects unsafe or malformed envelopes with JSON paths', () => {
    const invalid = {
      schemaVersion: 1,
      contentVersion: '1.0.0',
      projectId: 'bad id',
      meta: { title: ' ', locale: 'zh-CN' },
      sources: [],
      content: { image: 'data:image/png;base64,bad' },
    }
    const result = validateContent(invalid, 'envelope')
    expect(result.ok).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('$.projectId'),
      expect.stringContaining('$.meta.title'),
      expect.stringContaining('$.meta.updatedAt'),
      expect.stringContaining('$.content.image'),
    ]))
  })

  it('rejects missing event, product, and chain references inside conditions', () => {
    const invalid = structuredClone(rawContent)
    invalid.content.endings[0].conditions = [{ type: 'chain-status', chainId: 'chain-missing', status: 'completed' }]
    const result = validateContent(invalid, 'production')
    expect(result.ok).toBe(false)
    expect(result.errors).toContain('$.content.endings[0].conditions[0].chainId: 引用不存在')
  })
})
