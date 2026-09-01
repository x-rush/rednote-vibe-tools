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

  it('softens concrete future promises approved in the design', () => {
    const text = parseContent(raw).messages.map((message) => message.text)
    expect(text).toContain('也许明天，会有小小惊喜')
    expect(text).toContain('愿一件好事慢慢靠近')
    expect(text).not.toContain('明天会有一个小小的惊喜')
    expect(text).not.toContain('一件好事正在慢慢靠近')
  })

  it('keeps the packaged fallback in the content file', () => {
    expect(parseContent(raw).fallback).toEqual({
      id: 'system-fallback', text: '今晚，先听一听风', mood: 'calm', weight: 1,
    })
  })
})
