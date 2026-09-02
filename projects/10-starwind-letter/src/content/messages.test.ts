import { describe, expect, it } from 'vitest'
import raw from './content.json'
import { parseContent } from './messages'

describe('star message content', () => {
  it('contains the approved balanced first-release set', () => {
    const { messages } = parseContent(raw)
    expect(messages).toHaveLength(60)
    expect(new Set(messages.map((message) => message.id)).size).toBe(60)
    expect(Object.fromEntries(['calm', 'hope', 'missing', 'courage', 'dream'].map(
      (mood) => [mood, messages.filter((message) => message.mood === mood).length],
    ))).toEqual({ calm: 12, hope: 12, missing: 12, courage: 12, dream: 12 })
    expect(messages.every((message) => [...message.text.replace(/[，。！？、]/g, '')].length <= 24)).toBe(true)
  })

  it('keeps every message focused on encouragement without romantic or relationship language', () => {
    const text = parseContent(raw).messages.map((message) => message.text).join('\n')
    const relationshipTerms = ['爱', '喜欢', '想念', '惦记', '牵挂', '拥抱', '某个人', '回应', '偏爱', '陪伴', '关系', '真心']

    expect(relationshipTerms.filter((term) => text.includes(term))).toEqual([])
    expect(parseContent(raw).messages.filter((message) => /你|自己|今天|今晚|可以|不必|允许|别|先/.test(message.text)).length).toBeGreaterThanOrEqual(48)
  })

  it('keeps the packaged fallback in the content file', () => {
    expect(parseContent(raw).fallback).toEqual({
      id: 'system-fallback', text: '今晚不必证明自己', mood: 'calm', weight: 1,
    })
  })
})
